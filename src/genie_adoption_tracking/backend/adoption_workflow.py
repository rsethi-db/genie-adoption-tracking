"""
The Genie Playbook — "What happens at every stage".

A matrix of UCO stages (U1..U6) across the top and three action lanes down the
side (Happy Path / Recommended / As Needed). Each cell holds one or more tasks.
Per account, each task carries a status (Not Initiated / NA / In Progress /
Completed) and an optional note — the team fills these in directly on the card.

The matrix definition (stages, lanes, tasks) is static content and lives here;
only the per-account status/note is persisted (see db.AdoptionTaskState).
"""

from __future__ import annotations

from typing import Literal, TypedDict

# Stage columns — reuse the U1..U6 UCO stages (Pre-Reqs is the header banner, not
# a column). Codes/names mirror playbook.STAGES.
STAGES: list[dict] = [
    {"key": "u1", "code": "U1", "name": "Awareness & Demo"},
    {"key": "u2", "code": "U2", "name": "Discovery & Workshop"},
    {"key": "u3", "code": "U3", "name": "Evaluation & Expansion"},
    {"key": "u4", "code": "U4", "name": "Confirming"},
    {"key": "u5", "code": "U5", "name": "Onboarding"},
    {"key": "u6", "code": "U6", "name": "Live"},
]

# Action lanes (rows). `tone` maps to the accent color already used in the app:
# lava (primary/red), navy (foreground), amber.
LANES: list[dict] = [
    {"key": "happy_path", "name": "Happy Path", "tone": "green"},
    {"key": "recommended", "name": "Recommended", "tone": "blue"},
    {"key": "as_needed", "name": "As Needed", "tone": "orange"},
]

STATUSES = ["not_initiated", "na", "in_progress", "completed", "blocked"]
Status = Literal["not_initiated", "na", "in_progress", "completed", "blocked"]
DEFAULT_STATUS: Status = "not_initiated"


class Task(TypedDict):
    key: str
    stage: str
    lane: str
    label: str


# Tasks transcribed from the "What happens at every stage" workflow slide.
TASKS: list[Task] = [
    # --- Security & Review (shown first in the questionnaire; own section, not part
    #     of the stage × lane grid) -----------------------------------------------
    {"key": "sec_msa", "stage": "security", "lane": "security",
     "label": "Is a signed Master Service Agreement (MSA) required for this "
              "engagement, and what is its current status?"},
    {"key": "sec_authority_review", "stage": "security", "lane": "security",
     "label": "Has your account completed its Security Authority Review for "
              "adopting Databricks Genie?"},

    # --- Happy Path ------------------------------------------------------------
    {"key": "hp_u1_demo", "stage": "u1", "lane": "happy_path",
     "label": "Demo with known domain assets"},
    {"key": "hp_u1_champions", "stage": "u1", "lane": "happy_path",
     "label": "Establish business user champion(s)"},
    {"key": "hp_u1_aim", "stage": "u1", "lane": "happy_path",
     "label": "Start AIM / account-level SCIM conversations"},

    {"key": "hp_u2_workshop", "stage": "u2", "lane": "happy_path",
     "label": "Best-practices workshop"},
    {"key": "hp_u2_usecase", "stage": "u2", "lane": "happy_path",
     "label": "Validate & prioritize — articulate a use case with a path to Prod"},
    {"key": "hp_u2_csuite", "stage": "u2", "lane": "happy_path",
     "label": "Establish strong C-suite sponsorship"},

    {"key": "hp_u3_prototype", "stage": "u3", "lane": "happy_path",
     "label": "Build prototype on customer data"},
    {"key": "hp_u3_evaldata", "stage": "u3", "lane": "happy_path",
     "label": "Gather evaluation data (Q&A)"},
    {"key": "hp_u3_metricview", "stage": "u3", "lane": "happy_path",
     "label": "Gather Metric View / Ontology specs"},

    {"key": "hp_u4_signoff", "stage": "u4", "lane": "happy_path",
     "label": "Business-user sign-off on accuracy"},
    {"key": "hp_u4_uco_sizing", "stage": "u4", "lane": "happy_path",
     "label": "UCO sizing & forecasting"},
    {"key": "hp_u4_import_export", "stage": "u4", "lane": "happy_path",
     "label": "Import / export space for DAB & sharing"},

    {"key": "hp_u5_aim_ready", "stage": "u5", "lane": "happy_path",
     "label": "AIM / account-level SCIM — Genie Ready"},
    {"key": "hp_u5_pricing", "stage": "u5", "lane": "happy_path",
     "label": "Address pricing concerns"},

    {"key": "hp_u6_monitor", "stage": "u6", "lane": "happy_path",
     "label": "Monitor cost / quality — tune as needed"},
    {"key": "hp_u6_followup", "stage": "u6", "lane": "happy_path",
     "label": "Follow up with IT / Business stakeholders"},

    # --- Recommended -----------------------------------------------------------
    {"key": "rec_u1_objection", "stage": "u1", "lane": "recommended",
     "label": "Prep for objection handling"},

    {"key": "rec_u2_flavors", "stage": "u2", "lane": "recommended",
     "label": "Explore other Genie “flavors” to use"},
    {"key": "rec_u2_2x2", "stage": "u2", "lane": "recommended",
     "label": "Follow up in 2×2 convos"},

    {"key": "rec_u3_workbench", "stage": "u3", "lane": "recommended",
     "label": "Optimize accuracy in Workbench"},
    {"key": "rec_u3_hackathon", "stage": "u3", "lane": "recommended",
     "label": "Run a Genie Acceleration Hackathon"},

    {"key": "rec_u4_expand_lob", "stage": "u4", "lane": "recommended",
     "label": "Expand to other LoB / users"},

    {"key": "rec_u5_endpoint", "stage": "u5", "lane": "recommended",
     "label": "Set up consumption endpoint (APIs)"},
    {"key": "rec_u5_expand_uc", "stage": "u5", "lane": "recommended",
     "label": "Expand to other Genie UC"},

    # --- As Needed -------------------------------------------------------------
    {"key": "an_u3_scale", "stage": "u3", "lane": "as_needed",
     "label": "Enable at scale: STS / Partners"},

    {"key": "an_u4_tuning", "stage": "u4", "lane": "as_needed",
     "label": "Tuning & monitoring cost / quality"},

    {"key": "an_u5_further_tuning", "stage": "u5", "lane": "as_needed",
     "label": "Further tuning"},

    {"key": "an_u6_document", "stage": "u6", "lane": "as_needed",
     "label": "Document use cases → feed pipeline"},
]

_TASK_KEYS = {t["key"] for t in TASKS}

# Position of each task in the questionnaire, and its human-readable label — used to
# stamp task_order/task_name onto the persisted rows so the table can be ordered the
# same way the questionnaire is (not alphabetically by task_key).
TASK_ORDER = {t["key"]: i for i, t in enumerate(TASKS)}
TASK_LABEL = {t["key"]: t["label"] for t in TASKS}


# Which Getting-Help resources (by playbook.RESOURCES key) are relevant to each
# workflow task. Rendered under the task on the account page so the team has the
# right asset one click away. Keys resolve to label+URL from playbook.RESOURCES at
# read time — playbook.py stays the single source of truth (no duplicated URLs).
TASK_RESOURCE_KEYS: dict[str, list[str]] = {
    # --- Happy Path ---
    "hp_u1_demo": ["demo-industry", "demo-gtm-rooms", "demo-fevm", "demo-solution-builder"],
    "hp_u1_champions": ["plays-win-business-user", "plays-enablement"],
    "hp_u1_aim": ["plays-aim-migration", "ref-go-genie"],
    "hp_u2_workshop": [
        "workshops-geniewish", "workshops-genie-workshop",
        "workshops-workshop-in-box", "workshops-genie-best-practices",
    ],
    "hp_u2_usecase": ["plays-win-business-user", "demo-solution-builder"],
    "hp_u2_csuite": ["plays-win-business-user", "proof-customer-stories"],
    "hp_u3_prototype": ["demo-solution-builder", "ref-ai-ready-semantics"],
    "hp_u3_evaldata": [],
    "hp_u3_metricview": ["ref-ai-ready-semantics"],
    "hp_u4_signoff": [],
    "hp_u4_uco_sizing": [],
    "hp_u5_aim_ready": [],
    "hp_u5_pricing": ["workshops-pricing", "ref-pricing-faq", "proof-genie-cost-dashboard"],
    "hp_u6_monitor": ["proof-genie-cost-dashboard", "demo-workbench", "proof-blockers-dashboard"],
    "hp_u6_followup": ["proof-customer-stories"],
    # --- Recommended ---
    "rec_u1_objection": ["plays-win-business-user", "proof-customer-stories", "ref-go-genie"],
    "rec_u2_flavors": [],
    "rec_u3_workbench": ["demo-workbench", "workshops-genie-best-practices"],
    "rec_u3_hackathon": ["workshops-genie-hackathon"],
    "rec_u4_expand_lob": ["plays-partner-powered", "workshops-training-investment"],
    "rec_u5_expand_uc": ["plays-partner-powered", "workshops-bia"],
    # --- As Needed ---
    "an_u3_scale": ["plays-sts", "plays-partner-powered"],
    "an_u4_tuning": ["demo-workbench", "proof-genie-cost-dashboard"],
    "an_u5_further_tuning": ["demo-workbench"],
    "an_u6_document": ["proof-customer-stories"],
}


def is_valid_task(key: str) -> bool:
    return key in _TASK_KEYS


def is_valid_status(status: str) -> bool:
    return status in STATUSES
