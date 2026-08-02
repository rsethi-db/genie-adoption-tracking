"""
SQLModel table definitions — persisted to Lakebase (Databricks managed Postgres).

These are the *signal* tables. Playbook content itself (stages, checklist items,
blockers, resources) lives in code (`playbook.py`), not the DB — only what account
teams actually do is captured here so it can be aggregated for MBR reporting and
synced to Unity Catalog for AI/BI + Genie.

Tables:
  account            — a customer account + owning AE/SA + current stage
  use_case           — a Genie use case being driven through the playbook
  checklist_progress — one row per (use_case, checklist_item); the core "what got done" signal
  blocker            — a flagged blocker on a use case (category, resolved?)
  stage_transition   — every stage advance/change; drives the funnel
  resource_click     — which go/ resources get pulled; engagement signal

All tables are created on app startup via `SQLModel.metadata.create_all` (see
core/lakebase.py `initialize_models`).
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel  # noqa: F401  (re-exported for scripts)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Account(SQLModel, table=True):
    __tablename__ = "gat_account"

    id: str = Field(primary_key=True)
    name: str = Field(index=True)
    sub_vertical: str = Field(default="")
    ae_owner: str = Field(default="")
    sa_owner: str = Field(default="")
    dsa_owner: str = Field(default="")
    arr: float = Field(default=0.0)
    # Partner-Powered AI status (drives Genie eligibility). "on" | "off" | "unknown".
    pp_status: str = Field(default="unknown")
    # Enforce setting: "on" | "off" | "unknown".
    pp_enforce: str = Field(default="unknown")
    # Running-workspace Partner-Powered AI counts (effective per-workspace value).
    ws_total: int = Field(default=0)
    ws_pp_on: int = Field(default=0)
    ws_pp_off: int = Field(default=0)
    # Automatic Identity Management: "on" (all ws) | "partial" | "off" | "unknown".
    aim_status: str = Field(default="unknown")
    aim_ws_enabled: int = Field(default=0)
    # User provisioning = AIM OR SCIM (the Genie-ready criterion). Broader than AIM:
    # "on"/"partial"/"off"/"unknown" from the share of workspaces with any provisioning.
    provisioning_status: str = Field(default="unknown")
    provisioning_ws_enabled: int = Field(default=0)
    # Denominator provisioning_status was derived against (the Genie-ready report's own
    # total_workspaces) — kept separate from ws_total so the banner fraction is consistent.
    provisioning_ws_total: int = Field(default=0)
    # True if the account consumed Genie in the trailing 2 years (active footprint).
    genie_active: bool = Field(default=False)
    # Genie-Ready tier from GTM (rpt_account_genie_ready): green | yellow | red | unknown.
    # A GTM signal, distinct from the team-filled workflow readiness %.
    readiness_tier: str = Field(default="unknown", index=True)
    # Genie-specific spend, trailing 90 days (USD), from fins_data.genie_dbu_dollars.
    genie_spend_90d: float = Field(default=0.0)
    # Genie-specific spend, trailing 30 days (USD) — the T30D figure the logfood
    # dashboard's PP-off page reports (fins_data.genie_dbu_dollars, last 30 days).
    genie_dollars_t30d: float = Field(default=0.0)
    # Active Genie spaces (data rooms with usage in the trailing 30 days), summed
    # across the account's workspaces (metric_store.fct_data_room_messages_daily).
    active_genie_spaces: int = Field(default=0)
    created_at: datetime = Field(default_factory=_utcnow)
    created_by: str = Field(default="")


class UseCase(SQLModel, table=True):
    __tablename__ = "gat_use_case"

    id: str = Field(primary_key=True)
    account_id: str = Field(index=True, foreign_key="gat_account.id")
    title: str
    description: str = Field(default="")
    stage: str = Field(default="prereqs", index=True)
    estimated_monthly_dbus: float = Field(default=0.0)
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
    created_by: str = Field(default="")


class ChecklistProgress(SQLModel, table=True):
    __tablename__ = "gat_checklist_progress"

    id: str = Field(primary_key=True)
    use_case_id: str = Field(index=True, foreign_key="gat_use_case.id")
    item_key: str = Field(index=True)
    stage: str = Field(index=True)
    lane: str = Field(default="")
    done: bool = Field(default=False)
    updated_at: datetime = Field(default_factory=_utcnow)
    updated_by: str = Field(default="")


class Blocker(SQLModel, table=True):
    __tablename__ = "gat_blocker"

    id: str = Field(primary_key=True)
    use_case_id: str = Field(index=True, foreign_key="gat_use_case.id")
    category_key: str = Field(index=True)
    stage: str = Field(index=True)
    note: str = Field(default="")
    resolved: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=_utcnow)
    resolved_at: datetime | None = Field(default=None)
    created_by: str = Field(default="")


class StageTransition(SQLModel, table=True):
    __tablename__ = "gat_stage_transition"

    id: str = Field(primary_key=True)
    use_case_id: str = Field(index=True, foreign_key="gat_use_case.id")
    from_stage: str = Field(default="")
    to_stage: str = Field(index=True)
    created_at: datetime = Field(default_factory=_utcnow, index=True)
    created_by: str = Field(default="")


class AccountPlanItem(SQLModel, table=True):
    """Manual account-readiness action-plan progress (one row per account+item).
    Auto items (PP/AIM) are derived at read time and not stored here."""

    __tablename__ = "gat_account_plan_item"

    id: str = Field(primary_key=True)
    account_id: str = Field(index=True, foreign_key="gat_account.id")
    item_key: str = Field(index=True)
    done: bool = Field(default=False)
    note: str = Field(default="")
    updated_at: datetime = Field(default_factory=_utcnow)
    updated_by: str = Field(default="")


class AdoptionTaskState(SQLModel, table=True):
    """Per-account status + note for one Adoption Workflow task (stage × lane grid).
    Task identity (stage, lane, label) is static content in adoption_workflow.py;
    only the team-entered status/note is persisted here (one row per account+task).

    Created (unqualified) in `public` alongside the other `gat_*` tables: the `genie`
    schema does not exist in this workspace's Lakebase — the app's own `create_all`
    made every `gat_*` table in `public` (which is why the SP owns them and can ALTER
    them in migrations.py), and `search_path=genie,public` falls through to `public`.
    Pinning to `genie` was tried and crashed startup with `schema "genie" does not
    exist`, so it stays in `public`."""

    __tablename__ = "gat_adoption_task_state"

    id: str = Field(primary_key=True)
    account_id: str = Field(index=True, foreign_key="gat_account.id")
    task_key: str = Field(index=True)
    # not_initiated | na | in_progress | completed
    status: str = Field(default="not_initiated")
    note: str = Field(default="")
    updated_at: datetime = Field(default_factory=_utcnow)
    updated_by: str = Field(default="")


class AdoptionTaskHistory(SQLModel, table=True):
    """Append-only audit log — one row per change to an Adoption Workflow task, so the
    account team can see the full history (who changed what, when) rather than only the
    latest value in AdoptionTaskState. Written on every save; never updated or deleted.
    FK to gat_account (stable id) so the nightly refresh preserves it."""

    __tablename__ = "gat_adoption_task_history"

    id: str = Field(primary_key=True)
    account_id: str = Field(index=True, foreign_key="gat_account.id")
    task_key: str = Field(index=True)
    status: str = Field(default="")
    note: str = Field(default="")
    changed_at: datetime = Field(default_factory=_utcnow, index=True)
    changed_by: str = Field(default="")


class AccountIssue(SQLModel, table=True):
    """Genie-related Brickroad issues per account (all severities), synced from GTM.
    Read-only reference data (like use cases), not user-editable signal."""

    __tablename__ = "gat_account_issue"

    id: str = Field(primary_key=True)  # brickroad issue id
    account_id: str = Field(index=True, foreign_key="gat_account.id")
    display_id: str = Field(default="")
    title: str = Field(default="")
    severity: str = Field(default="", index=True)  # blocked|risk|friction|nice_to_have
    status: str = Field(default="", index=True)
    product_area: str = Field(default="")
    revenue_impact: float = Field(default=0.0)
    investigator: str = Field(default="")
    created_at: datetime | None = Field(default=None)
    synced_by: str = Field(default="")


class ResourceClick(SQLModel, table=True):
    __tablename__ = "gat_resource_click"

    id: str = Field(primary_key=True)
    use_case_id: str | None = Field(default=None, index=True)
    resource_key: str = Field(index=True)
    stage: str = Field(default="")
    created_at: datetime = Field(default_factory=_utcnow, index=True)
    created_by: str = Field(default="")


class GenieQuery(SQLModel, table=True):
    """One Ask-Genie turn: the user's question + Genie's answer, with who asked, when,
    and (optionally) which account it was scoped to. Powers the in-app chat history and
    a usage signal (what the field is asking / stuck on)."""

    __tablename__ = "gat_genie_query"

    id: str = Field(primary_key=True)
    conversation_id: str = Field(default="", index=True)
    account_id: str | None = Field(default=None, index=True)
    account_name: str = Field(default="")
    question: str = Field(default="")
    answer: str = Field(default="")
    asked_by: str = Field(default="", index=True)
    created_at: datetime = Field(default_factory=_utcnow, index=True)


class Campaign(SQLModel, table=True):
    """A leadership 'push' to account teams: a targeted ask with a clear call-to-action
    and deadline, aimed at a segment of accounts (e.g. PP AI off, no provisioning).

    Segment is a stored key (resolved to live accounts at read time, so a campaign
    stays accurate as signals change). Only the campaign definition is persisted here;
    delivery is via in-app feed + generated mailto/Slack drafts."""

    __tablename__ = "gat_campaign"

    id: str = Field(primary_key=True)
    title: str = Field(default="")
    ask: str = Field(default="")  # the body / context
    cta: str = Field(default="")  # the specific call to action
    segment: str = Field(default="all", index=True)  # segment key (see campaigns.py)
    sub_vertical: str = Field(default="")  # optional refinement when segment=sub_vertical
    deadline: str = Field(default="")  # ISO date string, optional
    priority: str = Field(default="normal")  # normal | high
    active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=_utcnow, index=True)
    created_by: str = Field(default="")
