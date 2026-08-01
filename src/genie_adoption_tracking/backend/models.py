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
    genie_active: bool = False
    readiness_pct: int = 0
    open_issues: int = 0
    created_at: datetime
    use_case_count: int = 0
    open_blockers: int = 0
    monthly_dbus: float = 0.0


# --------------------------------------------------------------------------------------
# Adoption Workflow (stage × lane matrix, per-account status + note)
# --------------------------------------------------------------------------------------


class AdoptionStageOut(BaseModel):
    key: str
    code: str
    name: str


class AdoptionLaneOut(BaseModel):
    key: str
    name: str
    tone: str  # lava | navy | amber — maps to the app accent colors


class AdoptionTaskOut(BaseModel):
    key: str
    stage: str
    lane: str
    label: str
    status: str = "not_initiated"  # not_initiated | na | in_progress | completed
    note: str = ""


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
    genie_active: bool = False
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


class DashboardOut(BaseModel):
    total_accounts: int
    total_use_cases: int
    open_blockers: int
    live_use_cases: int
    total_monthly_dbus: float = 0.0
    pp_off_accounts: int = 0
    aim_off_accounts: int = 0
    avg_readiness_pct: int = 0
    open_issues: int = 0
    accounts_with_issues: int = 0
    funnel: list[FunnelBucketOut]
    blockers_by_category: list[BlockerAggOut]
    stalled: list[StalledUseCaseOut]
    top_resources: list[TopResourceOut]


# AccountDetailOut forward-references UseCaseListOut (defined above), resolve it.
AccountDetailOut.model_rebuild()


# --------------------------------------------------------------------------------------
# Campaigns — leadership push to account teams
# --------------------------------------------------------------------------------------


class SegmentOut(BaseModel):
    key: str
    label: str
    description: str
    # Pre-fill templates for the compose form (leadership starts from a strong draft).
    tpl_title: str = ""
    tpl_ask: str = ""
    tpl_cta: str = ""


class CampaignIn(BaseModel):
    title: str
    ask: str
    cta: str
    segment: str = "all"
    sub_vertical: str = ""
    deadline: str = ""
    priority: str = "normal"


class CampaignTargetOut(BaseModel):
    account_id: str
    account_name: str
    owners: list[str]  # AE/SA/DSA names on the account


class CampaignOut(BaseModel):
    id: str
    title: str
    ask: str
    cta: str
    segment: str
    segment_label: str
    sub_vertical: str = ""
    deadline: str = ""
    priority: str = "normal"
    active: bool = True
    created_at: datetime
    created_by: str = ""
    target_count: int = 0
    # Populated on detail/preview only (not the list), to keep the feed light.
    targets: list[CampaignTargetOut] = []
    mailto_url: str = ""
    slack_text: str = ""


class CampaignPreviewOut(BaseModel):
    target_count: int
    targets: list[CampaignTargetOut] = []


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
