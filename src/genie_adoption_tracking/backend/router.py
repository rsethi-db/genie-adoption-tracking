"""API routes for the Genie Adoption Tracking app.

Two surfaces:
  * Runner  — accounts, use cases, per-use-case checklist/blocker/stage mutations
  * Signal  — an aggregate dashboard over everything captured

Playbook content is served read-only from `playbook.py`; all mutations write signal
rows to Lakebase via `Dependencies.Session`.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime, timezone

from databricks.sdk.service.iam import User as UserOut
from fastapi import HTTPException
from sqlmodel import Session, select

from . import account_plan, adoption_workflow, playbook
from .core import Dependencies, create_router
from .db import (
    Account,
    AccountIssue,
    AccountPlanItem,
    AdoptionTaskState,
    AdoptionTaskHistory,
    Blocker,
    ChecklistProgress,
    ResourceClick,
    StageTransition,
    UseCase,
)
from .models import (
    AccountDetailOut,
    AccountIn,
    AccountIssueOut,
    AccountOut,
    AccountPlanItemOut,
    AccountPlanToggleIn,
    AdoptionBulkSaveIn,
    AdoptionHistoryEntryOut,
    AdoptionLaneOut,
    AdoptionStageOut,
    AdoptionTaskOut,
    AdoptionTaskUpdateIn,
    AdoptionWorkflowOut,
    BlockerAggOut,
    BlockerDefOut,
    BlockerIn,
    BlockerStateOut,
    ChecklistItemOut,
    ChecklistStateOut,
    ChecklistToggleIn,
    DashboardOut,
    FunnelBucketOut,
    OkOut,
    PlaybookOut,
    ResourceClickIn,
    ResourceOut,
    StageAdvanceIn,
    StageOut,
    StalledUseCaseOut,
    TopResourceOut,
    UseCaseDetailOut,
    UseCaseIn,
    UseCaseListOut,
    VersionOut,
)

router = create_router()


# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------


def _uid() -> str:
    return uuid.uuid4().hex


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _actor(user_ws) -> str:
    try:
        return user_ws.current_user.me().user_name or ""
    except Exception:
        return ""


_BLOCKER_NAME = {b["key"]: b["name"] for b in playbook.BLOCKERS}
_RESOURCE_META = {r["key"]: r for r in playbook.RESOURCES}


def _progress_pct(session: Session, use_case_id: str, stage: str) -> int:
    """Percent of the current stage's checklist items marked done."""
    total = playbook.checklist_count_for_stage(stage)
    if total == 0:
        return 100
    rows = session.exec(
        select(ChecklistProgress).where(
            ChecklistProgress.use_case_id == use_case_id,
            ChecklistProgress.stage == stage,
            ChecklistProgress.done == True,  # noqa: E712
        )
    ).all()
    stage_item_keys = {c["key"] for c in playbook.CHECKLIST if c["stage"] == stage}
    done = sum(1 for r in rows if r.item_key in stage_item_keys)
    return round(100 * done / total)


def _open_blockers(session: Session, use_case_id: str) -> int:
    rows = session.exec(
        select(Blocker).where(
            Blocker.use_case_id == use_case_id,
            Blocker.resolved == False,  # noqa: E712
        )
    ).all()
    return len(rows)


_GROUP_NAME = {g["key"]: g["name"] for g in account_plan.GROUPS}
_CLOSED_ISSUE_STATUSES = {"resolved", "will_not_solve"}


def _issue_is_open(status: str) -> bool:
    return status.lower() not in _CLOSED_ISSUE_STATUSES


def _open_issue_count(session: Session, account_id: str) -> int:
    rows = session.exec(
        select(AccountIssue).where(AccountIssue.account_id == account_id)
    ).all()
    return sum(1 for r in rows if _issue_is_open(r.status))


def _account_facts(session: Session, account: Account) -> account_plan.AccountFacts:
    """Gather the signals used to customize an account's action plan."""
    use_cases = session.exec(
        select(UseCase).where(UseCase.account_id == account.id)
    ).all()
    max_order = -1
    for uc in use_cases:
        max_order = max(max_order, account_plan.STAGE_ORDER.get(uc.stage, -1))
    open_blockers = sum(_open_blockers(session, uc.id) for uc in use_cases)
    return account_plan.AccountFacts(
        pp_enabled=account.pp_status in ("on", "on_default"),
        aim_status=account.aim_status,
        aim_ws_enabled=account.aim_ws_enabled,
        provisioning_status=account.provisioning_status,
        provisioning_ws_enabled=account.provisioning_ws_enabled,
        uc_count=len(use_cases),
        max_stage_order=max_order,
        genie_active=account.genie_active,
        open_issues=_open_issue_count(session, account.id),
        open_blockers=open_blockers,
    )


def _build_plan(
    session: Session, account: Account, facts: account_plan.AccountFacts | None = None
) -> tuple[list[AccountPlanItemOut], int]:
    """Resolve the per-account action plan against its signals + stored manual state,
    and the readiness % over APPLICABLE items only."""
    if facts is None:
        facts = _account_facts(session, account)
    manual = {
        p.item_key: p
        for p in session.exec(
            select(AccountPlanItem).where(AccountPlanItem.account_id == account.id)
        ).all()
    }
    out: list[AccountPlanItemOut] = []
    applicable = 0
    done_count = 0
    for item in account_plan.ITEMS:
        row = manual.get(item["key"])
        m_done = row.done if row else False
        m_note = row.note if row else ""
        r = account_plan.resolve_item(item, facts, m_done, m_note)
        if r.applicable:
            applicable += 1
            if r.status == "done":
                done_count += 1
        out.append(
            AccountPlanItemOut(
                key=item["key"],
                group=item["group"],
                group_name=_GROUP_NAME.get(item["group"], item["group"]),
                label=item["label"],
                status=r.status,
                applicable=r.applicable,
                auto=r.auto,
                reason=r.reason,
                has_note=item["note"],
                done=r.status == "done",
                note=m_note,
            )
        )
    pct = round(100 * done_count / applicable) if applicable else 0
    return out, pct


def _readiness_pct(session: Session, account: Account) -> int:
    _, pct = _build_plan(session, account)
    return pct


def _avg_readiness(session: Session, accounts: Sequence[Account]) -> int:
    """Average readiness % across accounts using a few batched queries instead of
    resolving each account's plan individually — the per-account resolve was an N+1
    that made the Signals dashboard slow with ~500 accounts."""
    if not accounts:
        return 0
    use_cases = session.exec(select(UseCase)).all()
    open_blockers = session.exec(
        select(Blocker).where(Blocker.resolved == False)  # noqa: E712
    ).all()
    issues = session.exec(select(AccountIssue)).all()
    plan_rows = session.exec(select(AccountPlanItem)).all()

    ucs_by_acct: dict[str, list[UseCase]] = {}
    for uc in use_cases:
        ucs_by_acct.setdefault(uc.account_id, []).append(uc)
    uc_to_acct = {uc.id: uc.account_id for uc in use_cases}
    open_blk_by_acct: dict[str, int] = {}
    for b in open_blockers:
        aid = uc_to_acct.get(b.use_case_id)
        if aid:
            open_blk_by_acct[aid] = open_blk_by_acct.get(aid, 0) + 1
    open_iss_by_acct: dict[str, int] = {}
    for i in issues:
        if _issue_is_open(i.status):
            open_iss_by_acct[i.account_id] = open_iss_by_acct.get(i.account_id, 0) + 1
    manual_by_acct: dict[str, dict] = {}
    for p in plan_rows:
        manual_by_acct.setdefault(p.account_id, {})[p.item_key] = p

    total = 0
    for a in accounts:
        ucs = ucs_by_acct.get(a.id, [])
        max_order = -1
        for uc in ucs:
            max_order = max(max_order, account_plan.STAGE_ORDER.get(uc.stage, -1))
        facts = account_plan.AccountFacts(
            pp_enabled=a.pp_status in ("on", "on_default"),
            aim_status=a.aim_status,
            aim_ws_enabled=a.aim_ws_enabled,
            provisioning_status=a.provisioning_status,
            provisioning_ws_enabled=a.provisioning_ws_enabled,
            uc_count=len(ucs),
            max_stage_order=max_order,
            genie_active=a.genie_active,
            open_issues=open_iss_by_acct.get(a.id, 0),
            open_blockers=open_blk_by_acct.get(a.id, 0),
        )
        manual = manual_by_acct.get(a.id, {})
        applicable = 0
        done = 0
        for item in account_plan.ITEMS:
            row = manual.get(item["key"])
            r = account_plan.resolve_item(
                item, facts, row.done if row else False, row.note if row else ""
            )
            if r.applicable:
                applicable += 1
                if r.status == "done":
                    done += 1
        total += round(100 * done / applicable) if applicable else 0
    return round(total / len(accounts))


def _build_adoption(session: Session, account: Account) -> AdoptionWorkflowOut:
    """The Adoption Workflow matrix for one account: static stage/lane/task content
    merged with the account's stored per-task status + note."""
    stored = {
        s.task_key: s
        for s in session.exec(
            select(AdoptionTaskState).where(
                AdoptionTaskState.account_id == account.id
            )
        ).all()
    }
    tasks = [
        AdoptionTaskOut(
            key=t["key"],
            stage=t["stage"],
            lane=t["lane"],
            label=t["label"],
            status=(stored[t["key"]].status if t["key"] in stored
                    else adoption_workflow.DEFAULT_STATUS),
            note=stored[t["key"]].note if t["key"] in stored else "",
        )
        for t in adoption_workflow.TASKS
    ]
    return AdoptionWorkflowOut(
        stages=[AdoptionStageOut(**s) for s in adoption_workflow.STAGES],
        lanes=[AdoptionLaneOut(**ln) for ln in adoption_workflow.LANES],
        tasks=tasks,
    )


# --------------------------------------------------------------------------------------
# Meta
# --------------------------------------------------------------------------------------


@router.get("/version", response_model=VersionOut, operation_id="version")
async def version():
    return VersionOut.from_metadata()


@router.get("/current-user", response_model=UserOut, operation_id="currentUser")
def me(user_ws: Dependencies.UserClient):
    return user_ws.current_user.me()


# --------------------------------------------------------------------------------------
# Playbook content (static)
# --------------------------------------------------------------------------------------


@router.get("/playbook", response_model=PlaybookOut, operation_id="getPlaybook")
def get_playbook():
    return PlaybookOut(
        version=playbook.PLAYBOOK_VERSION,
        stages=[StageOut(**s) for s in playbook.STAGES],
        checklist=[ChecklistItemOut(**c) for c in playbook.CHECKLIST],
        blockers=[BlockerDefOut(**b) for b in playbook.BLOCKERS],
        resources=[ResourceOut(**r) for r in playbook.RESOURCES],
    )


# --------------------------------------------------------------------------------------
# Accounts
# --------------------------------------------------------------------------------------


@router.get("/accounts", response_model=list[AccountOut], operation_id="listAccounts")
def list_accounts(session: Dependencies.Session):
    accounts = session.exec(select(Account)).all()
    use_cases = session.exec(select(UseCase)).all()
    open_blockers = session.exec(
        select(Blocker).where(Blocker.resolved == False)  # noqa: E712
    ).all()
    uc_account = {uc.id: uc.account_id for uc in use_cases}
    counts: dict[str, int] = {}
    dbus: dict[str, float] = {}
    for uc in use_cases:
        counts[uc.account_id] = counts.get(uc.account_id, 0) + 1
        dbus[uc.account_id] = dbus.get(uc.account_id, 0.0) + uc.estimated_monthly_dbus
    blockers_by_account: dict[str, int] = {}
    for b in open_blockers:
        aid = uc_account.get(b.use_case_id)
        if aid:
            blockers_by_account[aid] = blockers_by_account.get(aid, 0) + 1
    # Batch open-issue counts (avoid N+1).
    open_issues_by_account: dict[str, int] = {}
    for iss in session.exec(select(AccountIssue)).all():
        if _issue_is_open(iss.status):
            open_issues_by_account[iss.account_id] = (
                open_issues_by_account.get(iss.account_id, 0) + 1
            )
    return [
        AccountOut(
            id=a.id,
            name=a.name,
            sub_vertical=a.sub_vertical,
            ae_owner=a.ae_owner,
            sa_owner=a.sa_owner,
            dsa_owner=a.dsa_owner,
            arr=a.arr,
            pp_status=a.pp_status,
            pp_enforce=a.pp_enforce,
            ws_total=a.ws_total,
            ws_pp_on=a.ws_pp_on,
            ws_pp_off=a.ws_pp_off,
            aim_status=a.aim_status,
            aim_ws_enabled=a.aim_ws_enabled,
            provisioning_status=a.provisioning_status,
            provisioning_ws_enabled=a.provisioning_ws_enabled,
            provisioning_ws_total=a.provisioning_ws_total,
            genie_active=a.genie_active,
            # Not shown on the account lookup; skip the per-account plan resolve
            # (it was an N+1 that ran several Lakebase queries per account).
            readiness_pct=0,
            open_issues=open_issues_by_account.get(a.id, 0),
            created_at=a.created_at,
            use_case_count=counts.get(a.id, 0),
            open_blockers=blockers_by_account.get(a.id, 0),
            monthly_dbus=round(dbus.get(a.id, 0.0), 2),
        )
        for a in sorted(accounts, key=lambda x: x.name.lower())
    ]


@router.post("/accounts", response_model=AccountOut, operation_id="createAccount")
def create_account(
    body: AccountIn, session: Dependencies.Session, user_ws: Dependencies.UserClient
):
    account = Account(
        id=_uid(),
        name=body.name,
        sub_vertical=body.sub_vertical,
        ae_owner=body.ae_owner,
        sa_owner=body.sa_owner,
        dsa_owner=body.dsa_owner,
        created_by=_actor(user_ws),
    )
    session.add(account)
    session.commit()
    session.refresh(account)
    return AccountOut(
        id=account.id,
        name=account.name,
        sub_vertical=account.sub_vertical,
        ae_owner=account.ae_owner,
        sa_owner=account.sa_owner,
        dsa_owner=account.dsa_owner,
        created_at=account.created_at,
        use_case_count=0,
    )


@router.get(
    "/accounts/{account_id}",
    response_model=AccountDetailOut,
    operation_id="getAccount",
)
def get_account(account_id: str, session: Dependencies.Session):
    acct = session.get(Account, account_id)
    if acct is None:
        raise HTTPException(status_code=404, detail="Account not found")
    use_cases = session.exec(
        select(UseCase).where(UseCase.account_id == account_id)
    ).all()
    uc_out: list[UseCaseListOut] = []
    open_total = 0
    dbus_total = 0.0
    for uc in sorted(use_cases, key=lambda x: x.updated_at, reverse=True):
        ob = _open_blockers(session, uc.id)
        open_total += ob
        dbus_total += uc.estimated_monthly_dbus
        uc_out.append(
            UseCaseListOut(
                id=uc.id,
                account_id=uc.account_id,
                account_name=acct.name,
                title=uc.title,
                stage=uc.stage,
                estimated_monthly_dbus=uc.estimated_monthly_dbus,
                updated_at=uc.updated_at,
                open_blockers=ob,
                progress_pct=_progress_pct(session, uc.id, uc.stage),
            )
        )
    plan_items, plan_pct = _build_plan(session, acct)
    # Genie-related issues (all severities), open first then by revenue impact.
    issue_rows = session.exec(
        select(AccountIssue).where(AccountIssue.account_id == account_id)
    ).all()
    _sev_rank = {"blocked": 0, "risk": 1, "friction": 2, "nice_to_have": 3}
    issues_out = [
        AccountIssueOut(
            id=i.id,
            display_id=i.display_id,
            title=i.title,
            severity=i.severity,
            status=i.status,
            product_area=i.product_area,
            revenue_impact=i.revenue_impact,
            investigator=i.investigator,
            is_open=_issue_is_open(i.status),
        )
        for i in sorted(
            issue_rows,
            key=lambda x: (
                not _issue_is_open(x.status),
                _sev_rank.get(x.severity, 9),
                -x.revenue_impact,
            ),
        )
    ]
    return AccountDetailOut(
        id=acct.id,
        name=acct.name,
        sub_vertical=acct.sub_vertical,
        ae_owner=acct.ae_owner,
        sa_owner=acct.sa_owner,
        dsa_owner=acct.dsa_owner,
        arr=acct.arr,
        pp_status=acct.pp_status,
        pp_enforce=acct.pp_enforce,
        ws_total=acct.ws_total,
        ws_pp_on=acct.ws_pp_on,
        ws_pp_off=acct.ws_pp_off,
        aim_status=acct.aim_status,
        aim_ws_enabled=acct.aim_ws_enabled,
        provisioning_status=acct.provisioning_status,
        provisioning_ws_enabled=acct.provisioning_ws_enabled,
        provisioning_ws_total=acct.provisioning_ws_total,
        genie_active=acct.genie_active,
        readiness_pct=plan_pct,
        created_at=acct.created_at,
        open_blockers=open_total,
        monthly_dbus=round(dbus_total, 2),
        use_cases=uc_out,
        plan=plan_items,
        issues=issues_out,
        adoption=_build_adoption(session, acct),
    )


@router.post(
    "/accounts/{account_id}/adoption",
    response_model=AccountDetailOut,
    operation_id="updateAdoptionTask",
)
def update_adoption_task(
    account_id: str,
    body: AdoptionTaskUpdateIn,
    session: Dependencies.Session,
    user_ws: Dependencies.UserClient,
):
    acct = session.get(Account, account_id)
    if acct is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if not adoption_workflow.is_valid_task(body.task_key):
        raise HTTPException(status_code=400, detail="Unknown adoption task")
    if body.status is not None and not adoption_workflow.is_valid_status(body.status):
        raise HTTPException(status_code=400, detail="Invalid status")

    existing = session.exec(
        select(AdoptionTaskState).where(
            AdoptionTaskState.account_id == account_id,
            AdoptionTaskState.task_key == body.task_key,
        )
    ).first()
    if existing is None:
        existing = AdoptionTaskState(
            id=_uid(), account_id=account_id, task_key=body.task_key
        )
    new_status = body.status if body.status is not None else existing.status
    new_note = body.note if body.note is not None else existing.note
    changed = (new_status != existing.status) or (new_note != existing.note)
    if body.status is not None:
        existing.status = body.status
    if body.note is not None:
        existing.note = body.note
    now = _utcnow()
    actor = _actor(user_ws)
    existing.updated_at = now
    existing.updated_by = actor
    session.add(existing)
    if changed:
        session.add(
            AdoptionTaskHistory(
                id=_uid(), account_id=account_id, task_key=body.task_key,
                status=new_status, note=new_note, changed_at=now, changed_by=actor,
            )
        )
    session.commit()
    return get_account(account_id, session)


@router.post(
    "/accounts/{account_id}/adoption/save",
    response_model=AccountDetailOut,
    operation_id="saveAdoptionTasks",
)
def save_adoption_tasks(
    account_id: str,
    body: AdoptionBulkSaveIn,
    session: Dependencies.Session,
    user_ws: Dependencies.UserClient,
):
    """Persist the whole Adoption Workflow questionnaire in one request (Save button)."""
    acct = session.get(Account, account_id)
    if acct is None:
        raise HTTPException(status_code=404, detail="Account not found")

    existing = {
        s.task_key: s
        for s in session.exec(
            select(AdoptionTaskState).where(
                AdoptionTaskState.account_id == account_id
            )
        ).all()
    }
    actor = _actor(user_ws)
    now = _utcnow()
    for item in body.items:
        if not adoption_workflow.is_valid_task(item.task_key):
            continue  # ignore stray keys rather than failing the whole save
        if item.status is not None and not adoption_workflow.is_valid_status(item.status):
            raise HTTPException(status_code=400, detail=f"Invalid status: {item.status}")
        row = existing.get(item.task_key)
        if row is None:
            row = AdoptionTaskState(
                id=_uid(), account_id=account_id, task_key=item.task_key
            )
            existing[item.task_key] = row
        new_status = item.status if item.status is not None else row.status
        new_note = item.note if item.note is not None else row.note
        # Only log history when something actually changed (avoid noise from Save
        # re-writing untouched tasks).
        changed = (new_status != row.status) or (new_note != row.note)
        if item.status is not None:
            row.status = item.status
        if item.note is not None:
            row.note = item.note
        row.updated_at = now
        row.updated_by = actor
        session.add(row)
        if changed:
            session.add(
                AdoptionTaskHistory(
                    id=_uid(), account_id=account_id, task_key=item.task_key,
                    status=new_status, note=new_note, changed_at=now, changed_by=actor,
                )
            )
    session.commit()
    return get_account(account_id, session)


@router.get(
    "/accounts/{account_id}/adoption/history",
    response_model=list[AdoptionHistoryEntryOut],
    operation_id="getAdoptionHistory",
)
def adoption_history(account_id: str, session: Dependencies.Session):
    """Append-only edit history for an account's Adoption Workflow tasks, newest first."""
    labels = {t["key"]: t["label"] for t in adoption_workflow.TASKS}
    rows = session.exec(
        select(AdoptionTaskHistory).where(
            AdoptionTaskHistory.account_id == account_id
        )
    ).all()
    rows = sorted(rows, key=lambda r: r.changed_at, reverse=True)
    return [
        AdoptionHistoryEntryOut(
            task_key=r.task_key,
            task_label=labels.get(r.task_key, r.task_key),
            status=r.status,
            note=r.note,
            changed_at=r.changed_at,
            changed_by=r.changed_by,
        )
        for r in rows
    ]


@router.post(
    "/accounts/{account_id}/plan",
    response_model=AccountDetailOut,
    operation_id="toggleAccountPlanItem",
)
def toggle_account_plan_item(
    account_id: str,
    body: AccountPlanToggleIn,
    session: Dependencies.Session,
    user_ws: Dependencies.UserClient,
):
    acct = session.get(Account, account_id)
    if acct is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if not account_plan.is_valid_item(body.item_key):
        raise HTTPException(status_code=400, detail="Unknown plan item")
    item = next(i for i in account_plan.ITEMS if i["key"] == body.item_key)
    # An item is editable only if, for THIS account, the resolver leaves it manual
    # (auto=False) and applicable — e.g. Security Review is editable only when PP is
    # off; auto/N-A items are read-only.
    facts = _account_facts(session, acct)
    resolved = account_plan.resolve_item(item, facts, False, "")
    if resolved.auto or not resolved.applicable:
        raise HTTPException(status_code=400, detail="Item is not editable")

    existing = session.exec(
        select(AccountPlanItem).where(
            AccountPlanItem.account_id == account_id,
            AccountPlanItem.item_key == body.item_key,
        )
    ).first()
    actor = _actor(user_ws)
    if existing is None:
        existing = AccountPlanItem(
            id=_uid(), account_id=account_id, item_key=body.item_key
        )
    if body.done is not None:
        existing.done = body.done
    if body.note is not None:
        existing.note = body.note
    existing.updated_at = _utcnow()
    existing.updated_by = actor
    session.add(existing)
    session.commit()
    return get_account(account_id, session)


# --------------------------------------------------------------------------------------
# Use cases
# --------------------------------------------------------------------------------------


@router.get(
    "/use-cases", response_model=list[UseCaseListOut], operation_id="listUseCases"
)
def list_use_cases(session: Dependencies.Session):
    use_cases = session.exec(select(UseCase)).all()
    accounts = {a.id: a for a in session.exec(select(Account)).all()}
    out: list[UseCaseListOut] = []
    for uc in use_cases:
        acct = accounts.get(uc.account_id)
        out.append(
            UseCaseListOut(
                id=uc.id,
                account_id=uc.account_id,
                account_name=acct.name if acct else "(unknown)",
                title=uc.title,
                stage=uc.stage,
                estimated_monthly_dbus=uc.estimated_monthly_dbus,
                updated_at=uc.updated_at,
                open_blockers=_open_blockers(session, uc.id),
                progress_pct=_progress_pct(session, uc.id, uc.stage),
            )
        )
    return sorted(out, key=lambda x: x.updated_at, reverse=True)


@router.post("/use-cases", response_model=UseCaseDetailOut, operation_id="createUseCase")
def create_use_case(
    body: UseCaseIn, session: Dependencies.Session, user_ws: Dependencies.UserClient
):
    acct = session.get(Account, body.account_id)
    if acct is None:
        raise HTTPException(status_code=404, detail="Account not found")
    actor = _actor(user_ws)
    uc = UseCase(
        id=_uid(),
        account_id=body.account_id,
        title=body.title,
        description=body.description,
        stage="prereqs",
        estimated_monthly_dbus=body.estimated_monthly_dbus,
        created_by=actor,
    )
    session.add(uc)
    # Flush so the use_case row exists before the stage_transition FK references it.
    session.flush()
    # Record the initial stage as a transition so the funnel counts it.
    session.add(
        StageTransition(
            id=_uid(),
            use_case_id=uc.id,
            from_stage="",
            to_stage="prereqs",
            created_by=actor,
        )
    )
    session.commit()
    session.refresh(uc)
    return _build_detail(session, uc, acct)


@router.get(
    "/use-cases/{use_case_id}",
    response_model=UseCaseDetailOut,
    operation_id="getUseCase",
)
def get_use_case(use_case_id: str, session: Dependencies.Session):
    uc = session.get(UseCase, use_case_id)
    if uc is None:
        raise HTTPException(status_code=404, detail="Use case not found")
    acct = session.get(Account, uc.account_id)
    return _build_detail(session, uc, acct)


def _build_detail(
    session: Session, uc: UseCase, account: Account | None
) -> UseCaseDetailOut:
    # Map existing progress rows by item_key.
    progress = {
        p.item_key: p
        for p in session.exec(
            select(ChecklistProgress).where(ChecklistProgress.use_case_id == uc.id)
        ).all()
    }
    checklist = [
        ChecklistStateOut(
            item_key=c["key"],
            stage=c["stage"],
            lane=c["lane"],
            label=c["label"],
            done=progress[c["key"]].done if c["key"] in progress else False,
        )
        for c in playbook.CHECKLIST
    ]
    blocker_rows = session.exec(
        select(Blocker).where(Blocker.use_case_id == uc.id)
    ).all()
    blockers = [
        BlockerStateOut(
            id=b.id,
            category_key=b.category_key,
            category_name=_BLOCKER_NAME.get(b.category_key, b.category_key),
            stage=b.stage,
            note=b.note,
            resolved=b.resolved,
            created_at=b.created_at,
        )
        for b in sorted(blocker_rows, key=lambda x: x.created_at, reverse=True)
    ]
    return UseCaseDetailOut(
        id=uc.id,
        account_id=uc.account_id,
        account_name=account.name if account else "(unknown)",
        sub_vertical=account.sub_vertical if account else "",
        ae_owner=account.ae_owner if account else "",
        sa_owner=account.sa_owner if account else "",
        dsa_owner=account.dsa_owner if account else "",
        pp_status=account.pp_status if account else "unknown",
        pp_enforce=account.pp_enforce if account else "unknown",
        title=uc.title,
        description=uc.description,
        stage=uc.stage,
        estimated_monthly_dbus=uc.estimated_monthly_dbus,
        created_at=uc.created_at,
        updated_at=uc.updated_at,
        checklist=checklist,
        blockers=blockers,
        progress_pct=_progress_pct(session, uc.id, uc.stage),
    )


# --------------------------------------------------------------------------------------
# Use-case mutations (the signal capture)
# --------------------------------------------------------------------------------------


@router.post(
    "/use-cases/{use_case_id}/checklist",
    response_model=UseCaseDetailOut,
    operation_id="toggleChecklistItem",
)
def toggle_checklist(
    use_case_id: str,
    body: ChecklistToggleIn,
    session: Dependencies.Session,
    user_ws: Dependencies.UserClient,
):
    uc = session.get(UseCase, use_case_id)
    if uc is None:
        raise HTTPException(status_code=404, detail="Use case not found")
    if not playbook.is_valid_checklist_item(body.item_key):
        raise HTTPException(status_code=400, detail="Unknown checklist item")

    item = next(c for c in playbook.CHECKLIST if c["key"] == body.item_key)
    existing = session.exec(
        select(ChecklistProgress).where(
            ChecklistProgress.use_case_id == use_case_id,
            ChecklistProgress.item_key == body.item_key,
        )
    ).first()
    actor = _actor(user_ws)
    if existing is None:
        session.add(
            ChecklistProgress(
                id=_uid(),
                use_case_id=use_case_id,
                item_key=body.item_key,
                stage=item["stage"],
                lane=item["lane"],
                done=body.done,
                updated_by=actor,
            )
        )
    else:
        existing.done = body.done
        existing.updated_at = _utcnow()
        existing.updated_by = actor
        session.add(existing)
    uc.updated_at = _utcnow()
    session.add(uc)
    session.commit()
    session.refresh(uc)
    acct = session.get(Account, uc.account_id)
    return _build_detail(session, uc, acct)


@router.post(
    "/use-cases/{use_case_id}/stage",
    response_model=UseCaseDetailOut,
    operation_id="advanceStage",
)
def advance_stage(
    use_case_id: str,
    body: StageAdvanceIn,
    session: Dependencies.Session,
    user_ws: Dependencies.UserClient,
):
    uc = session.get(UseCase, use_case_id)
    if uc is None:
        raise HTTPException(status_code=404, detail="Use case not found")
    if not playbook.is_valid_stage(body.to_stage):
        raise HTTPException(status_code=400, detail="Unknown stage")

    from_stage = uc.stage
    if from_stage != body.to_stage:
        session.add(
            StageTransition(
                id=_uid(),
                use_case_id=use_case_id,
                from_stage=from_stage,
                to_stage=body.to_stage,
                created_by=_actor(user_ws),
            )
        )
        uc.stage = body.to_stage
    uc.updated_at = _utcnow()
    session.add(uc)
    session.commit()
    session.refresh(uc)
    acct = session.get(Account, uc.account_id)
    return _build_detail(session, uc, acct)


@router.post(
    "/use-cases/{use_case_id}/blockers",
    response_model=UseCaseDetailOut,
    operation_id="flagBlocker",
)
def flag_blocker(
    use_case_id: str,
    body: BlockerIn,
    session: Dependencies.Session,
    user_ws: Dependencies.UserClient,
):
    uc = session.get(UseCase, use_case_id)
    if uc is None:
        raise HTTPException(status_code=404, detail="Use case not found")
    if not playbook.is_valid_blocker(body.category_key):
        raise HTTPException(status_code=400, detail="Unknown blocker category")
    session.add(
        Blocker(
            id=_uid(),
            use_case_id=use_case_id,
            category_key=body.category_key,
            stage=uc.stage,
            note=body.note,
            created_by=_actor(user_ws),
        )
    )
    uc.updated_at = _utcnow()
    session.add(uc)
    session.commit()
    session.refresh(uc)
    acct = session.get(Account, uc.account_id)
    return _build_detail(session, uc, acct)


@router.post(
    "/blockers/{blocker_id}/resolve",
    response_model=UseCaseDetailOut,
    operation_id="resolveBlocker",
)
def resolve_blocker(blocker_id: str, session: Dependencies.Session):
    blocker = session.get(Blocker, blocker_id)
    if blocker is None:
        raise HTTPException(status_code=404, detail="Blocker not found")
    blocker.resolved = True
    blocker.resolved_at = _utcnow()
    session.add(blocker)
    uc = session.get(UseCase, blocker.use_case_id)
    if uc is None:
        session.commit()
        raise HTTPException(status_code=404, detail="Use case not found")
    uc.updated_at = _utcnow()
    session.add(uc)
    session.commit()
    session.refresh(uc)
    acct = session.get(Account, uc.account_id)
    return _build_detail(session, uc, acct)


@router.post("/resource-clicks", response_model=OkOut, operation_id="logResourceClick")
def log_resource_click(
    body: ResourceClickIn,
    session: Dependencies.Session,
    user_ws: Dependencies.UserClient,
):
    if not playbook.is_valid_resource(body.resource_key):
        raise HTTPException(status_code=400, detail="Unknown resource")
    session.add(
        ResourceClick(
            id=_uid(),
            use_case_id=body.use_case_id,
            resource_key=body.resource_key,
            stage=body.stage,
            created_by=_actor(user_ws),
        )
    )
    session.commit()
    return OkOut()


# --------------------------------------------------------------------------------------
# Dashboard (aggregate signal)
# --------------------------------------------------------------------------------------


@router.get("/dashboard", response_model=DashboardOut, operation_id="getDashboard")
def get_dashboard(session: Dependencies.Session):
    accounts = session.exec(select(Account)).all()
    use_cases = session.exec(select(UseCase)).all()
    blockers = session.exec(select(Blocker)).all()
    clicks = session.exec(select(ResourceClick)).all()
    account_names = {a.id: a.name for a in accounts}

    # Funnel: count use cases (and sum DBU value) currently at each stage.
    stage_counts: dict[str, int] = {}
    stage_dbus: dict[str, float] = {}
    for uc in use_cases:
        stage_counts[uc.stage] = stage_counts.get(uc.stage, 0) + 1
        stage_dbus[uc.stage] = stage_dbus.get(uc.stage, 0.0) + uc.estimated_monthly_dbus
    funnel = [
        FunnelBucketOut(
            stage=s["key"],
            code=s["code"],
            name=s["name"],
            count=stage_counts.get(s["key"], 0),
            monthly_dbus=round(stage_dbus.get(s["key"], 0.0), 2),
        )
        for s in playbook.STAGES
    ]

    # Blockers by category.
    agg: dict[str, dict[str, int]] = {}
    for b in blockers:
        bucket = agg.setdefault(b.category_key, {"open": 0, "resolved": 0})
        bucket["resolved" if b.resolved else "open"] += 1
    blockers_by_category = [
        BlockerAggOut(
            category_key=bk["key"],
            category_name=bk["name"],
            open_count=agg.get(bk["key"], {}).get("open", 0),
            resolved_count=agg.get(bk["key"], {}).get("resolved", 0),
        )
        for bk in playbook.BLOCKERS
    ]

    # Stalled: not at U6, no update in 14+ days.
    now = _utcnow()
    stalled: list[StalledUseCaseOut] = []
    for uc in use_cases:
        if uc.stage == "u6":
            continue
        updated = uc.updated_at
        if updated.tzinfo is None:
            updated = updated.replace(tzinfo=timezone.utc)
        days = (now - updated).days
        if days >= 14:
            stalled.append(
                StalledUseCaseOut(
                    id=uc.id,
                    title=uc.title,
                    account_name=account_names.get(uc.account_id, "(unknown)"),
                    stage=uc.stage,
                    days_since_update=days,
                )
            )
    stalled.sort(key=lambda x: x.days_since_update, reverse=True)

    # Top resources by clicks.
    click_counts: dict[str, int] = {}
    for c in clicks:
        click_counts[c.resource_key] = click_counts.get(c.resource_key, 0) + 1
    top_resources = [
        TopResourceOut(
            resource_key=k,
            label=_RESOURCE_META.get(k, {}).get("label", k),
            bucket=_RESOURCE_META.get(k, {}).get("bucket", ""),
            clicks=v,
        )
        for k, v in sorted(click_counts.items(), key=lambda x: x[1], reverse=True)
    ][:10]

    open_blocker_total = sum(1 for b in blockers if not b.resolved)
    live_total = sum(1 for uc in use_cases if uc.stage == "u6")
    total_dbus = round(sum(uc.estimated_monthly_dbus for uc in use_cases), 2)
    pp_off_total = sum(1 for a in accounts if a.pp_status == "off")
    # "Provisioning off" = no user provisioning at all (neither AIM nor SCIM).
    aim_off_total = sum(1 for a in accounts if a.provisioning_status == "off")
    all_issues = session.exec(select(AccountIssue)).all()
    open_issue_total = sum(1 for i in all_issues if _issue_is_open(i.status))
    accounts_with_issues = len(
        {i.account_id for i in all_issues if _issue_is_open(i.status)}
    )
    avg_readiness = _avg_readiness(session, accounts)

    return DashboardOut(
        total_accounts=len(accounts),
        total_use_cases=len(use_cases),
        open_blockers=open_blocker_total,
        live_use_cases=live_total,
        total_monthly_dbus=total_dbus,
        pp_off_accounts=pp_off_total,
        aim_off_accounts=aim_off_total,
        avg_readiness_pct=avg_readiness,
        open_issues=open_issue_total,
        accounts_with_issues=accounts_with_issues,
        funnel=funnel,
        blockers_by_category=blockers_by_category,
        stalled=stalled[:10],
        top_resources=top_resources,
    )
