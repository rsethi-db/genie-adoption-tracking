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

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel  # noqa: F401  (re-exported for scripts)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Account(SQLModel, table=True):
    __tablename__ = "gat_account"

    id: str = Field(primary_key=True)
    # SFDC account id — the stable GTM identity. Distinct accounts can share a display
    # name (e.g. CRA International, E&Y HQ), so the seed keys/dedupes by this, not name.
    # PK stays the internal uuid so existing FK'd user data (task states, plan, history)
    # is never re-parented.
    sfdc_account_id: str = Field(default="", index=True)
    # AMER Industries vertical (sales_subregion_level_1): FINS / MFG / PS / HLS.
    vertical: str = Field(default="FINS", index=True)
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
    # Open Security Authority Review blocker (from the "Genie Security Blockers" sheet).
    # Drives the "Complete your Security Authority Review" action on the account page.
    security_blocker: bool = Field(default=False, index=True)
    security_status: str = Field(default="")  # e.g. "3. Review Actively Engaged"
    # Genie "Activated Account" (GTM product-deep-dives definition): 200+ Genie BMAU for
    # 2 consecutive months AND AIM/SCIM enabled, measured at deployable level. A much
    # stricter bar than genie_active — from account_consumption_daily.genie_activated.
    genie_activated: bool = Field(default=False, index=True)
    # Genie-Ready tier from the GTM activation deep-dive (deployable_best_genie_ready_color;
    # matches the Product Deep Dives dashboard): green | yellow | red | unknown. A GTM
    # signal, distinct from the team-filled workflow readiness %.
    readiness_tier: str = Field(default="unknown", index=True)
    # The tier 28 days ago (…_28d_ago) — drives the 30-day tier change + moved-accounts.
    readiness_tier_prev: str = Field(default="unknown", index=True)
    # Genie-specific spend, trailing 90 days (USD), from fins_data.genie_dbu_dollars.
    genie_spend_90d: float = Field(default=0.0)
    # Genie-specific spend, trailing 30 days (USD) — the T30D figure the logfood
    # dashboard's PP-off page reports (fins_data.genie_dbu_dollars, last 30 days).
    genie_dollars_t30d: float = Field(default=0.0)
    # Standalone-Genie $DBU rolling-window sums (precomputed in account_consumption_daily):
    # trailing 7 / 28 / ~90 (t91d) days, as of the latest snapshot.
    genie_dbu_t7d: float = Field(default=0.0)
    genie_dbu_t28d: float = Field(default=0.0)
    genie_dbu_t90d: float = Field(default=0.0)
    # Daily standalone-Genie $DBU series over the last ~90 days, as [["YYYY-MM-DD", $], …]
    # (oldest→newest, only days with usage). Powers the account-page trend chart + the
    # Signals sparkline.
    genie_dbu_series: list = Field(default_factory=list, sa_column=Column(JSON))
    # Active Genie spaces (data rooms with usage in the trailing 30 days), summed
    # across the account's workspaces (metric_store.fct_data_room_messages_daily).
    active_genie_spaces: int = Field(default=0)
    # Est. pipeline $/mo — open-opportunity booking ARR / 12 (gtm_silver.opportunity_detail).
    est_pipeline_per_month: float = Field(default=0.0)
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
    # When this use case moved into its current stage (GTM stage_move_in_date). Drives
    # the funnel's per-stage 7d/30d flow-in metrics. Null for hand-created use cases.
    stage_move_in_date: datetime | None = Field(default=None)
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
    """Per-account status + note for one Genie Playbook task (stage × lane grid).
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
    account_name: str = Field(default="")
    task_key: str = Field(index=True)
    task_name: str = Field(default="")
    # position in the questionnaire — ORDER BY task_order == questionnaire order
    task_order: int = Field(default=0, index=True)
    # not_initiated | na | in_progress | completed | blocked
    status: str = Field(default="not_initiated")
    note: str = Field(default="")
    # "How many?" count for quantifiable tasks (demos, workshops, prototypes, hackathons)
    # once in progress / completed. 0 = not applicable / unset.
    count: int = Field(default=0)
    updated_at: datetime = Field(default_factory=_utcnow)
    updated_by: str = Field(default="")


class AdoptionTaskHistory(SQLModel, table=True):
    """Append-only audit log — one row per change to an Genie Playbook task, so the
    account team can see the full history (who changed what, when) rather than only the
    latest value in AdoptionTaskState. Written on every save; never updated or deleted.
    FK to gat_account (stable id) so the nightly refresh preserves it."""

    __tablename__ = "gat_adoption_task_history"

    id: str = Field(primary_key=True)
    account_id: str = Field(index=True, foreign_key="gat_account.id")
    account_name: str = Field(default="")
    task_key: str = Field(index=True)
    task_name: str = Field(default="")
    # position in the questionnaire — ORDER BY task_order == questionnaire order
    task_order: int = Field(default=0, index=True)
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


class Feedback(SQLModel, table=True):
    """In-app feedback left on the Feedback tab — good / bad / ugly, ideas, data gaps.
    Captured so the team sees it without relying only on email."""

    __tablename__ = "gat_feedback"

    id: str = Field(primary_key=True)
    category: str = Field(default="idea")  # good | bad | ugly | bug | data_gap | idea
    message: str = Field(default="")
    submitted_by: str = Field(default="", index=True)
    created_at: datetime = Field(default_factory=_utcnow, index=True)


class PageView(SQLModel, table=True):
    """One page-view event — powers the App Insights tab (who's visiting, most-viewed
    pages, approx time spent). Logged by the frontend on every route change. `path` is
    the normalized route (account/use-case ids collapsed to :id so pages aggregate);
    `session_id` is a per-tab id used to approximate dwell time from consecutive views."""

    __tablename__ = "gat_page_view"

    id: str = Field(primary_key=True)
    path: str = Field(index=True)  # normalized route, e.g. "/accounts/:id"
    title: str = Field(default="")  # human label, e.g. "Account detail"
    session_id: str = Field(default="", index=True)
    viewed_by: str = Field(default="", index=True)
    created_at: datetime = Field(default_factory=_utcnow, index=True)


class VerticalBook(SQLModel, table=True):
    """Per-vertical account-book totals from the GTM Genie Account Activation deep-dive
    (temp__rpt_genie_aibi_activation_chart, latest snapshot, by sales_subregion_level_1).
    A display-only parity figure — the full FINS/MFG/... book behind the dashboard's
    activation count (e.g. FINS = 811), including dormant/non-customer accounts that the
    app's active universe intentionally excludes. NOT the app's account list."""

    __tablename__ = "gat_vertical_book"

    vertical: str = Field(primary_key=True)  # sales_subregion_level_1 (FINS/MFG/...)
    book_total: int = Field(default=0)  # distinct accounts on the activation book
    # Genie-Ready tier counts over the FULL book (matches the dashboard's stacked bar),
    # with the value 28 days ago for the 30-day change.
    book_green: int = Field(default=0)
    book_yellow: int = Field(default=0)
    book_red: int = Field(default=0)
    book_green_prev: int = Field(default=0)
    book_yellow_prev: int = Field(default=0)
    book_red_prev: int = Field(default=0)
    updated_at: datetime = Field(default_factory=_utcnow)


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
    """A campaign: a time-boxed outreach to a chosen set of accounts, with an
    audience description and a link to a Form of questions to ask that audience.

    The chosen accounts are stored as a JSON list of account ids (a manual pick,
    not a live-resolved segment). Campaigns are shown newest-first, one per row."""

    __tablename__ = "gat_campaign"

    id: str = Field(primary_key=True)
    title: str = Field(default="")
    # When the campaign runs (ISO date strings, optional).
    start_date: str = Field(default="")
    end_date: str = Field(default="")
    # Free-text describing the intended audience of accounts.
    audience_text: str = Field(default="")
    # The accounts chosen for this campaign — a manual pick, stored as a JSON list
    # of gat_account ids.
    account_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    # Link to an external Form (Google Form / Typeform / etc.) with questions.
    # Retained for campaigns that point at an outside form; the in-app questionnaire
    # (gat_campaign_question) is the primary path and is served at /forms/<form_token>.
    form_url: str = Field(default="")
    # In-app questionnaire: a unique, unguessable token used to build the form's
    # shareable link (/forms/<token>). Generated when the campaign is created.
    form_token: str = Field(default="", index=True)
    # draft (being built) | active (live, in its date window) | closed.
    status: str = Field(default="draft", index=True)
    created_at: datetime = Field(default_factory=_utcnow, index=True)
    created_by: str = Field(default="")


class CampaignQuestion(SQLModel, table=True):
    """One question in a campaign's in-app questionnaire (g-form style). The account
    name is a fixed first field of every form and is NOT stored as a question row —
    these are the questions that follow it. Ordered by `position`."""

    __tablename__ = "gat_campaign_question"

    id: str = Field(primary_key=True)
    campaign_id: str = Field(index=True, foreign_key="gat_campaign.id")
    position: int = Field(default=0)
    prompt: str = Field(default="")
    # text | textarea | single_choice | multi_choice | rating
    qtype: str = Field(default="text")
    # Choice options for single_choice / multi_choice (empty otherwise).
    options: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    required: bool = Field(default=False)


class CampaignResponse(SQLModel, table=True):
    """One account team's submission to a campaign form — the 'campaignX_results'
    signal. answers is a JSON map of {question_id: response}; account_id ties it to
    the audience account chosen in the form's account-name field."""

    __tablename__ = "gat_campaign_response"

    id: str = Field(primary_key=True)
    campaign_id: str = Field(index=True, foreign_key="gat_campaign.id")
    account_id: str = Field(default="", index=True)
    account_name: str = Field(default="")
    answers: dict = Field(default_factory=dict, sa_column=Column(JSON))
    submitted_by: str = Field(default="")
    submitted_at: datetime = Field(default_factory=_utcnow, index=True)
