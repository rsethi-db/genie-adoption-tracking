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
from .db import Account, AccountIssue, UseCase
from .models import (
    AudienceAccountOut,
    AudienceFilters,
    AudienceQueryIn,
    AudienceQueryOut,
    AudienceSqlIn,
    AudienceSqlOut,
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

Schema (include a key ONLY if the text implies it; omit otherwise):
  arr_min: number            # minimum annual recurring revenue in USD
  arr_max: number            # maximum ARR in USD
  pp_status: "on" | "off"    # Partner-Powered AI enabled(on)/disabled(off)
  pp_enforce: "on" | "off"   # for PP-off accounts: enforce on (hard-blocked) / off (workspaces can consume)
  genie_spend_min: number    # minimum trailing-30d Genie spend in USD
  genie_spend_max: number    # maximum trailing-30d Genie spend in USD
  vertical: string           # AMER vertical (exact): FINS, MFG, PS, HLS, CMEG, RCT, DNB, CAN, LATAM, "EE & Startup"
  sub_vertical: string       # a finer business sub-vertical/segment substring (e.g. Banking, Insurance, Hunter)
  genie_active: boolean      # has an active Genie agent (used Genie in last 30d)
  provisioning: "on"|"partial"|"off"  # user provisioning (AIM/SCIM); off = none/blank
  readiness_tier: "green"|"yellow"|"red"|"unknown"  # GTM Genie-Ready tier
  whitespace: boolean        # can consume Genie + provisioned but NO active agent
  has_use_case: boolean      # has at least one Genie use case
  use_case_stage: "u1"|"u2"|"u3"|"u4"|"u5"|"u6"  # has >=1 use case at this UCO stage (u6 = Live)
  open_issues: boolean       # has at least one open Brickroad issue

Interpret money shorthands: $250K = 250000, $1.2M = 1200000, $200 = 200.
Mappings:
  "FINS"/"MFG"/"PS"/"HLS"/"CMEG"/"RCT"/"DNB"/"CAN"/"LATAM"/"EE & Startup" (a top-level vertical) -> vertical:"FINS" etc.
  a finer segment like "banking"/"insurance"/"hunter"/"capital markets" -> sub_vertical:"..."
  "no genie usage"/"not using genie"/"no genie activity"/"no agents" -> genie_active:false
  "using genie"/"genie active"/"has agents" -> genie_active:true
  "whitespace"/"ready but idle"/"ready to activate"/"can consume but not using" -> whitespace:true
  "has a use case"/"has genie use cases" -> has_use_case:true ; "no use case" -> has_use_case:false
  "use case in U6"/"live use case"/"at least 1 use case in live"/"UCO at U3" -> use_case_stage:"u6" (or u1..u5)
  "partner powered enabled/on" -> pp_status:"on" ; "PP off"/"partner powered off" -> pp_status:"off"
  "PP off but enforce off"/"off, not enforced"/"off but workspaces can consume" -> pp_status:"off",pp_enforce:"off"
  "PP off and enforced"/"hard blocked" -> pp_status:"off",pp_enforce:"on"
  "provisioned"/"has AIM"/"has SCIM" -> provisioning:"on" ; "not provisioned"/"no provisioning" -> provisioning:"off"
  "green/yellow/red tier"/"genie-ready green" -> readiness_tier:"green"/etc.
  "open issues"/"has blockers"/"brickroad issues" -> open_issues:true
  "usage < $200"/"genie spend under 200" -> genie_spend_max:200
Examples:
  "FINS accounts where ARR > $250K, partner powered enabled and genie usage < $200"
    -> {"vertical":"FINS","arr_min":250000,"pp_status":"on","genie_spend_max":200}
  "FINS accounts in Hunter sub-vertical with at least 1 use case in U6 / live"
    -> {"vertical":"FINS","sub_vertical":"Hunter","use_case_stage":"u6"}
  "accounts with no genie usage" -> {"genie_active":false}
  "whitespace accounts in banking over $1M ARR" -> {"whitespace":true,"sub_vertical":"Banking","arr_min":1000000}
  "green tier accounts not using genie" -> {"readiness_tier":"green","genie_active":false}
  "PP off but enforce off in insurance over $1M ARR" -> {"pp_status":"off","pp_enforce":"off","sub_vertical":"Insurance","arr_min":1000000}"""


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


# Hard ceiling on the LLM parse. The SDK's serving query has no per-call timeout, so
# a slow/unreachable endpoint (or expired creds) would otherwise block the request
# thread forever — and enough of those exhaust FastAPI's sync threadpool, hanging the
# whole app. Bounding it here guarantees the handler is freed and degrades to "no
# filters recognized" instead of a spinner that never resolves.
_LLM_TIMEOUT_S = 12


def _parse_filters(ws: WorkspaceClient, endpoint: str, text: str) -> AudienceFilters:
    """Ask the LLM to turn the description into structured filters."""
    import concurrent.futures

    def _call() -> str:
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
        return (msg.content if msg else "") or ""

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            raw = ex.submit(_call).result(timeout=_LLM_TIMEOUT_S)
    except concurrent.futures.TimeoutError:
        logger.warning(
            f"Audience LLM parse timed out after {_LLM_TIMEOUT_S}s (endpoint={endpoint})"
        )
        raw = ""
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
    if f.pp_enforce:
        bits.append(f"enforce {f.pp_enforce}")
    if f.genie_spend_min is not None:
        bits.append(f"Genie spend ≥ ${f.genie_spend_min:,.0f}")
    if f.genie_spend_max is not None:
        bits.append(f"Genie spend ≤ ${f.genie_spend_max:,.0f}")
    if f.vertical:
        bits.append(f"vertical = {f.vertical}")
    if f.sub_vertical:
        bits.append(f"sub-vertical contains “{f.sub_vertical}”")
    if f.genie_active is not None:
        bits.append("has active Genie agent" if f.genie_active else "no active Genie agent")
    if f.provisioning:
        bits.append(f"provisioning {f.provisioning}")
    if f.readiness_tier:
        bits.append(f"Genie-Ready tier {f.readiness_tier}")
    if f.whitespace is not None:
        bits.append("whitespace (ready but idle)" if f.whitespace else "not whitespace")
    if f.has_use_case is not None:
        bits.append("has a Genie use case" if f.has_use_case else "no Genie use case")
    if f.use_case_stage:
        label = "Live (U6)" if f.use_case_stage.lower() == "u6" else f.use_case_stage.upper()
        bits.append(f"has a use case at {label}")
    if f.open_issues is not None:
        bits.append("has open issues" if f.open_issues else "no open issues")
    return " · ".join(bits) if bits else "No filters recognized — showing no accounts."


def _sql_literal(v: str) -> str:
    """Single-quote a string literal for inline SQL, escaping embedded quotes."""
    return "'" + v.replace("'", "''") + "'"


def _acct_is_whitespace(a: Account) -> bool:
    """Same definition as the Signals dashboard: the account can consume Genie
    (PP on/on_default, or off but not enforced), is provisioned (on/partial), and has
    no active Genie agent in the last 30 days."""
    pp_can_consume = a.pp_status in ("on", "on_default") or (
        a.pp_status == "off" and a.pp_enforce != "on"
    )
    provisioned = a.provisioning_status in ("on", "partial")
    idle = (a.active_genie_spaces or 0) == 0
    return pp_can_consume and provisioned and idle


def _to_sql(f: AudienceFilters) -> str:
    """Render the filters as an equivalent SELECT over gat_account (+ derived signals),
    for display. Read-only echo — not executed; the app filters in Python via _matches."""
    w: list[str] = []
    if f.arr_min is not None:
        w.append(f"arr >= {f.arr_min:.0f}")
    if f.arr_max is not None:
        w.append(f"arr <= {f.arr_max:.0f}")
    if f.pp_status == "on":
        w.append("pp_status IN ('on','on_default')")
    elif f.pp_status == "off":
        w.append("pp_status = 'off'")
    if f.pp_enforce == "on":
        w.append("pp_enforce = 'on'")
    elif f.pp_enforce == "off":
        w.append("pp_enforce <> 'on'")
    if f.genie_spend_min is not None:
        w.append(f"genie_dollars_t30d >= {f.genie_spend_min:.0f}")
    if f.genie_spend_max is not None:
        w.append(f"genie_dollars_t30d <= {f.genie_spend_max:.0f}")
    if f.vertical:
        w.append(f"lower(vertical) = {_sql_literal(f.vertical.lower())}")
    if f.sub_vertical:
        w.append(f"lower(sub_vertical) LIKE '%{f.sub_vertical.lower()}%'")
    if f.genie_active is True:
        w.append("active_genie_spaces > 0")
    elif f.genie_active is False:
        w.append("active_genie_spaces = 0")
    if f.provisioning == "off":
        w.append("provisioning_status NOT IN ('on','partial')")
    elif f.provisioning in ("on", "partial"):
        w.append(f"provisioning_status = '{f.provisioning}'")
    if f.readiness_tier:
        w.append(f"readiness_tier = '{f.readiness_tier}'")
    if f.whitespace is True:
        w.append(
            "(pp_status IN ('on','on_default') OR (pp_status='off' AND pp_enforce<>'on')) "
            "AND provisioning_status IN ('on','partial') AND active_genie_spaces = 0"
        )
    elif f.whitespace is False:
        w.append(
            "NOT ((pp_status IN ('on','on_default') OR (pp_status='off' AND pp_enforce<>'on')) "
            "AND provisioning_status IN ('on','partial') AND active_genie_spaces = 0)"
        )
    if f.has_use_case is True:
        w.append("EXISTS (SELECT 1 FROM gat_use_case u WHERE u.account_id = a.id)")
    elif f.has_use_case is False:
        w.append("NOT EXISTS (SELECT 1 FROM gat_use_case u WHERE u.account_id = a.id)")
    if f.use_case_stage:
        w.append(
            "EXISTS (SELECT 1 FROM gat_use_case u WHERE u.account_id = a.id "
            f"AND u.stage = {_sql_literal(f.use_case_stage.lower())})"
        )
    if f.open_issues is True:
        w.append(
            "EXISTS (SELECT 1 FROM gat_account_issue i WHERE i.account_id = a.id "
            "AND lower(i.status) NOT IN ('resolved','will_not_solve'))"
        )
    elif f.open_issues is False:
        w.append(
            "NOT EXISTS (SELECT 1 FROM gat_account_issue i WHERE i.account_id = a.id "
            "AND lower(i.status) NOT IN ('resolved','will_not_solve'))"
        )
    if not w:
        return ""
    where = "\n  AND ".join(w)
    return f"SELECT name, ae_owner, arr\nFROM gat_account a\nWHERE {where}\nORDER BY arr DESC"


def _matches(a: Account, f: AudienceFilters) -> bool:
    if f.arr_min is not None and a.arr < f.arr_min:
        return False
    if f.arr_max is not None and a.arr > f.arr_max:
        return False
    if f.pp_status == "on" and a.pp_status not in ("on", "on_default"):
        return False
    if f.pp_status == "off" and a.pp_status != "off":
        return False
    # PP-off enforce state: "on" = hard-blocked, "off" = enforce not on (workspaces can consume).
    if f.pp_enforce == "on" and a.pp_enforce != "on":
        return False
    if f.pp_enforce == "off" and a.pp_enforce == "on":
        return False
    if f.genie_spend_min is not None and a.genie_spend_90d < f.genie_spend_min:
        return False
    if f.genie_spend_max is not None and a.genie_spend_90d > f.genie_spend_max:
        return False
    if f.vertical and (a.vertical or "").lower() != f.vertical.lower():
        return False
    if f.sub_vertical and f.sub_vertical.lower() not in (a.sub_vertical or "").lower():
        return False
    # genie_active = has an active Genie agent in the last 30d (matches Signals).
    if f.genie_active is not None:
        active = (a.active_genie_spaces or 0) > 0
        if active != f.genie_active:
            return False
    if f.provisioning == "off" and a.provisioning_status in ("on", "partial"):
        return False
    if f.provisioning in ("on", "partial") and a.provisioning_status != f.provisioning:
        return False
    if f.readiness_tier and a.readiness_tier != f.readiness_tier:
        return False
    if f.whitespace is not None and _acct_is_whitespace(a) != f.whitespace:
        return False
    # has_use_case / use_case_stage / open_issues are checked at the query level
    # (they need joins to gat_use_case / gat_account_issue), not here.
    return True


def _has_any_filter(f: AudienceFilters) -> bool:
    return any(v is not None for v in f.model_dump().values())


def _account_out(a: Account) -> AudienceAccountOut:
    return AudienceAccountOut(
        account_id=a.id,
        account_name=a.name,
        ae_owner=a.ae_owner,
        sa_owner=a.sa_owner,
        dsa_owner=a.dsa_owner,
        ae_email=derive_email(a.ae_owner),
        sa_email=derive_email(a.sa_owner),
        dsa_email=derive_email(a.dsa_owner),
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
    sql = _to_sql(filters)
    # With no recognized filter, return nothing rather than the whole table.
    if not _has_any_filter(filters):
        return AudienceQueryOut(
            filters=filters, interpreted=interpreted, accounts=[], sql=sql
        )
    accounts = session.exec(select(Account)).all()
    # Precompute use-case / open-issue account sets once (needed for has_use_case /
    # open_issues, which can't be read off the Account row alone).
    acct_ids_with_uc: set[str] = set()
    acct_ids_with_stage: set[str] = set()
    acct_ids_with_open_issue: set[str] = set()
    if filters.has_use_case is not None:
        acct_ids_with_uc = {uc.account_id for uc in session.exec(select(UseCase)).all()}
    if filters.use_case_stage:
        stage = filters.use_case_stage.lower()
        acct_ids_with_stage = {
            uc.account_id
            for uc in session.exec(select(UseCase)).all()
            if (uc.stage or "").lower() == stage
        }
    if filters.open_issues is not None:
        acct_ids_with_open_issue = {
            i.account_id
            for i in session.exec(select(AccountIssue)).all()
            if i.status.lower() not in ("resolved", "will_not_solve")
        }

    def _passes(a: Account) -> bool:
        if not _matches(a, filters):
            return False
        if filters.has_use_case is not None:
            if (a.id in acct_ids_with_uc) != filters.has_use_case:
                return False
        if filters.use_case_stage and a.id not in acct_ids_with_stage:
            return False
        if filters.open_issues is not None:
            if (a.id in acct_ids_with_open_issue) != filters.open_issues:
                return False
        return True

    matched = [_account_out(a) for a in accounts if _passes(a)]
    matched.sort(key=lambda a: a.arr, reverse=True)
    return AudienceQueryOut(
        filters=filters, interpreted=interpreted, accounts=matched, sql=sql
    )


# --------------------------------------------------------------------------------------
# Run edited SQL — the user can tweak the generated query and re-run it to override the
# NL parse. Read-only by construction: a single leading SELECT, no semicolons, executed
# in a read-only transaction with a statement timeout so it can't mutate or hang.
# --------------------------------------------------------------------------------------


def _row_to_account(row) -> AudienceAccountOut:
    """Map a result row (accessed by column name) to AudienceAccountOut. Only `id` and
    `name` are required; everything else falls back to a sensible default if the edited
    SELECT didn't project it."""
    m = row._mapping
    ae = m.get("ae_owner") or ""
    sa = m.get("sa_owner") or ""
    return AudienceAccountOut(
        account_id=str(m.get("id") or m.get("account_id") or ""),
        account_name=str(m.get("name") or m.get("account_name") or ""),
        ae_owner=ae,
        sa_owner=sa,
        ae_email=derive_email(ae),
        sa_email=derive_email(sa),
        arr=float(m.get("arr") or 0.0),
        pp_status=str(m.get("pp_status") or "unknown"),
        genie_spend_90d=float(m.get("genie_spend_90d") or 0.0),
    )


def _validate_select(sql: str) -> tuple[str | None, str]:
    """Validate that `sql` is a safe single read-only SELECT.

    Returns (cleaned_sql, "") on success, or (None, error_message) on rejection."""
    s = (sql or "").strip().rstrip(";").strip()
    if not s:
        return None, "Enter a SQL query."
    # No statement chaining — a lone trailing ';' was already stripped above.
    if ";" in s:
        return None, "Only a single statement is allowed."
    low = s.lower()
    if not (low.startswith("select") or low.startswith("with")):
        return None, "Only SELECT queries are allowed."
    # Belt-and-suspenders: reject obvious write/DDL keywords as whole words. The
    # read-only transaction below is the real guard, but this gives a clearer message.
    banned = ("insert", "update", "delete", "drop", "alter", "truncate", "create",
              "grant", "revoke", "merge", "copy", "call", "vacuum")
    if re.search(r"\b(" + "|".join(banned) + r")\b", low):
        return None, "Only read-only SELECT queries are allowed."
    return s, ""


@router.post(
    "/campaigns/audience/run-sql",
    response_model=AudienceSqlOut,
    operation_id="runCampaignAudienceSql",
)
def run_audience_sql(body: AudienceSqlIn, session: Dependencies.Session):
    """Execute a (possibly hand-edited) read-only SELECT over gat_account and return
    the matching accounts, so the user can override the NL parse with their own SQL."""
    from sqlalchemy import text as sa_text
    from sqlalchemy.exc import SQLAlchemyError

    safe, err = _validate_select(body.sql or "")
    if safe is None:
        return AudienceSqlOut(accounts=[], error=err)

    try:
        conn = session.connection()
        # Read-only + bounded: no writes can commit, and a runaway query is killed.
        conn.execute(sa_text("SET TRANSACTION READ ONLY"))
        conn.execute(sa_text("SET LOCAL statement_timeout = 8000"))
        result = conn.execute(sa_text(safe))
        rows = result.fetchmany(500)
    except SQLAlchemyError as e:
        session.rollback()
        # Surface the DB's message (e.g. bad column) so the user can fix their SQL.
        msg = str(getattr(e, "orig", e)).strip().splitlines()[0]
        return AudienceSqlOut(accounts=[], error=msg or "Query failed.")
    finally:
        # Never leave the read-only marker on the pooled connection.
        session.rollback()

    try:
        accounts = [_row_to_account(r) for r in rows]
    except Exception:
        return AudienceSqlOut(
            accounts=[],
            error="Query ran but is missing required columns (need at least id and name).",
        )
    return AudienceSqlOut(accounts=accounts, error="")
