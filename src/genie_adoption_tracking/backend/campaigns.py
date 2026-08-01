"""Campaigns — a leadership 'push' channel to complement the playbook 'pull'.

Leadership composes a targeted ask (clear CTA + deadline) aimed at a *segment* of
accounts (PP AI off, no user provisioning, whitespace, blocked tasks, open issues, or
a sub-vertical). The segment is stored as a key and resolved to live accounts at read
time, so a campaign stays accurate as signals change.

Delivery is lightweight (per the chosen design): campaigns surface in-app to the
targeted account teams, and we generate a ready-to-send mailto/Slack draft leadership
can fire from their own client (owner fields are names, not emails, and Databricks Apps
can't run SMTP — so no server-side send).
"""

from __future__ import annotations

import urllib.parse
from collections.abc import Sequence

from sqlmodel import Session, select

from .core import Dependencies, create_router
from .db import Account, AccountIssue, AdoptionTaskState, Blocker, UseCase
from .models import (
    CampaignIn,
    CampaignOut,
    CampaignPreviewOut,
    CampaignTargetOut,
    SegmentOut,
)
from .db import Campaign

router = create_router()


# --------------------------------------------------------------------------------------
# Segments — each maps to a predicate over an account (+ its derived signals)
# --------------------------------------------------------------------------------------

SEGMENTS: list[dict] = [
    {"key": "all", "label": "All FINS accounts",
     "description": "Every account the team owns.",
     "tpl_title": "Genie adoption push — action needed",
     "tpl_ask": "Team — as we drive Genie adoption across FINS this quarter, please "
                "make sure your accounts are moving through the Field Adoption "
                "Playbook. Take a few minutes to update each account's Adoption "
                "Workflow in the Navigator so we have an accurate read on where "
                "everyone is.",
     "tpl_cta": "Review and update your accounts' Adoption Workflow in the Navigator."},
    {"key": "pp_off", "label": "Partner-Powered AI off",
     "description": "PP AI disabled — Genie can't consume until it's enabled.",
     "tpl_title": "Turn on Partner-Powered AI to unblock Genie",
     "tpl_ask": "Your account has Partner-Powered AI turned OFF — Genie can't consume "
                "for the customer until it's enabled. This is the #1 blocker to getting "
                "them live. Run an AI Security Review with the customer, then enable "
                "Partner-Powered AI in the account console (Settings → Feature "
                "enablement) and set Enforce so it applies to all workspaces.",
     "tpl_cta": "Complete the AI Security Review and enable Partner-Powered AI "
                "(with Enforce on)."},
    {"key": "no_provisioning", "label": "No user provisioning (AIM or SCIM)",
     "description": "Neither AIM nor SCIM — identities aren't set up for Genie sharing.",
     "tpl_title": "Set up user provisioning (AIM or SCIM) for Genie readiness",
     "tpl_ask": "Your account has no account-level user provisioning — neither AIM nor "
                "SCIM — so users/groups aren't in place for Genie sharing and "
                "governance. Per go/genieready this is a required readiness criterion. "
                "Enable AIM (preferred, just-in-time provisioning) where the cloud/IdP "
                "supports it, or configure account-level SCIM as the fallback.",
     "tpl_cta": "Enable AIM (preferred) or account-level SCIM, then confirm on the "
                "Genie Ready dashboard."},
    {"key": "whitespace", "label": "Whitespace (no Genie use cases)",
     "description": "Accounts with no Genie use cases yet.",
     "tpl_title": "Let's find a first Genie use case",
     "tpl_ask": "Your account has no Genie use cases in flight yet — it's whitespace "
                "for Genie. Let's change that: identify one high-value business "
                "question the customer asks repeatedly, and run a demo with their known "
                "domain assets to spark it. Use Ask Genie in the Navigator for demo "
                "and play ideas tailored to the account.",
     "tpl_cta": "Identify one candidate use case and book a Genie demo with the "
                "customer."},
    {"key": "blocked", "label": "Has blocked adoption tasks",
     "description": "Account has one or more tasks marked Blocked in the workflow.",
     "tpl_title": "Let's clear your blocked adoption tasks",
     "tpl_ask": "You've flagged one or more adoption tasks as Blocked on your account. "
                "Let's get them unstuck so the engagement keeps moving. Open the "
                "account in the Navigator, and use “Ask Genie how to get unstuck” on "
                "each blocked task for the recommended play or resource — or reply here "
                "if you need leadership help.",
     "tpl_cta": "Work each blocked task with Ask Genie, or escalate here if you're "
                "stuck."},
    {"key": "open_issues", "label": "Has open Genie issues",
     "description": "Open Brickroad issues against the account.",
     "tpl_title": "Open Genie issues need attention",
     "tpl_ask": "Your account has open Genie (Brickroad) issues that may be putting "
                "revenue or the customer's confidence at risk. Please review the open "
                "issues on the account in the Navigator, make sure each has an owner "
                "and next step, and escalate any blockers that need PM or engineering "
                "help.",
     "tpl_cta": "Triage the open Genie issues and confirm an owner + next step for "
                "each."},
]

_SEGMENT_LABEL = {s["key"]: s["label"] for s in SEGMENTS}


def is_valid_segment(key: str) -> bool:
    return key in _SEGMENT_LABEL


def _owners(a: Account) -> list[str]:
    return [o for o in (a.ae_owner, a.sa_owner, a.dsa_owner) if o]


def _resolve_targets(
    session: Session, segment: str, sub_vertical: str
) -> list[Account]:
    """Live accounts matching a segment."""
    accounts = session.exec(select(Account)).all()

    if segment == "all":
        return list(accounts)
    if segment == "pp_off":
        return [a for a in accounts if a.pp_status == "off"]
    if segment == "no_provisioning":
        return [a for a in accounts if a.provisioning_status == "off"]
    if segment == "whitespace":
        with_uc = {
            uc.account_id for uc in session.exec(select(UseCase)).all()
        }
        return [a for a in accounts if a.id not in with_uc]
    if segment == "open_issues":
        issue_accts = {
            i.account_id
            for i in session.exec(select(AccountIssue)).all()
            if (i.status or "").lower() not in ("resolved", "will_not_solve")
        }
        return [a for a in accounts if a.id in issue_accts]
    if segment == "blocked":
        blocked_accts = {
            s.account_id
            for s in session.exec(select(AdoptionTaskState)).all()
            if s.status == "blocked"
        }
        return [a for a in accounts if a.id in blocked_accts]
    return []


def _target_out(accounts: Sequence[Account]) -> list[CampaignTargetOut]:
    return [
        CampaignTargetOut(
            account_id=a.id, account_name=a.name, owners=_owners(a)
        )
        for a in sorted(accounts, key=lambda a: a.name.lower())
    ]


def _draft_body(c: Campaign, target_count: int) -> str:
    """Plain-text body shared by the mailto + Slack drafts."""
    lines = [c.ask.strip(), ""]
    if c.cta:
        lines += [f"Action needed: {c.cta.strip()}"]
    if c.deadline:
        lines += [f"Deadline: {c.deadline}"]
    lines += ["", f"(Targeted to {target_count} account team(s) via the Genie "
              "Adoption Navigator.)"]
    return "\n".join(lines)


def _mailto(c: Campaign, target_count: int) -> str:
    subject = f"[Genie Adoption] {c.title}"
    body = _draft_body(c, target_count)
    q = urllib.parse.urlencode({"subject": subject, "body": body})
    return f"mailto:?{q}"


def _slack_text(c: Campaign, target_count: int) -> str:
    head = f"*{c.title}*"
    if c.priority == "high":
        head = f":rotating_light: {head}"
    return f"{head}\n{_draft_body(c, target_count)}"


def _to_out(
    session: Session, c: Campaign, *, with_targets: bool
) -> CampaignOut:
    targets = _resolve_targets(session, c.segment, c.sub_vertical)
    return CampaignOut(
        id=c.id,
        title=c.title,
        ask=c.ask,
        cta=c.cta,
        segment=c.segment,
        segment_label=_SEGMENT_LABEL.get(c.segment, c.segment),
        sub_vertical=c.sub_vertical,
        deadline=c.deadline,
        priority=c.priority,
        active=c.active,
        created_at=c.created_at,
        created_by=c.created_by,
        target_count=len(targets),
        targets=_target_out(targets) if with_targets else [],
        mailto_url=_mailto(c, len(targets)) if with_targets else "",
        slack_text=_slack_text(c, len(targets)) if with_targets else "",
    )


# --------------------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------------------

# Import helpers lazily from router to avoid a circular import.
def _uid() -> str:
    import uuid

    return uuid.uuid4().hex


@router.get("/campaigns/segments", response_model=list[SegmentOut],
            operation_id="listCampaignSegments")
def list_segments():
    return [SegmentOut(**s) for s in SEGMENTS]


@router.get("/accounts/{account_id}/campaigns", response_model=list[CampaignOut],
            operation_id="listAccountCampaigns")
def account_campaigns(account_id: str, session: Dependencies.Session):
    """Active campaigns whose segment currently targets this account — so the account
    team sees the leadership ask (with CTA + deadline) right on the account page."""
    campaigns = [
        c
        for c in session.exec(select(Campaign)).all()
        if c.active
    ]
    out: list[CampaignOut] = []
    for c in sorted(campaigns, key=lambda c: c.created_at, reverse=True):
        target_ids = {a.id for a in _resolve_targets(session, c.segment, c.sub_vertical)}
        if account_id in target_ids:
            out.append(_to_out(session, c, with_targets=False))
    return out


@router.get("/campaigns/preview", response_model=CampaignPreviewOut,
            operation_id="previewCampaignSegment")
def preview_segment(
    session: Dependencies.Session, segment: str = "all", sub_vertical: str = ""
):
    """Live target accounts for a segment — powers the count shown while composing."""
    targets = _resolve_targets(session, segment, sub_vertical)
    return CampaignPreviewOut(
        target_count=len(targets), targets=_target_out(targets)
    )


@router.get("/campaigns", response_model=list[CampaignOut],
            operation_id="listCampaigns")
def list_campaigns(session: Dependencies.Session):
    campaigns = session.exec(select(Campaign)).all()
    campaigns = sorted(campaigns, key=lambda c: c.created_at, reverse=True)
    return [_to_out(session, c, with_targets=False) for c in campaigns]


@router.post("/campaigns", response_model=CampaignOut, operation_id="createCampaign")
def create_campaign(
    body: CampaignIn,
    session: Dependencies.Session,
    user_ws: Dependencies.UserClient,
):
    if not is_valid_segment(body.segment):
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail="Unknown segment")
    actor = ""
    try:
        actor = user_ws.current_user.me().user_name or ""
    except Exception:
        actor = ""
    c = Campaign(
        id=_uid(),
        title=body.title.strip(),
        ask=body.ask.strip(),
        cta=body.cta.strip(),
        segment=body.segment,
        sub_vertical=body.sub_vertical.strip(),
        deadline=body.deadline.strip(),
        priority=body.priority if body.priority in ("normal", "high") else "normal",
        active=True,
        created_by=actor,
    )
    session.add(c)
    session.commit()
    session.refresh(c)
    return _to_out(session, c, with_targets=True)


@router.get("/campaigns/{campaign_id}", response_model=CampaignOut,
            operation_id="getCampaign")
def get_campaign(campaign_id: str, session: Dependencies.Session):
    c = session.get(Campaign, campaign_id)
    if c is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Campaign not found")
    return _to_out(session, c, with_targets=True)


@router.post("/campaigns/{campaign_id}/archive", response_model=CampaignOut,
             operation_id="archiveCampaign")
def archive_campaign(campaign_id: str, session: Dependencies.Session):
    c = session.get(Campaign, campaign_id)
    if c is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Campaign not found")
    c.active = False
    session.add(c)
    session.commit()
    session.refresh(c)
    return _to_out(session, c, with_targets=False)
