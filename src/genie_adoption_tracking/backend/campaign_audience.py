"""Campaign audience builder — natural-language account filtering.

The user describes the accounts they want to target in plain English (e.g. "all
FINS accounts where ARR > $250K, partner powered enabled and genie usage < $200").
We send that to a foundation-model serving endpoint, which returns a small JSON
object of structured filters. We then run those filters over the `gat_account`
table and return the matching accounts (with derived AE/SA emails + ARR) so the
user can review, deselect, and manually add before it becomes the campaign audience.
"""

from __future__ import annotations

import json
import re

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.serving import ChatMessage, ChatMessageRole
from sqlmodel import Session, select

from .core import Dependencies, create_router
from .core._config import logger
from .db import Account
from .models import (
    AudienceAccountOut,
    AudienceFilters,
    AudienceQueryIn,
    AudienceQueryOut,
)

router = create_router()


# --------------------------------------------------------------------------------------
# Email derivation (the app stores AE/SA as names, not emails — derive first.last@)
# --------------------------------------------------------------------------------------


def derive_email(name: str) -> str:
    """first.last@databricks.com from a display name. Heuristic — strips accents/
    punctuation and joins name parts with dots. Empty name -> empty string."""
    n = (name or "").strip().lower()
    if not n:
        return ""
    # Keep letters, spaces, hyphens; drop everything else.
    n = re.sub(r"[^a-z\s-]", "", n)
    parts = [p for p in re.split(r"\s+", n) if p]
    if not parts:
        return ""
    local = ".".join(parts)
    return f"{local}@databricks.com"


# --------------------------------------------------------------------------------------
# NL -> structured filters, via the LLM serving endpoint
# --------------------------------------------------------------------------------------

_SYSTEM_PROMPT = """You convert a natural-language description of a set of customer \
accounts into a compact JSON filter object. Output ONLY minified JSON, no prose.

Schema (include a key only if the text implies it; omit otherwise):
  arr_min: number            # minimum annual recurring revenue in USD
  arr_max: number            # maximum ARR in USD
  pp_status: "on" | "off"    # Partner-Powered AI enabled(on)/disabled(off)
  genie_spend_min: number    # minimum trailing-90d Genie spend in USD
  genie_spend_max: number    # maximum trailing-90d Genie spend in USD
  sub_vertical: string       # a business sub-vertical/segment substring
  genie_active: boolean      # whether the account has consumed Genie recently

Interpret money shorthands: $250K = 250000, $1.2M = 1200000, $200 = 200.
"enabled"/"turned on"/"has partner powered" -> pp_status:"on".
"usage < $200"/"genie spend under 200" -> genie_spend_max:200.
Example input: "FINS accounts where ARR > $250K, partner powered enabled and genie usage < $200"
Example output: {"arr_min":250000,"pp_status":"on","genie_spend_max":200}"""


def _extract_json(text: str) -> dict:
    """Pull the first JSON object out of the model's reply, tolerating code fences."""
    if not text:
        return {}
    # Strip ```json ... ``` fences if present.
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    candidate = fenced.group(1) if fenced else text
    brace = re.search(r"\{.*\}", candidate, re.DOTALL)
    if not brace:
        return {}
    try:
        obj = json.loads(brace.group(0))
        return obj if isinstance(obj, dict) else {}
    except json.JSONDecodeError:
        return {}


def _parse_filters(ws: WorkspaceClient, endpoint: str, text: str) -> AudienceFilters:
    """Ask the LLM to turn the description into structured filters."""
    try:
        resp = ws.serving_endpoints.query(
            name=endpoint,
            messages=[
                ChatMessage(role=ChatMessageRole.SYSTEM, content=_SYSTEM_PROMPT),
                ChatMessage(role=ChatMessageRole.USER, content=text),
            ],
            max_tokens=200,
            temperature=0.0,
        )
        msg = resp.choices[0].message if resp.choices else None
        raw = (msg.content if msg else "") or ""
    except Exception as e:  # endpoint unavailable / query failed
        logger.warning(f"Audience LLM parse failed: {e}")
        raw = ""
    data = _extract_json(raw or "")
    # Coerce into the model, ignoring anything unexpected.
    try:
        return AudienceFilters(**{k: data[k] for k in AudienceFilters.model_fields if k in data})
    except Exception:
        return AudienceFilters()


def _describe(f: AudienceFilters) -> str:
    """Human-readable echo of the filters, so the user can sanity-check the parse."""
    bits: list[str] = []
    if f.arr_min is not None:
        bits.append(f"ARR ≥ ${f.arr_min:,.0f}")
    if f.arr_max is not None:
        bits.append(f"ARR ≤ ${f.arr_max:,.0f}")
    if f.pp_status:
        bits.append(f"Partner-Powered AI {f.pp_status}")
    if f.genie_spend_min is not None:
        bits.append(f"Genie spend ≥ ${f.genie_spend_min:,.0f}")
    if f.genie_spend_max is not None:
        bits.append(f"Genie spend ≤ ${f.genie_spend_max:,.0f}")
    if f.sub_vertical:
        bits.append(f"sub-vertical contains “{f.sub_vertical}”")
    if f.genie_active is not None:
        bits.append("Genie-active" if f.genie_active else "not Genie-active")
    return " · ".join(bits) if bits else "No filters recognized — showing no accounts."


def _matches(a: Account, f: AudienceFilters) -> bool:
    if f.arr_min is not None and a.arr < f.arr_min:
        return False
    if f.arr_max is not None and a.arr > f.arr_max:
        return False
    if f.pp_status is not None and a.pp_status != f.pp_status:
        return False
    if f.genie_spend_min is not None and a.genie_spend_90d < f.genie_spend_min:
        return False
    if f.genie_spend_max is not None and a.genie_spend_90d > f.genie_spend_max:
        return False
    if f.sub_vertical and f.sub_vertical.lower() not in (a.sub_vertical or "").lower():
        return False
    if f.genie_active is not None and a.genie_active != f.genie_active:
        return False
    return True


def _has_any_filter(f: AudienceFilters) -> bool:
    return any(v is not None for v in f.model_dump().values())


def _account_out(a: Account) -> AudienceAccountOut:
    return AudienceAccountOut(
        account_id=a.id,
        account_name=a.name,
        ae_owner=a.ae_owner,
        sa_owner=a.sa_owner,
        ae_email=derive_email(a.ae_owner),
        sa_email=derive_email(a.sa_owner),
        arr=a.arr,
        pp_status=a.pp_status,
        genie_spend_90d=a.genie_spend_90d,
    )


_DEMO_ACCOUNTS = [
    # name, sub_vertical, ae, sa, arr, pp_status, genie_spend_90d, genie_active
    ("Summit Financial", "FINS Banking", "Jordan Kim", "Sam Lee", 500000, "on", 120, True),
    ("Harbor Insurance", "FINS Insurance & WAM", "Riley Osei", "Dana Park", 300000, "on", 50, True),
    ("Delta Capital", "FINS Capital Markets", "Alex Ray", "Pat Ng", 260000, "on", 800, True),
    ("Nano Fintech", "FINS ProServ & FinTech SLM", "Chris Fox", "Lee Mora", 90000, "on", 10, False),
    ("Orion Bank", "FINS Banking", "Max Vale", "Ivy Sun", 450000, "off", 30, True),
]


@router.post(
    "/campaigns/audience/seed-demo",
    operation_id="seedDemoAccounts",
)
def seed_demo_accounts(session: Dependencies.Session):
    """Dev helper: (re)seed a handful of FINS accounts with ARR / Partner-Powered /
    Genie-spend values so the natural-language audience builder has data to filter.
    Idempotent — clears prior demo rows (created_by='demo-seed') and re-inserts."""
    import uuid

    for a in session.exec(select(Account)).all():
        if a.created_by == "demo-seed":
            session.delete(a)
    session.commit()
    for (name, sv, ae, sa, arr, pp, gs, ga) in _DEMO_ACCOUNTS:
        session.add(
            Account(
                id=uuid.uuid4().hex, name=name, sub_vertical=sv, ae_owner=ae,
                sa_owner=sa, arr=arr, pp_status=pp, genie_spend_90d=gs,
                genie_active=ga, created_by="demo-seed",
            )
        )
    session.commit()
    return {"ok": True, "seeded": len(_DEMO_ACCOUNTS)}


@router.post(
    "/campaigns/audience/query",
    response_model=AudienceQueryOut,
    operation_id="queryCampaignAudience",
)
def query_audience(
    body: AudienceQueryIn,
    session: Dependencies.Session,
    ws: Dependencies.Client,
    config: Dependencies.Config,
):
    """Parse a natural-language audience description into filters and return the
    matching accounts (account_id, AE/SA email, ARR, …) for review."""
    text = (body.text or "").strip()
    if not text:
        return AudienceQueryOut(
            filters=AudienceFilters(), interpreted="Enter a description.", accounts=[]
        )
    filters = _parse_filters(ws, config.llm_endpoint, text)
    interpreted = _describe(filters)
    # With no recognized filter, return nothing rather than the whole table.
    if not _has_any_filter(filters):
        return AudienceQueryOut(filters=filters, interpreted=interpreted, accounts=[])
    accounts = session.exec(select(Account)).all()
    matched = [_account_out(a) for a in accounts if _matches(a, filters)]
    matched.sort(key=lambda a: a.arr, reverse=True)
    return AudienceQueryOut(filters=filters, interpreted=interpreted, accounts=matched)
