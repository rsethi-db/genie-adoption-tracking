"""
Genie Field Adoption Playbook — static content encoded from the FINS FE Huddle deck
(2026-06-30), slides 61–63.

This module is the single source of truth for the playbook structure the app makes
actionable:

  * STAGES        — the 7 UCO-aligned adoption stages (Pre-Reqs → U6 Live)
  * CHECKLIST     — per-stage action items across three lanes
                    (Happy Path / Recommended / As Needed)
  * BLOCKERS      — the 5 "Getting Unstuck" categories, each with a decision gate,
                    the concern, and the recommended counter-action + resource
  * RESOURCES     — the four go/ resource buckets (Demo / Plays / Workshops / Proof)

The frontend renders this; the backend seeds reference rows and validates that
captured signal (checklist ticks, blocker flags) references real playbook item keys.
Keeping it as plain data (not DB rows) means the playbook can be versioned in git and
shipped with the app, while only *signal* lives in Lakebase.
"""

from __future__ import annotations

from typing import Literal

Lane = Literal["happy_path", "recommended", "as_needed"]

# Bump when the playbook content changes so captured signal can be tied to a version.
PLAYBOOK_VERSION = "2026-06-30"


# --------------------------------------------------------------------------------------
# Stages (slide 61 — columns of the adoption matrix)
# --------------------------------------------------------------------------------------

STAGES: list[dict] = [
    {
        "key": "prereqs",
        "code": "PRE",
        "name": "Pre-Reqs — Ready?",
        "summary": "Determine eligibility — do they have the foundational tech blocks to proceed?",
        "order": 0,
    },
    {
        "key": "u1",
        "code": "U1",
        "name": "Awareness & Demo",
        "summary": "Demo with known domain assets; start AIM / account-level SCIM conversations; establish business-user champion(s).",
        "order": 1,
    },
    {
        "key": "u2",
        "code": "U2",
        "name": "Discovery & Workshop",
        "summary": "Articulate a use case with a path to Prod; build a prototype on customer data; gather evaluation data (Q&A).",
        "order": 2,
    },
    {
        "key": "u3",
        "code": "U3",
        "name": "Evaluation & Expansion",
        "summary": "Business-user sign-off on accuracy; UCO sizing & forecasting; AIM / account-level SCIM — Genie Ready.",
        "order": 3,
    },
    {
        "key": "u4",
        "code": "U4",
        "name": "Confirming",
        "summary": "Strong C-suite sponsorship; import/export space for DAB & sharing; follow up with IT/Business stakeholders.",
        "order": 4,
    },
    {
        "key": "u5",
        "code": "U5",
        "name": "Onboarding",
        "summary": "Expand to other Genie UC; monitor cost/quality; tune as needed.",
        "order": 5,
    },
    {
        "key": "u6",
        "code": "U6",
        "name": "Live",
        "summary": "Further tuning; document use cases → feed the pipeline.",
        "order": 6,
    },
]

STAGE_KEYS = [s["key"] for s in STAGES]


# --------------------------------------------------------------------------------------
# Checklist items (slide 61 — the three action lanes per stage)
#
# Each item: key, stage, lane, label. The `key` is stable and is what gets stored in the
# checklist_progress signal table.
# --------------------------------------------------------------------------------------

CHECKLIST: list[dict] = [
    # ---- Pre-Reqs ---------------------------------------------------------------------
    {"key": "pre-hp-eligibility", "stage": "prereqs", "lane": "happy_path",
     "label": "Confirm foundational tech blocks are in place (eligibility check)"},
    {"key": "pre-hp-security", "stage": "prereqs", "lane": "happy_path",
     "label": "Complete AI Security Review"},
    {"key": "pre-hp-acct-control", "stage": "prereqs", "lane": "happy_path",
     "label": "Ensure account-level control is enabled"},
    {"key": "pre-rec-workspace-toggle", "stage": "prereqs", "lane": "recommended",
     "label": "Advise customer to toggle Genie at the workspace level"},

    # ---- U1 Awareness & Demo ----------------------------------------------------------
    {"key": "u1-hp-demo", "stage": "u1", "lane": "happy_path",
     "label": "Run a demo with known domain assets"},
    {"key": "u1-hp-aim", "stage": "u1", "lane": "happy_path",
     "label": "Start AIM / account-level SCIM conversations"},
    {"key": "u1-hp-champion", "stage": "u1", "lane": "happy_path",
     "label": "Establish business-user champion(s)"},
    {"key": "u1-hp-validate-usecases", "stage": "u1", "lane": "happy_path",
     "label": "Validate & prioritize use cases"},
    {"key": "u1-rec-objection", "stage": "u1", "lane": "recommended",
     "label": "Prep for objection handling"},
    {"key": "u1-rec-flavors", "stage": "u1", "lane": "recommended",
     "label": "Explore other Genie 'flavors' to use"},

    # ---- U2 Discovery & Workshop ------------------------------------------------------
    {"key": "u2-hp-usecase-path", "stage": "u2", "lane": "happy_path",
     "label": "Articulate a use case with a clear path to Production"},
    {"key": "u2-hp-prototype", "stage": "u2", "lane": "happy_path",
     "label": "Build a prototype on customer data"},
    {"key": "u2-hp-eval-data", "stage": "u2", "lane": "happy_path",
     "label": "Gather evaluation data (SME-validated Q&A)"},
    {"key": "u2-hp-workshop", "stage": "u2", "lane": "happy_path",
     "label": "Run a best-practices Genie workshop"},
    {"key": "u2-rec-scale-enable", "stage": "u2", "lane": "recommended",
     "label": "Enable at scale: STS / Partners"},
    {"key": "u2-rec-asq", "stage": "u2", "lane": "recommended",
     "label": "Open an ASQ for SME help & Brickroad for PM help on blockers"},

    # ---- U3 Evaluation & Expansion ----------------------------------------------------
    {"key": "u3-hp-signoff", "stage": "u3", "lane": "happy_path",
     "label": "Get business-user sign-off on accuracy"},
    {"key": "u3-hp-sizing", "stage": "u3", "lane": "happy_path",
     "label": "UCO sizing & forecasting"},
    {"key": "u3-hp-genie-ready", "stage": "u3", "lane": "happy_path",
     "label": "AIM / account-level SCIM — mark Genie Ready"},
    {"key": "u3-hp-workbench", "stage": "u3", "lane": "happy_path",
     "label": "Optimize accuracy in Genie Workbench"},
    {"key": "u3-rec-followup", "stage": "u3", "lane": "recommended",
     "label": "Follow up in 2x2 conversations"},

    # ---- U4 Confirming ----------------------------------------------------------------
    {"key": "u4-hp-csuite", "stage": "u4", "lane": "happy_path",
     "label": "Secure strong C-suite sponsorship"},
    {"key": "u4-hp-dab-share", "stage": "u4", "lane": "happy_path",
     "label": "Import/export space for DAB & sharing"},
    {"key": "u4-hp-stakeholders", "stage": "u4", "lane": "happy_path",
     "label": "Follow up with IT / Business stakeholders"},
    {"key": "u4-hp-hackathon", "stage": "u4", "lane": "happy_path",
     "label": "Run a Genie Acceleration Hackathon"},

    # ---- U5 Onboarding ----------------------------------------------------------------
    {"key": "u5-hp-expand", "stage": "u5", "lane": "happy_path",
     "label": "Expand to other Genie use cases / LoB / users"},
    {"key": "u5-hp-monitor", "stage": "u5", "lane": "happy_path",
     "label": "Monitor cost / quality"},
    {"key": "u5-hp-metric-views", "stage": "u5", "lane": "happy_path",
     "label": "Gather Metric View / Ontology specs"},
    {"key": "u5-rec-tuning", "stage": "u5", "lane": "recommended",
     "label": "Tune & monitor cost/quality on an ongoing basis"},

    # ---- U6 Live ----------------------------------------------------------------------
    {"key": "u6-hp-tuning", "stage": "u6", "lane": "happy_path",
     "label": "Further tuning"},
    {"key": "u6-hp-document", "stage": "u6", "lane": "happy_path",
     "label": "Document use cases → feed the pipeline"},
    {"key": "u6-hp-endpoint", "stage": "u6", "lane": "happy_path",
     "label": "Set up consumption endpoint (APIs)"},
    {"key": "u6-rec-expand-users", "stage": "u6", "lane": "recommended",
     "label": "Expand to other LoB / users"},
]


# --------------------------------------------------------------------------------------
# Blockers (slide 62 — "Getting Unstuck" decision/blocker flow)
#
# Each blocker category carries a decision gate, the competitive/operational concern,
# and the recommended counter-action. `stage_hint` maps it to where it typically bites.
# --------------------------------------------------------------------------------------

BLOCKERS: list[dict] = [
    {
        "key": "prerequisites",
        "name": "Pre-requisites",
        "gate": "UCAI Partner Powered?",
        "stage_hint": "prereqs",
        "checks": [
            "AI Security Review completed",
            "Account-level control enabled",
            "Customer advised to toggle at workspace level",
        ],
        "concern": "Double down on the Security Review; account-level controls must be enabled before proceeding.",
        "action": "Complete the AI Security Review and confirm account-level control is enabled; advise the customer to toggle Genie at the workspace level.",
        "resource_key": "plays-enablement",
    },
    {
        "key": "data_readiness",
        "name": "Data Readiness",
        "gate": "Prod Data?",
        "stage_hint": "u2",
        "checks": [
            "Prod-like data enabled on lower env (with masking)",
            "Business users onboarded in lower env",
            "Data arranged by domains for easy identification",
        ],
        "concern": "Prototypes stall without production-like data and onboarded business users in the lower environment.",
        "action": "Enable prod-like (masked) data in the lower env, onboard business users, and arrange data by domain for easy identification.",
        "resource_key": "workshops-geniewish",
    },
    {
        "key": "ease_of_creation",
        "name": "Ease of Creation, Use & Maintenance",
        "gate": "Accuracy? → Genie Workbench",
        "stage_hint": "u3",
        "checks": [
            "SME-validated Q/A available as Evaluation Data",
            "UC Metrics capture key KPIs",
            "Certification / Deprecation / Environment tags applied",
        ],
        "concern": "Accuracy plateaus without SME-validated eval data, KPI metrics, and governance tags.",
        "action": "Load SME-validated Q/A as Evaluation Data, capture key KPIs in UC Metrics, and apply Certification/Deprecation/Environment tags. Tune in Genie Workbench.",
        "resource_key": "demo-workbench",
    },
    {
        "key": "observability",
        "name": "Observability, Evaluation & Monitoring",
        "gate": "Prod Ready?",
        "stage_hint": "u5",
        "checks": [
            "Historical data reviewed to establish cost projections",
            "Continuous monitoring for cost & accuracy in place",
            "Unused Genie spaces identified for deletion",
        ],
        "concern": "Genie Space proliferation and unclear cost projections. Serving-layer competition from Snowflake & Fabric.",
        "action": "Review historical data to establish cost projections, set up continuous monitoring for cost & accuracy, and advise the customer to delete unused spaces. Use time frames and BU domains to break down cost.",
        "resource_key": "proof-blockers-dashboard",
    },
    {
        "key": "scale",
        "name": "Scale",
        "gate": "AIM?",
        "stage_hint": "u4",
        "checks": [
            "Greenfield / AIM-migration opportunity identified",
            "C-suite support secured",
            "AIM-supported IDP middle translation layer considered",
        ],
        "concern": "IDP middle translation layer can block AIM. Greenfield accounts adopt AIM faster.",
        "action": "Target greenfield accounts and AIM migrations with C-suite support; plan for an AIM-supported IDP middle translation layer.",
        "resource_key": "plays-aim-migration",
    },
]


# --------------------------------------------------------------------------------------
# Resources (slide 63 — "Assets & Resources: Everything You Need to Run the Play")
#
# `stages` marks which stages a resource is most relevant to, so the Runner can show a
# contextual resource panel. `bucket` groups them on the resources view.
# --------------------------------------------------------------------------------------

# URLs sourced from the FINS Genie Field Adoption Playbook deck
# (docs.google.com/presentation/d/1Vbwoj1dHBIGW1t3yIeKT4_9qY0faOTZpa2UsSHp5ojs).
RESOURCES: list[dict] = [
    # ---- Demo Assets ------------------------------------------------------------------
    {"key": "demo-industry", "bucket": "Demo Assets", "label": "Existing Industry demos",
     "url": "https://dbdemos-demo-catalog-2556758628403379.aws.databricksapps.com/", "stages": ["u1"]},
    {"key": "demo-solution-builder", "bucket": "Demo Assets", "label": "Build a new demo (Solution Builder)",
     "url": "https://go/solution-builder", "stages": ["u1", "u2"]},
    {"key": "demo-gtm-rooms", "bucket": "Demo Assets", "label": "FS GTM Genie Rooms",
     "url": "https://fsgtm-genie-7474644662581786.aws.databricksapps.com/", "stages": ["u1"]},
    {"key": "demo-fevm", "bucket": "Demo Assets", "label": "FINS FEVM Demos",
     "url": "https://docs.google.com/presentation/d/1uRPa7H39lhRV3xuP1a5GHgGsH4kNYPvInGRw7QV-rhE/edit", "stages": ["u1"]},
    {"key": "demo-workbench", "bucket": "Demo Assets", "label": "Optimizing Genie: Genie Workbench",
     "url": "https://go/genie-workbench", "stages": ["u3", "u5"]},

    # ---- Plays ------------------------------------------------------------------------
    {"key": "plays-win-business-user", "bucket": "Plays", "label": "Win Business User Play",
     "url": "https://docs.google.com/presentation/d/1qgix9HjPgRWu-HHUJtf6KArsH3hUDcQI15BLqyz4sns/edit?usp=sharing", "stages": ["u1", "u2"]},
    {"key": "plays-enablement", "bucket": "Plays", "label": "Enablement Resources",
     "url": "https://docs.google.com/spreadsheets/d/1BLnZckGYIfH8mTF10-Z9mpXUttrJzkv_PGpfjrUW23M/edit?gid=0#gid=0", "stages": ["prereqs", "u1"]},
    {"key": "plays-aim-migration", "bucket": "Plays", "label": "AIM Migration (Azure)",
     "url": "https://docs.google.com/document/d/10qJClzrZTQLXJULS8nOkB2pveQLwd2JsCRjjWbMIAOI/edit", "stages": ["u3", "u4"]},
    {"key": "plays-aibi-migration", "bucket": "Plays", "label": "AI/BI Dashboard Migration",
     "url": "https://go/bi-migration", "stages": ["u3", "u4"]},
    {"key": "plays-partner-powered", "bucket": "Plays", "label": "Partner Powered Genie Play",
     "url": "https://docs.google.com/presentation/d/1OGrtaSGBACAUBombw_xOCoBs30dD-GEXilVUwaL2Al0/edit", "stages": ["u2", "u5"]},
    {"key": "plays-sts", "bucket": "Plays", "label": "STS Genie Play",
     "url": "https://docs.google.com/presentation/d/1EcxZB5Q5bT3waYUMDM72OcxCEpz6XaXtmJzzPqwSu0E/edit", "stages": ["u2", "u5"]},

    # ---- Workshops --------------------------------------------------------------------
    {"key": "workshops-geniewish", "bucket": "Workshops", "label": "Genie Agents Implementation Guide",
     "url": "https://docs.google.com/presentation/d/1qz0vIUW0QsIhGNFDHOVvtUf-g4CPnf9IjN1_P64qt2Q/edit", "stages": ["u2"]},
    {"key": "workshops-genie-workshop", "bucket": "Workshops", "label": "Genie Workshop",
     "url": "https://docs.google.com/presentation/d/1Hch4DwjZyvupg8rAhlfPBneKLZBGw04JtELWDNPJzag/edit", "stages": ["u2"]},
    {"key": "workshops-workshop-in-box", "bucket": "Workshops", "label": "Genie Workshop in a Box",
     "url": "https://cso-workshop-7474655716427570.aws.databricksapps.com/", "stages": ["u2"]},
    {"key": "workshops-genie-hackathon", "bucket": "Workshops", "label": "Genie Acceleration Hackathon",
     "url": "https://go/genie-hackathon", "stages": ["u2", "u4"]},
    {"key": "workshops-training-investment", "bucket": "Workshops", "label": "Training Investment (>100 learners)",
     "url": "https://docs.google.com/presentation/d/1uDVzOgot6vRzK_dupJK7FJaFYrypYdC5oDtF8CpOnOs", "stages": ["u2", "u5"]},
    {"key": "workshops-bia", "bucket": "Workshops", "label": "Business Impact Accelerator",
     "url": "https://go/business-impact-accelerator", "stages": ["u3", "u4"]},
    {"key": "workshops-pricing", "bucket": "Workshops", "label": "Pricing",
     "url": "https://go/geniepricing", "stages": ["u3"]},
    {"key": "workshops-genie-best-practices", "bucket": "Workshops", "label": "Genie Best Practices",
     "url": "https://docs.databricks.com/aws/en/genie-agents/best-practices", "stages": ["u2", "u3", "u5"]},

    # ---- Proof ------------------------------------------------------------------------
    {"key": "proof-genie-ready-dashboard", "bucket": "Proof", "label": "Genie-Ready Dashboard",
     "url": "https://adb-2548836972759138.18.azuredatabricks.net/dashboardsv3/01f10313a17e11d6b0b11abfa2736836/published/pages/92049d91?o=2548836972759138", "stages": ["u3"]},
    {"key": "proof-blockers-dashboard", "bucket": "Proof", "label": "Blockers Dashboard",
     "url": "https://adb-2548836972759138.18.azuredatabricks.net/dashboardsv3/01f014ecfb601fa19ed40df16a1110ae/published/pages/1e023696?o=2548836972759138", "stages": ["u5", "u6"]},
    {"key": "proof-customer-stories", "bucket": "Proof", "label": "Customer Stories",
     "url": "https://docs.google.com/presentation/d/1hLUBBrJ7oC2c5e8IiJiuvonbZ9u7ysw_bh21OFc0TYk/edit?usp=sharing", "stages": ["u4", "u6"]},
]


# --------------------------------------------------------------------------------------
# Lookups / validation helpers
# --------------------------------------------------------------------------------------

_CHECKLIST_BY_KEY = {c["key"] for c in CHECKLIST}
_BLOCKER_BY_KEY = {b["key"] for b in BLOCKERS}
_RESOURCE_BY_KEY = {r["key"] for r in RESOURCES}
_STAGE_ORDER = {s["key"]: s["order"] for s in STAGES}


def is_valid_stage(stage: str) -> bool:
    return stage in _STAGE_ORDER


def is_valid_checklist_item(key: str) -> bool:
    return key in _CHECKLIST_BY_KEY


def is_valid_blocker(key: str) -> bool:
    return key in _BLOCKER_BY_KEY


def is_valid_resource(key: str) -> bool:
    return key in _RESOURCE_BY_KEY


def stage_order(stage: str) -> int:
    return _STAGE_ORDER.get(stage, -1)


def checklist_count_for_stage(stage: str) -> int:
    return sum(1 for c in CHECKLIST if c["stage"] == stage)
