"""Campaigns — a time-boxed outreach to a chosen set of accounts.

A campaign captures: a title, a run window (start/end date), free-text describing
the intended audience, the specific accounts chosen for it, and a link to a Form
(Google Form / Typeform / etc.) with the questions to ask that audience.

The chosen accounts are a manual pick, stored as a JSON list of account ids and
resolved to names/owners at read time. Campaigns are listed newest-first.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from fastapi import HTTPException
from sqlmodel import Session, select

from .core import Dependencies, create_router
from .db import Account, Campaign, CampaignQuestion, CampaignResponse
from .models import (
    CampaignAccountOut,
    CampaignActivateIn,
    CampaignFormOut,
    CampaignIn,
    CampaignOut,
    QuestionOut,
    QuestionnaireSaveIn,
    ResponseOut,
    ResponseSubmitIn,
)

router = create_router()


def _uid() -> str:
    return uuid.uuid4().hex


def _token() -> str:
    """Unguessable token for the public form link."""
    import secrets

    return secrets.token_urlsafe(16)


def _actor(user_ws) -> str:
    try:
        return user_ws.current_user.me().user_name or ""
    except Exception:
        return ""


def _counts(session: Session, campaign_id: str) -> tuple[int, int]:
    questions = session.exec(
        select(CampaignQuestion).where(CampaignQuestion.campaign_id == campaign_id)
    ).all()
    responses = session.exec(
        select(CampaignResponse).where(CampaignResponse.campaign_id == campaign_id)
    ).all()
    return len(questions), len(responses)


def _owners(a: Account) -> list[str]:
    return [o for o in (a.ae_owner, a.sa_owner, a.dsa_owner) if o]


def _resolve_accounts(
    session: Session, account_ids: Sequence[str]
) -> list[CampaignAccountOut]:
    """Resolve the stored account ids to name/owners for display, preserving the
    chosen order and silently dropping ids that no longer exist."""
    if not account_ids:
        return []
    by_id = {a.id: a for a in session.exec(select(Account)).all()}
    out: list[CampaignAccountOut] = []
    for aid in account_ids:
        a = by_id.get(aid)
        if a is not None:
            out.append(
                CampaignAccountOut(
                    account_id=a.id, account_name=a.name, owners=_owners(a)
                )
            )
    return out


def _to_out(session: Session, c: Campaign, *, with_accounts: bool) -> CampaignOut:
    ids = c.account_ids or []
    accounts = _resolve_accounts(session, ids) if with_accounts else []
    q_count, r_count = _counts(session, c.id)
    return CampaignOut(
        id=c.id,
        title=c.title,
        start_date=c.start_date,
        end_date=c.end_date,
        audience_text=c.audience_text,
        form_url=c.form_url,
        form_token=c.form_token,
        status=c.status,
        created_at=c.created_at,
        created_by=c.created_by,
        account_count=len(ids),
        question_count=q_count,
        response_count=r_count,
        accounts=accounts,
    )


def _question_out(q: CampaignQuestion) -> QuestionOut:
    return QuestionOut(
        id=q.id,
        position=q.position,
        prompt=q.prompt,
        qtype=q.qtype,
        options=q.options or [],
        required=q.required,
    )


@router.get("/campaigns", response_model=list[CampaignOut], operation_id="listCampaigns")
def list_campaigns(session: Dependencies.Session):
    """All campaigns, newest first — one per row, with their chosen accounts."""
    campaigns = session.exec(select(Campaign)).all()
    campaigns = sorted(campaigns, key=lambda c: c.created_at, reverse=True)
    return [_to_out(session, c, with_accounts=True) for c in campaigns]


@router.post("/campaigns", response_model=CampaignOut, operation_id="createCampaign")
def create_campaign(
    body: CampaignIn,
    session: Dependencies.Session,
    user_ws: Dependencies.UserClient,
):
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    try:
        actor = user_ws.current_user.me().user_name or ""
    except Exception:
        actor = ""
    c = Campaign(
        id=_uid(),
        title=body.title.strip(),
        start_date=body.start_date.strip(),
        end_date=body.end_date.strip(),
        audience_text=body.audience_text.strip(),
        account_ids=list(dict.fromkeys(body.account_ids)),  # dedupe, keep order
        form_url=body.form_url.strip(),
        form_token=_token(),
        status="draft",
        created_by=actor,
    )
    session.add(c)
    session.commit()
    session.refresh(c)
    return _to_out(session, c, with_accounts=True)


@router.get("/campaigns/{campaign_id}", response_model=CampaignOut,
            operation_id="getCampaign")
def get_campaign(campaign_id: str, session: Dependencies.Session):
    c = session.get(Campaign, campaign_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return _to_out(session, c, with_accounts=True)


@router.delete("/campaigns/{campaign_id}", operation_id="deleteCampaign")
def delete_campaign(campaign_id: str, session: Dependencies.Session):
    c = session.get(Campaign, campaign_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    # Cascade: remove the campaign's questions and responses first, flushing so the
    # child deletes hit the DB before the parent delete (else the FK constraint on
    # gat_campaign_response / gat_campaign_question is violated).
    for q in session.exec(
        select(CampaignQuestion).where(CampaignQuestion.campaign_id == campaign_id)
    ).all():
        session.delete(q)
    for r in session.exec(
        select(CampaignResponse).where(CampaignResponse.campaign_id == campaign_id)
    ).all():
        session.delete(r)
    session.flush()
    session.delete(c)
    session.commit()
    return {"ok": True}


# --------------------------------------------------------------------------------------
# Questionnaire builder (g-form style). The account-name field is implicit/fixed and
# always the first field of the rendered form; these are the questions that follow.
# --------------------------------------------------------------------------------------


def _require(session: Session, campaign_id: str) -> Campaign:
    c = session.get(Campaign, campaign_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return c


@router.get(
    "/campaigns/{campaign_id}/questions",
    response_model=list[QuestionOut],
    operation_id="listCampaignQuestions",
)
def list_questions(campaign_id: str, session: Dependencies.Session):
    _require(session, campaign_id)
    qs = session.exec(
        select(CampaignQuestion).where(CampaignQuestion.campaign_id == campaign_id)
    ).all()
    qs = sorted(qs, key=lambda q: q.position)
    return [_question_out(q) for q in qs]


@router.put(
    "/campaigns/{campaign_id}/questions",
    response_model=list[QuestionOut],
    operation_id="saveCampaignQuestions",
)
def save_questions(
    campaign_id: str, body: QuestionnaireSaveIn, session: Dependencies.Session
):
    """Replace the campaign's whole question list (ordered by array position)."""
    _require(session, campaign_id)
    for q in session.exec(
        select(CampaignQuestion).where(CampaignQuestion.campaign_id == campaign_id)
    ).all():
        session.delete(q)
    for i, qi in enumerate(body.questions):
        session.add(
            CampaignQuestion(
                id=_uid(),
                campaign_id=campaign_id,
                position=i,
                prompt=qi.prompt.strip(),
                qtype=qi.qtype,
                options=[o for o in qi.options if o.strip()],
                required=qi.required,
            )
        )
    session.commit()
    qs = session.exec(
        select(CampaignQuestion).where(CampaignQuestion.campaign_id == campaign_id)
    ).all()
    return [_question_out(q) for q in sorted(qs, key=lambda q: q.position)]


# --------------------------------------------------------------------------------------
# Activation — set the campaign live within a date window; produces the shareable link
# and a copyable recipient list / mailto draft (no server-side SMTP in Databricks Apps).
# --------------------------------------------------------------------------------------


@router.post(
    "/campaigns/{campaign_id}/activate",
    response_model=CampaignOut,
    operation_id="activateCampaign",
)
def activate_campaign(
    campaign_id: str, body: CampaignActivateIn, session: Dependencies.Session
):
    c = _require(session, campaign_id)
    if body.start_date:
        c.start_date = body.start_date.strip()
    if body.end_date:
        c.end_date = body.end_date.strip()
    if not c.form_token:
        c.form_token = _token()
    c.status = "active"
    session.add(c)
    session.commit()
    session.refresh(c)
    return _to_out(session, c, with_accounts=True)


@router.post(
    "/campaigns/{campaign_id}/close",
    response_model=CampaignOut,
    operation_id="closeCampaign",
)
def close_campaign(campaign_id: str, session: Dependencies.Session):
    c = _require(session, campaign_id)
    c.status = "closed"
    session.add(c)
    session.commit()
    session.refresh(c)
    return _to_out(session, c, with_accounts=True)


# --------------------------------------------------------------------------------------
# Public form (served by unguessable token) + response capture -> campaign results
# --------------------------------------------------------------------------------------


@router.get(
    "/forms/{form_token}",
    response_model=CampaignFormOut,
    operation_id="getCampaignForm",
)
def get_form(form_token: str, session: Dependencies.Session):
    c = session.exec(select(Campaign).where(Campaign.form_token == form_token)).first()
    if c is None:
        raise HTTPException(status_code=404, detail="Form not found")
    qs = session.exec(
        select(CampaignQuestion).where(CampaignQuestion.campaign_id == c.id)
    ).all()
    return CampaignFormOut(
        campaign_id=c.id,
        title=c.title,
        status=c.status,
        start_date=c.start_date,
        end_date=c.end_date,
        accounts=_resolve_accounts(session, c.account_ids or []),
        questions=[_question_out(q) for q in sorted(qs, key=lambda q: q.position)],
    )


@router.post(
    "/forms/{form_token}/submit",
    response_model=ResponseOut,
    operation_id="submitCampaignForm",
)
def submit_form(
    form_token: str,
    body: ResponseSubmitIn,
    session: Dependencies.Session,
    user_ws: Dependencies.UserClient,
):
    c = session.exec(select(Campaign).where(Campaign.form_token == form_token)).first()
    if c is None:
        raise HTTPException(status_code=404, detail="Form not found")
    if c.status != "active":
        raise HTTPException(status_code=400, detail="This campaign is not accepting responses")
    r = CampaignResponse(
        id=_uid(),
        campaign_id=c.id,
        account_id=body.account_id,
        account_name=body.account_name.strip(),
        answers=body.answers or {},
        submitted_by=_actor(user_ws),
    )
    session.add(r)
    session.commit()
    session.refresh(r)
    return ResponseOut(
        id=r.id,
        account_id=r.account_id,
        account_name=r.account_name,
        answers=r.answers,
        submitted_by=r.submitted_by,
        submitted_at=r.submitted_at,
    )


@router.get(
    "/campaigns/{campaign_id}/responses",
    response_model=list[ResponseOut],
    operation_id="listCampaignResponses",
)
def list_responses(campaign_id: str, session: Dependencies.Session):
    _require(session, campaign_id)
    rows = session.exec(
        select(CampaignResponse).where(CampaignResponse.campaign_id == campaign_id)
    ).all()
    rows = sorted(rows, key=lambda r: r.submitted_at, reverse=True)
    return [
        ResponseOut(
            id=r.id,
            account_id=r.account_id,
            account_name=r.account_name,
            answers=r.answers,
            submitted_by=r.submitted_by,
            submitted_at=r.submitted_at,
        )
        for r in rows
    ]
