"""App Insights — lightweight usage analytics for the Navigator.

Captures a page-view event on every route change (who, which page, when, session) and
aggregates them for the App Insights tab: visitors, most-viewed pages, approximate time
spent, and top resources clicked. Time-on-page is approximated from the gap between
consecutive views in the same session (capped, since a SPA can't see idle/closed tabs).
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlmodel import select

from . import playbook
from .core import Dependencies, create_router
from .db import Feedback, PageView, ResourceClick
from .models import (
    AppInsightsOut,
    DayCountOut,
    FeedbackIn,
    FeedbackOut,
    OkOut,
    PageCountOut,
    PageViewIn,
    TopResourceOut2,
    VisitorOut,
)

router = create_router()

# Gap between two consecutive views in a session, capped at this many seconds, is
# counted as time-on-the-first-page. Caps runaway gaps (idle tabs, overnight).
_DWELL_CAP_S = 600  # 10 minutes
_RESOURCE_META = {r["key"]: r for r in playbook.RESOURCES}


def _actor(user_ws) -> str:
    try:
        return user_ws.current_user.me().user_name or "unknown"
    except Exception:
        return "unknown"


@router.post("/page-views", response_model=OkOut, operation_id="logPageView")
def log_page_view(
    body: PageViewIn,
    session: Dependencies.Session,
    user_ws: Dependencies.UserClient,
):
    """Record one page-view. Called by the frontend on every route change."""
    path = (body.path or "").strip()[:300]
    if not path:
        return OkOut()
    session.add(
        PageView(
            id=uuid.uuid4().hex,
            path=path,
            title=(body.title or "")[:120],
            session_id=(body.session_id or "")[:64],
            viewed_by=_actor(user_ws),
        )
    )
    session.commit()
    return OkOut()


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@router.get("/app-insights", response_model=AppInsightsOut, operation_id="getAppInsights")
def get_app_insights(session: Dependencies.Session):
    """Aggregate page-view + resource-click data for the App Insights tab."""
    views = list(session.exec(select(PageView)).all())
    if not views:
        return AppInsightsOut()

    now = datetime.now(timezone.utc)
    cutoff_7d = now - timedelta(days=7)

    # --- Approx dwell: per session, sort views by time; each view's dwell = capped gap
    # to the next view in the same session. Last view in a session gets 0.
    by_session: dict[str, list[PageView]] = defaultdict(list)
    for v in views:
        by_session[v.session_id or v.id].append(v)
    dwell_by_view: dict[str, float] = {}
    session_seconds: dict[str, float] = defaultdict(float)
    for sid, vs in by_session.items():
        vs.sort(key=lambda x: _aware(x.created_at))
        for i, v in enumerate(vs):
            secs = 0.0
            if i + 1 < len(vs):
                gap = (_aware(vs[i + 1].created_at) - _aware(v.created_at)).total_seconds()
                secs = max(0.0, min(gap, _DWELL_CAP_S))
            dwell_by_view[v.id] = secs
            session_seconds[sid] += secs

    # --- Per-page aggregation (views, distinct visitors, avg dwell).
    page_views: dict[str, list[PageView]] = defaultdict(list)
    for v in views:
        page_views[v.path].append(v)
    pages: list[PageCountOut] = []
    for path, vs in page_views.items():
        secs = [dwell_by_view.get(v.id, 0.0) for v in vs]
        nonzero = [s for s in secs if s > 0]
        pages.append(
            PageCountOut(
                path=path,
                title=next((v.title for v in vs if v.title), path),
                views=len(vs),
                visitors=len({v.viewed_by for v in vs}),
                avg_seconds=round(sum(nonzero) / len(nonzero), 1) if nonzero else 0.0,
            )
        )
    pages.sort(key=lambda p: p.views, reverse=True)

    # --- Per-visitor aggregation.
    user_views: dict[str, list[PageView]] = defaultdict(list)
    for v in views:
        user_views[v.viewed_by].append(v)
    # Total approx minutes per user = sum of their views' dwell.
    user_seconds: dict[str, float] = defaultdict(float)
    for v in views:
        user_seconds[v.viewed_by] += dwell_by_view.get(v.id, 0.0)
    visitors: list[VisitorOut] = []
    for user, vs in user_views.items():
        visitors.append(
            VisitorOut(
                user=user,
                views=len(vs),
                last_seen=max(_aware(v.created_at) for v in vs),
                approx_minutes=round(user_seconds[user] / 60, 1),
            )
        )
    visitors.sort(key=lambda x: x.views, reverse=True)

    # --- Views by day (last 30 days).
    day_views: dict[str, list[PageView]] = defaultdict(list)
    cutoff_30d = now - timedelta(days=30)
    for v in views:
        if _aware(v.created_at) >= cutoff_30d:
            day_views[_aware(v.created_at).strftime("%Y-%m-%d")].append(v)
    by_day = [
        DayCountOut(
            day=d,
            views=len(vs),
            visitors=len({v.viewed_by for v in vs}),
        )
        for d, vs in sorted(day_views.items())
    ]

    # --- Top resources clicked (from the existing ResourceClick log).
    clicks = list(session.exec(select(ResourceClick)).all())
    click_counts: dict[str, int] = defaultdict(int)
    for c in clicks:
        click_counts[c.resource_key] += 1
    top_resources = [
        TopResourceOut2(
            resource_key=k,
            label=_RESOURCE_META.get(k, {}).get("label", k),
            bucket=_RESOURCE_META.get(k, {}).get("bucket", ""),
            clicks=n,
        )
        for k, n in sorted(click_counts.items(), key=lambda x: x[1], reverse=True)
    ][:15]

    # --- Session-length average (approx).
    sess_vals = [s for s in session_seconds.values() if s > 0]
    avg_session_min = round((sum(sess_vals) / len(sess_vals)) / 60, 1) if sess_vals else 0.0

    return AppInsightsOut(
        total_views=len(views),
        total_visitors=len(user_views),
        views_7d=sum(1 for v in views if _aware(v.created_at) >= cutoff_7d),
        visitors_7d=len({v.viewed_by for v in views if _aware(v.created_at) >= cutoff_7d}),
        avg_session_minutes=avg_session_min,
        pages=pages[:25],
        visitors=visitors[:50],
        by_day=by_day,
        top_resources=top_resources,
    )


# --------------------------------------------------------------------------------------
# Feedback — in-app comments (good / bad / ugly / ideas), captured alongside the emails.
# --------------------------------------------------------------------------------------


@router.post("/feedback", response_model=FeedbackOut, operation_id="submitFeedback")
def submit_feedback(
    body: FeedbackIn,
    session: Dependencies.Session,
    user_ws: Dependencies.UserClient,
):
    row = Feedback(
        id=uuid.uuid4().hex,
        category=(body.category or "idea")[:20],
        message=(body.message or "").strip()[:4000],
        submitted_by=_actor(user_ws),
    )
    session.add(row)
    session.commit()
    return FeedbackOut(
        id=row.id,
        category=row.category,
        message=row.message,
        submitted_by=row.submitted_by,
        created_at=row.created_at,
    )


@router.get("/feedback", response_model=list[FeedbackOut], operation_id="listFeedback")
def list_feedback(session: Dependencies.Session):
    rows = session.exec(select(Feedback)).all()
    rows = sorted(rows, key=lambda r: r.created_at, reverse=True)[:100]
    return [
        FeedbackOut(
            id=r.id,
            category=r.category,
            message=r.message,
            submitted_by=r.submitted_by,
            created_at=r.created_at,
        )
        for r in rows
    ]
