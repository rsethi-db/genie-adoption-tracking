from datetime import datetime

from pydantic import BaseModel

from .. import __version__


class VersionOut(BaseModel):
    version: str

    @classmethod
    def from_metadata(cls):
        return cls(version=__version__)


# --------------------------------------------------------------------------------------
# Playbook content (static, from playbook.py) — served so the frontend renders one truth
# --------------------------------------------------------------------------------------


class StageOut(BaseModel):
    key: str
    code: str
    name: str
    summary: str
    order: int


class ChecklistItemOut(BaseModel):
    key: str
    stage: str
    lane: str
    label: str


class BlockerDefOut(BaseModel):
    key: str
    name: str
    gate: str
    stage_hint: str
    checks: list[str]
    concern: str
    action: str
    resource_key: str


class ResourceOut(BaseModel):
    key: str
    bucket: str
    label: str
    url: str
    stages: list[str]


class PlaybookOut(BaseModel):
    version: str
    stages: list[StageOut]
    checklist: list[ChecklistItemOut]
    blockers: list[BlockerDefOut]
    resources: list[ResourceOut]


# --------------------------------------------------------------------------------------
# Accounts
# --------------------------------------------------------------------------------------


class AccountIn(BaseModel):
    name: str
    sub_vertical: str = ""
    ae_owner: str = ""
    sa_owner: str = ""
    dsa_owner: str = ""


class AccountOut(BaseModel):
    id: str
    name: str
    sub_vertical: str
    vertical: str = "FINS"
    ae_owner: str
    sa_owner: str
    dsa_owner: str = ""
    arr: float = 0.0
    pp_status: str = "unknown"
    pp_enforce: str = "unknown"
    ws_total: int = 0
    ws_pp_on: int = 0
    ws_pp_off: int = 0
    aim_status: str = "unknown"
    aim_ws_enabled: int = 0
    provisioning_status: str = "unknown"
    provisioning_ws_enabled: int = 0
    provisioning_ws_total: int = 0
    readiness_tier: str = "unknown"
    genie_spend_90d: float = 0.0
    active_genie_spaces: int = 0
    genie_active: bool = False
    genie_activated: bool = False
    genie_dbu_t7d: float = 0.0
    genie_dbu_t28d: float = 0.0
    genie_dbu_t90d: float = 0.0
    genie_dbu_series: list = []
    readiness_pct: int = 0
    open_issues: int = 0
    created_at: datetime
    use_case_count: int = 0
    open_blockers: int = 0
    monthly_dbus: float = 0.0


# --------------------------------------------------------------------------------------
# Genie Playbook (stage × lane matrix, per-account status + note)
# --------------------------------------------------------------------------------------


class AdoptionStageOut(BaseModel):
    key: str
    code: str
    name: str


class AdoptionLaneOut(BaseModel):
    key: str
    name: str
    tone: str  # lava | navy | amber — maps to the app accent colors


class TaskResourceOut(BaseModel):
    label: str
    url: str


class AdoptionTaskOut(BaseModel):
    key: str
    stage: str
    lane: str
    label: str
    status: str = "not_initiated"  # not_initiated | na | in_progress | completed
    note: str = ""
    # Relevant Getting-Help resources for this task (resolved from playbook.RESOURCES).
    resources: list[TaskResourceOut] = []


class AdoptionWorkflowOut(BaseModel):
    stages: list[AdoptionStageOut]
    lanes: list[AdoptionLaneOut]
    tasks: list[AdoptionTaskOut]


class AdoptionTaskUpdateIn(BaseModel):
    task_key: str
    status: str | None = None
    note: str | None = None


class AdoptionHistoryEntryOut(BaseModel):
    task_key: str
    task_label: str
    status: str
    note: str
    changed_at: datetime
    changed_by: str


class AdoptionBulkSaveIn(BaseModel):
    """Save the whole questionnaire in one shot (Save button)."""

    items: list[AdoptionTaskUpdateIn]


# --------------------------------------------------------------------------------------
# Use cases
# --------------------------------------------------------------------------------------


class UseCaseIn(BaseModel):
    account_id: str
    title: str
    description: str = ""
    estimated_monthly_dbus: float = 0.0


class AccountDetailOut(BaseModel):
    """An account plus the use cases inside it (use cases live under the account)."""

    id: str
    name: str
    sub_vertical: str
    ae_owner: str
    sa_owner: str
    dsa_owner: str
    arr: float = 0.0
    pp_status: str = "unknown"
    pp_enforce: str = "unknown"
    ws_total: int = 0
    ws_pp_on: int = 0
    ws_pp_off: int = 0
    aim_status: str = "unknown"
    aim_ws_enabled: int = 0
    provisioning_status: str = "unknown"
    provisioning_ws_enabled: int = 0
    provisioning_ws_total: int = 0
    readiness_tier: str = "unknown"
    genie_spend_90d: float = 0.0
    active_genie_spaces: int = 0
    genie_active: bool = False
    genie_dbu_series: list = []
    readiness_pct: int = 0
    created_at: datetime
    open_blockers: int
    monthly_dbus: float
    use_cases: list["UseCaseListOut"]
    plan: list["AccountPlanItemOut"] = []
    issues: list["AccountIssueOut"] = []
    adoption: "AdoptionWorkflowOut | None" = None


class AccountIssueOut(BaseModel):
    id: str
    display_id: str
    title: str
    severity: str
    status: str
    product_area: str
    revenue_impact: float
    investigator: str
    is_open: bool


class AccountPlanItemOut(BaseModel):
    key: str
    group: str
    group_name: str
    label: str
    status: str = "todo"  # done | in_progress | todo | na
    applicable: bool = True
    auto: bool = False  # read-only (state fully derived from signals)
    reason: str = ""  # why this state (from the account's signals)
    has_note: bool = False
    done: bool = False
    note: str = ""


class AccountPlanToggleIn(BaseModel):
    item_key: str
    done: bool | None = None
    note: str | None = None


class UseCaseListOut(BaseModel):
    id: str
    account_id: str
    account_name: str
    title: str
    stage: str
    estimated_monthly_dbus: float = 0.0
    updated_at: datetime
    open_blockers: int = 0
    progress_pct: int = 0


class ChecklistStateOut(BaseModel):
    item_key: str
    stage: str
    lane: str
    label: str
    done: bool


class BlockerStateOut(BaseModel):
    id: str
    category_key: str
    category_name: str
    stage: str
    note: str
    resolved: bool
    created_at: datetime


class UseCaseDetailOut(BaseModel):
    id: str
    account_id: str
    account_name: str
    sub_vertical: str = ""
    ae_owner: str = ""
    sa_owner: str = ""
    dsa_owner: str = ""
    pp_status: str = "unknown"
    pp_enforce: str = "unknown"
    title: str
    description: str
    stage: str
    estimated_monthly_dbus: float
    created_at: datetime
    updated_at: datetime
    checklist: list[ChecklistStateOut]
    blockers: list[BlockerStateOut]
    progress_pct: int


# --------------------------------------------------------------------------------------
# Mutations
# --------------------------------------------------------------------------------------


class ChecklistToggleIn(BaseModel):
    item_key: str
    done: bool


class StageAdvanceIn(BaseModel):
    to_stage: str


class BlockerIn(BaseModel):
    category_key: str
    note: str = ""


class ResourceClickIn(BaseModel):
    resource_key: str
    use_case_id: str | None = None
    stage: str = ""


class OkOut(BaseModel):
    ok: bool = True


# --------------------------------------------------------------------------------------
# Dashboard / aggregate signal
# --------------------------------------------------------------------------------------


class FunnelBucketOut(BaseModel):
    stage: str
    code: str
    name: str
    count: int
    monthly_dbus: float = 0.0


class BlockerAggOut(BaseModel):
    category_key: str
    category_name: str
    open_count: int
    resolved_count: int


class StalledUseCaseOut(BaseModel):
    id: str
    title: str
    account_name: str
    stage: str
    days_since_update: int


class TopResourceOut(BaseModel):
    resource_key: str
    label: str
    bucket: str
    clicks: int


class SpendBucketOut(BaseModel):
    """One Genie-spend bucket for the distribution bar (mirrors the logfood PP-off
    page's 'Genie Spend Distribution' histogram)."""

    label: str  # e.g. "$1 - $100"
    order: int
    account_count: int


class WhitespaceAccountOut(BaseModel):
    """A FINS account with NO Genie use case, ranked by ARR (the logfood 'Accounts
    with No Genie Usage' table). The untapped list leadership works down."""

    id: str
    name: str
    sub_vertical: str = ""
    ae_owner: str = ""
    arr: float = 0.0


class BrickroadIssueOut(BaseModel):
    """A Genie Brickroad issue for the Brickroad tab (severity + revenue impact)."""

    id: str
    display_id: str = ""
    title: str = ""
    account_id: str = ""
    account_name: str = ""
    severity: str = ""
    status: str = ""
    product_area: str = ""
    revenue_impact: float = 0.0
    investigator: str = ""


class SubVerticalStatOut(BaseModel):
    """Adoption rolled up by sub-vertical (e.g. Banking, Insurance, Capital Markets)."""

    sub_vertical: str
    accounts: int
    genie_active: int
    whitespace: int
    genie_spend_90d: float = 0.0
    avg_readiness_pct: int = 0
    arr: float = 0.0


class GenieReadyAccountOut(BaseModel):
    """A row in the Genie-Ready tab table (tier + provisioning + spend), sorted by
    t3m annualized ~ ARR (mirrors rpt_account_genie_ready ordering)."""

    id: str
    name: str
    sub_vertical: str = ""
    readiness_tier: str = "unknown"
    provisioning_status: str = "unknown"
    pp_status: str = "unknown"
    genie_dollars_t30d: float = 0.0
    arr: float = 0.0


class DashboardOut(BaseModel):
    total_accounts: int
    total_use_cases: int
    open_blockers: int
    live_use_cases: int
    total_monthly_dbus: float = 0.0
    est_pipeline_per_month: float = 0.0  # sum of open-opp ARR/12 across accounts
    pp_off_accounts: int = 0
    pp_on_accounts: int = 0
    aim_off_accounts: int = 0
    avg_readiness_pct: int = 0
    open_issues: int = 0
    accounts_with_issues: int = 0
    genie_active_accounts: int = 0
    genie_activated_accounts: int = 0  # GTM "Activated Account" (200+ BMAU 2mo + AIM/SCIM)
    workspaces_with_genie: int = 0
    genie_spend_90d: float = 0.0
    # --- logfood parity: headline / Partner-Powered AI page ---
    genie_revenue_t30d: float = 0.0  # sum of per-account genie $DBU, trailing 30d
    active_genie_spaces: int = 0  # sum of per-account active Genie spaces
    pp_off_enforce_on: int = 0  # PP off + enforce on (hard-blocked)
    pp_off_enforce_off: int = 0  # PP off + enforce off (can still consume via ws)
    # --- Genie Accounts page ---
    whitespace_accounts: int = 0  # FINS accounts with no Genie use case
    # --- Brickroad page ---
    issues_at_risk: int = 0  # severity == risk (open)
    total_revenue_impact: float = 0.0  # sum of open-issue revenue impact
    # Genie-Ready tiers (GTM signal): green / yellow / red / unknown counts.
    tier_green: int = 0
    tier_yellow: int = 0
    tier_red: int = 0
    tier_unknown: int = 0
    funnel: list[FunnelBucketOut]
    blockers_by_category: list[BlockerAggOut]
    stalled: list[StalledUseCaseOut]
    top_resources: list[TopResourceOut]
    # logfood-parity detail lists (rendered in the tabbed Signals view)
    spend_buckets: list[SpendBucketOut] = []
    whitespace_top: list[WhitespaceAccountOut] = []
    brickroad_issues: list[BrickroadIssueOut] = []
    genie_ready_accounts: list[GenieReadyAccountOut] = []
    sub_verticals: list[SubVerticalStatOut] = []


# AccountDetailOut forward-references UseCaseListOut (defined above), resolve it.
AccountDetailOut.model_rebuild()


# --------------------------------------------------------------------------------------
# Campaigns — time-boxed outreach to a chosen set of accounts + a Form of questions
# --------------------------------------------------------------------------------------


class CampaignIn(BaseModel):
    title: str
    start_date: str = ""
    end_date: str = ""
    audience_text: str = ""
    account_ids: list[str] = []
    form_url: str = ""


# --- Audience builder (natural-language account filter) ---


class AudienceQueryIn(BaseModel):
    """A natural-language description of the accounts to target, e.g.
    'all FINS accounts where ARR > $250K, partner powered enabled and genie usage < $200'."""

    text: str


class AudienceFilters(BaseModel):
    """Structured filters parsed from the NL text (all optional)."""

    arr_min: float | None = None
    arr_max: float | None = None
    pp_status: str | None = None  # "on" | "off"
    pp_enforce: str | None = None  # "on" | "off" — PP-off enforce state
    genie_spend_min: float | None = None
    genie_spend_max: float | None = None
    sub_vertical: str | None = None
    genie_active: bool | None = None
    # Richer Signals concepts (same definitions as the Signals dashboard):
    provisioning: str | None = None  # "on" | "partial" | "off" (off = incl. blank/unknown)
    readiness_tier: str | None = None  # "green" | "yellow" | "red" | "unknown"
    whitespace: bool | None = None  # can-consume + provisioned + no active agent
    has_use_case: bool | None = None  # has ≥1 Genie use case
    open_issues: bool | None = None  # has ≥1 open Brickroad issue


class AudienceAccountOut(BaseModel):
    account_id: str
    account_name: str
    ae_owner: str = ""
    sa_owner: str = ""
    dsa_owner: str = ""
    ae_email: str = ""
    sa_email: str = ""
    dsa_email: str = ""
    arr: float = 0.0
    pp_status: str = "unknown"
    genie_spend_90d: float = 0.0


class AudienceQueryOut(BaseModel):
    filters: AudienceFilters
    # Human-readable echo of what the filters mean, so the user can sanity-check.
    interpreted: str
    # The equivalent SQL the filters translate to (over gat_account + derived signals),
    # shown collapsed so a user can see exactly how the audience was resolved.
    sql: str = ""
    accounts: list[AudienceAccountOut]


class CampaignAccountOut(BaseModel):
    """One chosen account, resolved to its name/owners for display."""

    account_id: str
    account_name: str
    owners: list[str]  # AE/SA/DSA names on the account


class CampaignOut(BaseModel):
    id: str
    title: str
    start_date: str = ""
    end_date: str = ""
    audience_text: str = ""
    form_url: str = ""
    form_token: str = ""
    status: str = "draft"
    created_at: datetime
    created_by: str = ""
    account_count: int = 0
    question_count: int = 0
    response_count: int = 0
    accounts: list[CampaignAccountOut] = []


# --- Questionnaire (in-app g-form-style builder) ---


class QuestionIn(BaseModel):
    prompt: str
    qtype: str = "text"  # text | textarea | single_choice | multi_choice | rating
    options: list[str] = []
    required: bool = False


class QuestionOut(BaseModel):
    id: str
    position: int
    prompt: str
    qtype: str
    options: list[str] = []
    required: bool = False


class QuestionnaireSaveIn(BaseModel):
    """Save the whole ordered question list in one shot (the builder's Save)."""

    questions: list[QuestionIn]


# --- Public form (what an account team fills out) ---


class CampaignFormOut(BaseModel):
    """The form as served publicly by token — enough to render + submit it."""

    campaign_id: str
    title: str
    status: str
    start_date: str = ""
    end_date: str = ""
    # The audience accounts populate the fixed first field (account name).
    accounts: list[CampaignAccountOut] = []
    questions: list[QuestionOut] = []


class ResponseSubmitIn(BaseModel):
    account_id: str = ""
    account_name: str = ""
    answers: dict = {}  # {question_id: value}


class ResponseOut(BaseModel):
    id: str
    account_id: str = ""
    account_name: str = ""
    answers: dict = {}
    submitted_by: str = ""
    submitted_at: datetime


class CampaignActivateIn(BaseModel):
    start_date: str = ""
    end_date: str = ""


# --------------------------------------------------------------------------------------
# Genie chat assistant
# --------------------------------------------------------------------------------------


class GenieStatusOut(BaseModel):
    enabled: bool


class GenieAskIn(BaseModel):
    question: str
    # Continue an existing conversation (multi-turn) when provided.
    conversation_id: str | None = None
    # Tailor answers to a specific account (context injected into the first turn).
    account_id: str | None = None


class GenieAnswerOut(BaseModel):
    conversation_id: str
    message_id: str
    text: str
    sql: str | None = None
    columns: list[str] = []
    rows: list[list[str]] = []


class GenieHistoryEntryOut(BaseModel):
    id: str
    conversation_id: str
    account_id: str | None = None
    account_name: str = ""
    question: str
    answer: str
    asked_by: str = ""
    created_at: datetime
