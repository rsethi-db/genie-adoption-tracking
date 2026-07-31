"""
Account-level Genie readiness action plan — customized per account.

Unlike a static checklist, each item is *resolved* against the account's real
signals (Partner-Powered AI, AIM, UCO stages, Genie consumption, open issues) so the
plan reflects where THIS account actually is:

  * auto items resolve done/not-applicable straight from signals (read-only)
  * derived items infer state from UCO stages / consumption (e.g. discovery is done
    if a use case has reached U2+), but the team can still override
  * conditional items drop out when not relevant (e.g. Security Review is not needed
    once Partner-Powered AI is enabled)
  * manual items are pure checkboxes; some carry a note field

Readiness % counts only *applicable* items, so an account isn't penalized for steps
that don't apply to it.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypedDict

# Stage → ordinal (mirrors playbook.STAGES).
STAGE_ORDER = {
    "prereqs": 0,
    "u1": 1,
    "u2": 2,
    "u3": 3,
    "u4": 4,
    "u5": 5,
    "u6": 6,
}

Status = Literal["done", "in_progress", "todo", "na"]


class PlanItem(TypedDict):
    key: str
    group: str
    label: str
    # derivation strategy: how the item's state is computed
    derive: str | None
    note: bool


GROUPS = [
    {"key": "ai_platform", "name": "AI & Platform Readiness"},
    {"key": "awareness", "name": "Awareness & Discovery"},
    {"key": "data_readiness", "name": "Data & Genie Readiness"},
    {"key": "objections", "name": "Objections & Blockers"},
]

# derive strategies:
#   "pp"            done if Partner-Powered AI enabled (auto, read-only)
#   "aim"           done if AIM fully on (auto, read-only)
#   "sec_review"    N/A if PP already enabled, else manual
#   "uc_exists"     done if the account has >=1 Genie use case (auto)
#   "stage>=N"      done if furthest UCO stage >= N; in_progress if == N-1 (auto)
#   "data_ready"    done if consuming Genie or a UCO has reached U3+ (auto)
#   "blockers"      reflects open Genie issues/blockers (auto reason; manual "handled")
#   None            pure manual
ITEMS: list[PlanItem] = [
    # --- AI & Platform Readiness ---
    {"key": "pp_enabled", "group": "ai_platform",
     "label": "Partner-Powered AI enabled", "derive": "pp", "note": False},
    {"key": "sec_review", "group": "ai_platform",
     "label": "AI Security Review completed", "derive": "sec_review", "note": False},
    {"key": "aim_enabled", "group": "ai_platform",
     "label": "User provisioning (AIM or SCIM) in place", "derive": "provisioning", "note": False},

    # --- Awareness & Discovery ---
    {"key": "awareness_demo", "group": "awareness",
     "label": "Awareness & Demo done", "derive": "stage>=1", "note": False},
    {"key": "champion", "group": "awareness",
     "label": "Business-user champion established", "derive": None, "note": False},
    {"key": "use_cases_identified", "group": "awareness",
     "label": "Appropriate use cases identified", "derive": "uc_exists", "note": False},
    {"key": "discovery_workshop", "group": "awareness",
     "label": "Discovery / workshop done", "derive": "stage>=2", "note": False},

    # --- Data & Genie Readiness ---
    {"key": "data_genie_ready", "group": "data_readiness",
     "label": "Data is Genie-ready (modeled, accessible)", "derive": "data_ready", "note": False},
    {"key": "metadata_descriptions", "group": "data_readiness",
     "label": "Metadata / table & column descriptions in place", "derive": None, "note": False},
    {"key": "metric_views", "group": "data_readiness",
     "label": "Metric views defined for key KPIs", "derive": None, "note": False},

    # --- Objections & Blockers ---
    {"key": "objections", "group": "objections",
     "label": "Customer objections captured & handled", "derive": None, "note": True},
    {"key": "other_blockers", "group": "objections",
     "label": "Open blockers triaged", "derive": "blockers", "note": True},
]

_ITEM_KEYS = {i["key"] for i in ITEMS}


def is_valid_item(key: str) -> bool:
    return key in _ITEM_KEYS


@dataclass
class AccountFacts:
    """Signals used to resolve the plan for one account."""

    pp_enabled: bool
    aim_status: str
    aim_ws_enabled: int
    provisioning_status: str
    provisioning_ws_enabled: int
    uc_count: int
    max_stage_order: int  # -1 if no use cases
    genie_active: bool
    open_issues: int
    open_blockers: int


@dataclass
class ResolvedItem:
    applicable: bool
    status: Status
    auto: bool  # read-only (state fully derived)
    reason: str


def _stage_name(order: int) -> str:
    for k, v in STAGE_ORDER.items():
        if v == order:
            return k.upper()
    return "—"


def resolve_item(
    item: PlanItem, facts: AccountFacts, manual_done: bool, manual_note: str
) -> ResolvedItem:
    """Resolve one plan item against account signals. `manual_*` is the stored
    team-entered state, used for manual items and as an override where allowed."""
    d = item["derive"]

    if d == "pp":
        done = facts.pp_enabled
        return ResolvedItem(
            True, "done" if done else "todo", True,
            "Partner-Powered AI is enabled" if done
            else "Partner-Powered AI is OFF — Genie can't consume",
        )

    if d == "provisioning":
        # Genie-ready criterion: account-level user provisioning via AIM OR SCIM.
        # AIM is preferred; SCIM is an acceptable path. `provisioning_status` reflects
        # ANY provisioning; `aim_status` tells us whether the preferred method is used.
        aim_note = (
            " (via AIM)"
            if facts.aim_status in ("on", "partial")
            else " (via SCIM)"
        )
        if facts.provisioning_status == "on":
            return ResolvedItem(
                True, "done", True,
                f"User provisioning enabled on all workspaces{aim_note}",
            )
        if facts.provisioning_status == "partial":
            return ResolvedItem(
                True, "in_progress", True,
                f"Provisioning on {facts.provisioning_ws_enabled} workspace(s) — "
                f"not all{aim_note}",
            )
        return ResolvedItem(
            True, "todo", True,
            "No user provisioning (AIM or SCIM) detected — set up account-level "
            "provisioning",
        )

    if d == "sec_review":
        # Not needed once Partner-Powered AI is already enabled.
        if facts.pp_enabled:
            return ResolvedItem(
                False, "na", True,
                "Not needed — Partner-Powered AI is already enabled",
            )
        return ResolvedItem(
            True, "done" if manual_done else "todo", False,
            "Required — Partner-Powered AI is off; run a Security Review to enable it",
        )

    if d == "uc_exists":
        done = facts.uc_count > 0
        return ResolvedItem(
            True, "done" if done else "todo", True,
            f"{facts.uc_count} Genie use case(s) in GTM" if done
            else "No Genie use cases yet — identify one (whitespace)",
        )

    if d and d.startswith("stage>="):
        threshold = int(d.split(">=")[1])
        if facts.max_stage_order < 0:
            return ResolvedItem(True, "todo", True, "No use cases yet")
        if facts.max_stage_order >= threshold:
            return ResolvedItem(
                True, "done", True,
                f"Furthest use case at {_stage_name(facts.max_stage_order)}",
            )
        if facts.max_stage_order == threshold - 1:
            return ResolvedItem(
                True, "in_progress", True,
                f"In progress — furthest use case at {_stage_name(facts.max_stage_order)}",
            )
        return ResolvedItem(
            True, "todo", True,
            f"Furthest use case at {_stage_name(facts.max_stage_order)}",
        )

    if d == "data_ready":
        if facts.genie_active:
            return ResolvedItem(
                True, "done", True, "Confirmed — account is actively consuming Genie"
            )
        if facts.max_stage_order >= 3:
            return ResolvedItem(
                True, "done", True,
                f"Implied — use case reached {_stage_name(facts.max_stage_order)} (evaluation)",
            )
        # Not proven by signal — leave to the team.
        return ResolvedItem(
            True, "done" if manual_done else "todo", False,
            "Not yet confirmed by usage — verify data is modeled & accessible",
        )

    if d == "blockers":
        total = facts.open_issues + facts.open_blockers
        if total == 0:
            return ResolvedItem(True, "done", True, "No open Genie issues or blockers")
        # There ARE open blockers — mark todo, team checks when handled.
        return ResolvedItem(
            True, "done" if manual_done else "todo", False,
            f"{facts.open_issues} open Genie issue(s), {facts.open_blockers} blocker(s) to triage",
        )

    # Pure manual.
    return ResolvedItem(
        True, "done" if manual_done else "todo", False, ""
    )
