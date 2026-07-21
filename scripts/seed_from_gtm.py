"""
Seed the app's Lakebase with REAL FINS accounts + Genie use cases from GTM data.

Source: logfood `main.gtm_silver` (account_dim + use_case_detail), the same query
behind the partner-AI dashboard. The data is aggregated per (account, stage) with a
use-case count and an estimated monthly DBU value.

What this does:
  * Queries logfood for FINS customer accounts with Genie use cases.
  * Maps GTM stages U1..U6 → app stages u1..u6; skips Lost / Disqualified.
  * Expands each (account, stage, count) row into `count` stub use cases so the
    funnel reflects true counts, splitting the row's DBU value evenly across them.
  * Writes accounts + use cases + initial stage_transitions straight into the app's
    Lakebase (Databricks managed Postgres) via SQLModel.

Idempotent: clears any prior GTM-seeded rows (created_by = 'gtm-seed') before load,
so re-running refreshes without duplicating. Hand-created rows are left untouched.

Run locally (against fevm Lakebase, reading logfood):
    uv run python scripts/seed_from_gtm.py
Requires the fevm-richasethi and logfood CLI profiles to be authenticated.
"""

from __future__ import annotations

import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from databricks.sdk import WorkspaceClient
from sqlalchemy import create_engine, text
from sqlmodel import Session, SQLModel, delete  # noqa: F401

# Make the backend package importable when run as a script.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from genie_adoption_tracking.backend.db import (  # noqa: E402
    Account,
    AccountIssue,
    AccountPlanItem,
    Blocker,
    ChecklistProgress,
    ResourceClick,
    StageTransition,
    UseCase,
)

# --- Config -------------------------------------------------------------------

FEVM_PROFILE = "fevm-richasethi"
LOGFOOD_PROFILE = "logfood"
LOGFOOD_WAREHOUSE = "927ac096f9833442"  # Shared SQL Endpoint - Stable
INSTANCE = "genie-adoption-tracking"
SEED_MARKER = "gtm-seed"

STAGE_MAP = {
    "U1": "u1",
    "U2": "u2",
    "U3": "u3",
    "U4": "u4",
    "U5": "u5",
    "U6": "u6",
}
# Everything else (Lost, Disqualified) is skipped — not actionable for the playbook.

# ALL FINS customer accounts (the full 517 universe) with owners, sub-vertical and
# ARR. Accounts with no Genie use case are "whitespace" — still shown so the field
# and leadership see the untapped list.
ACCOUNTS_QUERY = """
SELECT DISTINCT account_name,
  COALESCE(account_executive, '') AS ae,
  COALESCE(last_solution_architect_engaged_user_name,
           last_solution_architect_engaged, '') AS sa,
  COALESCE(dsa, '') AS dsa,
  COALESCE(sales_subregion_level_2, '') AS sub_vertical,
  COALESCE(t3m_annualized, arr, 0) AS arr
FROM main.gtm_silver.account_dim
WHERE sales_business_unit = 'AMER Industries'
  AND sales_subregion_level_1 = 'FINS'
  AND account_status LIKE '%Customer%'
  AND account_name IS NOT NULL
ORDER BY account_name
"""

# Partner-Powered AI status per FINS account, from prod_settings_log. PP must be ON
# for Genie to consume. Key nuance: Partner-Powered AI is ENABLED BY DEFAULT — an
# account with no explicit setting row is effectively on (confirmed by accounts like
# Nationwide that consume Genie with no setting present). So we only classify "off"
# on an explicit false; no-setting is "on (default)". We also return whether the
# account has a running workspace and T30D Genie consumption to distinguish
# "on (default, confirmed by usage)" from "on (default, unverified)".
PP_QUERY = """
WITH acct_settings AS (
  SELECT key_name.account_id AS db_account_id,
    MAX(CASE WHEN setting_type_name='llm_proxy_partner_powered'
      THEN setting_value['boolean_message']['value'] END) AS pp_value,
    MAX(CASE WHEN setting_type_name='llm_proxy_partner_powered_enforce'
      THEN setting_value['boolean_message']['value'] END) AS enforce_value
  FROM main.eng_lumberjack.prod_settings_log
  WHERE _partition_date = current_date() - 1
    AND setting_type_name IN ('llm_proxy_partner_powered','llm_proxy_partner_powered_enforce')
    AND key_type_name='ACCOUNT'
  GROUP BY key_name.account_id
),
account_mapping AS (
  SELECT DISTINCT w.account_id AS db_account_id, w.salesforce_account_id AS sfdc_account_id
  FROM main.certified.workspaces_latest w
  WHERE w.salesforce_account_id IS NOT NULL AND w.account_id IS NOT NULL
    AND w.workspace_status='RUNNING'
),
fins AS (
  SELECT DISTINCT account_id AS sfdc_account_id, account_name
  FROM main.gtm_silver.account_dim
  WHERE sales_business_unit='AMER Industries' AND sales_subregion_level_1='FINS'
    AND account_status LIKE '%Customer%' AND account_name IS NOT NULL
),
-- Accounts that consumed Genie in the trailing 2 years (active footprint, not T30D).
consume AS (
  SELECT DISTINCT accountId FROM main.field_usage_dashboard.fins_data fd
  WHERE fd.genie_dbu_dollars > 0
    AND fd.date >= add_months((SELECT MAX(date) FROM main.field_usage_dashboard.fins_data), -24)
)
SELECT f.account_name,
  MAX(CASE WHEN a.pp_value='true' THEN 1 ELSE 0 END) AS any_on,
  MAX(CASE WHEN a.pp_value='false' THEN 1 ELSE 0 END) AS any_off,
  MAX(CASE WHEN a.enforce_value='true' THEN 1 ELSE 0 END) AS enforce_on,
  MAX(CASE WHEN a.enforce_value='false' THEN 1 ELSE 0 END) AS enforce_off,
  MAX(CASE WHEN m.db_account_id IS NOT NULL THEN 1 ELSE 0 END) AS has_running_ws,
  MAX(CASE WHEN c.accountId IS NOT NULL THEN 1 ELSE 0 END) AS consumes_genie
FROM fins f
  LEFT JOIN account_mapping m ON f.sfdc_account_id = m.sfdc_account_id
  LEFT JOIN acct_settings a ON m.db_account_id = a.db_account_id
  LEFT JOIN consume c ON f.sfdc_account_id = c.accountId
GROUP BY f.account_name
"""

# Partner-Powered AI counts over ACTIVE workspaces only (consumed anything in the
# trailing 2 years). Effective PP value = workspace override if set, else account
# setting, else the platform default which is ON. So a workspace is "off" ONLY on an
# explicit false; null (no setting) counts as on (default). This avoids stale orgs
# (e.g. Nationwide has 95 running ws but ~69 active) inflating the "off" count.
WS_QUERY = """
WITH acct_settings AS (
  SELECT key_name.account_id AS db_account_id,
    MAX(CASE WHEN setting_type_name='llm_proxy_partner_powered'
      THEN setting_value['boolean_message']['value'] END) AS pp_value
  FROM main.eng_lumberjack.prod_settings_log
  WHERE _partition_date = current_date() - 1
    AND setting_type_name='llm_proxy_partner_powered' AND key_type_name='ACCOUNT'
  GROUP BY key_name.account_id
),
ws_settings AS (
  SELECT key_name.workspace_id AS workspace_id,
    MAX(CASE WHEN setting_type_name='llm_proxy_partner_powered'
      THEN setting_value['boolean_message']['value'] END) AS ws_pp_value
  FROM main.eng_lumberjack.prod_settings_log
  WHERE _partition_date = current_date() - 1
    AND setting_type_name='llm_proxy_partner_powered' AND key_type_name='WORKSPACE'
  GROUP BY key_name.workspace_id
),
active_ws AS (
  SELECT DISTINCT fd.workspaceId AS workspace_id
  FROM main.field_usage_dashboard.fins_data fd
  WHERE fd.dbu_dollars > 0
    AND fd.date >= add_months((SELECT MAX(date) FROM main.field_usage_dashboard.fins_data), -24)
),
account_mapping AS (
  SELECT DISTINCT w.account_id AS db_account_id, w.salesforce_account_id AS sfdc_account_id,
    w.workspace_id
  FROM main.certified.workspaces_latest w
  WHERE w.salesforce_account_id IS NOT NULL AND w.account_id IS NOT NULL
    AND w.workspace_status='RUNNING'
),
fins AS (
  SELECT DISTINCT account_id AS sfdc_account_id, account_name
  FROM main.gtm_silver.account_dim
  WHERE sales_business_unit='AMER Industries' AND sales_subregion_level_1='FINS'
    AND account_status LIKE '%Customer%' AND account_name IS NOT NULL
)
SELECT f.account_name,
  COUNT(DISTINCT m.workspace_id) AS total_ws,
  COUNT(DISTINCT CASE WHEN COALESCE(ws.ws_pp_value, a.pp_value) IS NULL
    OR COALESCE(ws.ws_pp_value, a.pp_value)='true' THEN m.workspace_id END) AS ws_on,
  COUNT(DISTINCT CASE WHEN COALESCE(ws.ws_pp_value, a.pp_value)='false'
    THEN m.workspace_id END) AS ws_off
FROM fins f
  JOIN account_mapping m ON f.sfdc_account_id = m.sfdc_account_id
  JOIN active_ws aw ON m.workspace_id = aw.workspace_id
  LEFT JOIN acct_settings a ON m.db_account_id = a.db_account_id
  LEFT JOIN ws_settings ws ON m.workspace_id = ws.workspace_id
GROUP BY f.account_name
"""

# Automatic Identity Management (AIM) per account, from the GTM Genie-ready report
# (same source the dashboard uses). We derive on/partial/off from the share of
# workspaces with AIM enabled.
AIM_QUERY = """
SELECT g.account_name,
  COALESCE(g.total_workspaces, 0) AS total_ws,
  COALESCE(g.workspaces_with_aim_enabled, 0) AS aim_ws
FROM main.gtm_gold.rpt_account_genie_ready g
JOIN (
  SELECT DISTINCT account_name FROM main.gtm_silver.account_dim
  WHERE sales_business_unit='AMER Industries' AND sales_subregion_level_1='FINS'
    AND account_status LIKE '%Customer%' AND account_name IS NOT NULL
) f ON g.account_name = f.account_name
"""

# Genie-related Brickroad issues (ALL severities) per FINS account. customer_id on
# the issue is the Salesforce account id (matches account_dim.account_id).
ISSUES_QUERY = """
WITH fins AS (
  SELECT DISTINCT account_id AS sfdc_id, account_name FROM main.gtm_silver.account_dim
  WHERE sales_business_unit='AMER Industries' AND sales_subregion_level_1='FINS'
    AND account_status LIKE '%Customer%' AND account_name IS NOT NULL
),
genie_issue_ids AS (
  SELECT DISTINCT ipa.brick_road_issue_id AS issue_id,
    FIRST(pa.name) AS product_area
  FROM main.it_brick_road.issue_product_areas ipa
  JOIN main.it_brick_road.product_areas pa ON ipa.brick_road_product_area_id = pa.id
  WHERE pa.category_path LIKE 'Genie%' OR pa.name LIKE '%Genie%'
  GROUP BY ipa.brick_road_issue_id
)
SELECT f.account_name,
  i.id, COALESCE(i.display_id,'') AS display_id, COALESCE(i.title,'') AS title,
  COALESCE(i.severity,'') AS severity, COALESCE(i.status,'') AS status,
  COALESCE(g.product_area,'') AS product_area,
  COALESCE(i.revenue_impact,0) AS revenue_impact,
  COALESCE(i.investigator_full_name,'') AS investigator
FROM main.it_brick_road.issues i
  JOIN genie_issue_ids g ON i.id = g.issue_id
  JOIN fins f ON i.customer_id = f.sfdc_id
WHERE i.is_deleted = false
ORDER BY f.account_name
"""

# ONE ROW PER real Genie use case from use_case_detail, with its actual name, stage
# and estimated $DBU. Joined to accounts by name during seeding.
USE_CASES_QUERY = """
WITH filtered_accounts AS (
  SELECT DISTINCT account_id, account_name
  FROM main.gtm_silver.account_dim
  WHERE sales_business_unit = 'AMER Industries'
    AND sales_subregion_level_1 = 'FINS'
    AND account_status LIKE '%Customer%'
    AND account_name IS NOT NULL
)
SELECT a.account_name,
  u.usecase_id,
  COALESCE(NULLIF(TRIM(u.usecase_name), ''), 'Genie use case') AS usecase_name,
  COALESCE(u.usecase_description, u.description, '') AS description,
  u.stage,
  ROUND(COALESCE(u.estimated_monthly_dollar_dbus, 0), 2) AS estimated_monthly_dollar_dbus
FROM main.gtm_silver.use_case_detail u
  JOIN filtered_accounts a ON u.account_id = a.account_id
WHERE LOWER(COALESCE(u.usecase_name, '')) LIKE '%genie%'
   OR LOWER(COALESCE(u.description, '')) LIKE '%genie%'
ORDER BY a.account_name, u.stage
"""


def _uid() -> str:
    return uuid.uuid4().hex


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _run_query(ws, statement: str, max_wait_s: int = 600) -> list:
    """Run a SQL statement and poll until it finishes (heavy queries exceed the
    50s inline wait). Raises on FAILED/CANCELED so the guard can abort cleanly."""
    import time

    resp = ws.statement_execution.execute_statement(
        warehouse_id=LOGFOOD_WAREHOUSE, statement=statement, wait_timeout="50s"
    )
    statement_id = resp.statement_id
    waited = 0
    while resp.status and resp.status.state and resp.status.state.value in (
        "PENDING",
        "RUNNING",
    ):
        if waited >= max_wait_s:
            raise RuntimeError(f"Query timed out after {max_wait_s}s")
        time.sleep(3)
        waited += 3
        resp = ws.statement_execution.get_statement(statement_id)

    state = resp.status.state.value if resp.status and resp.status.state else "?"
    if state != "SUCCEEDED":
        err = resp.status.error if resp.status else None
        raise RuntimeError(f"Query {state}: {err}")

    # Result rows may be chunked; gather all chunks.
    rows: list = []
    result = resp.result
    while result is not None:
        rows.extend(result.data_array or [])
        next_chunk = result.next_chunk_index
        if next_chunk is None:
            break
        result = ws.statement_execution.get_statement_result_chunk_n(
            statement_id, next_chunk
        )
    return rows


def fetch_accounts(ws) -> list[dict]:
    rows: list[dict] = []
    for r in _run_query(ws, ACCOUNTS_QUERY):
        rows.append(
            {
                "name": r[0],
                "ae": r[1] or "",
                "sa": r[2] or "",
                "dsa": r[3] or "",
                "sub_vertical": r[4] or "",
                "arr": float(r[5] or 0),
            }
        )
    return rows


def fetch_use_cases(ws) -> list[dict]:
    rows: list[dict] = []
    for r in _run_query(ws, USE_CASES_QUERY):
        rows.append(
            {
                "name": r[0],
                "usecase_id": r[1],
                "usecase_name": r[2] or "Genie use case",
                "description": r[3] or "",
                "stage": r[4],
                "dbus": float(r[5] or 0),
            }
        )
    return rows


def fetch_pp(ws) -> dict[str, dict]:
    """Map account_name -> {pp_status, pp_enforce}.

    Partner-Powered AI is enabled by default, so classification is:
      * off             — an explicit account setting of false (and none set true)
      * on              — an explicit account setting of true
      * on_default      — no explicit setting AND the account is consuming Genie
                          (default is on, confirmed by usage, e.g. Nationwide)
      * unknown         — no explicit setting, no running workspace / no usage to
                          confirm (genuinely undeterminable — rare)
    """
    out: dict[str, dict] = {}
    for r in _run_query(ws, PP_QUERY):
        name = r[0]
        any_on, any_off, enf_on, enf_off, has_ws, consumes = (
            int(r[1]),
            int(r[2]),
            int(r[3]),
            int(r[4]),
            int(r[5]),
            int(r[6]),
        )
        if any_off and not any_on:
            pp = "off"
        elif any_on:
            pp = "on"
        elif consumes or has_ws:
            # No explicit setting but the platform default (on) applies; usage or a
            # running workspace confirms the account is effectively enabled.
            pp = "on_default"
        else:
            pp = "unknown"
        if enf_on:
            enforce = "on"
        elif enf_off:
            enforce = "off"
        else:
            enforce = "unknown"
        out[name] = {
            "pp_status": pp,
            "pp_enforce": enforce,
            "genie_active": bool(consumes),
        }
    return out


def fetch_ws(ws) -> dict[str, dict]:
    """Map account_name -> {ws_total, ws_pp_on, ws_pp_off}."""
    out: dict[str, dict] = {}
    for r in _run_query(ws, WS_QUERY):
        out[r[0]] = {
            "ws_total": int(r[1] or 0),
            "ws_pp_on": int(r[2] or 0),
            "ws_pp_off": int(r[3] or 0),
        }
    return out


def fetch_issues(ws) -> list[dict]:
    rows: list[dict] = []
    for r in _run_query(ws, ISSUES_QUERY):
        rows.append(
            {
                "account_name": r[0],
                "id": r[1],
                "display_id": r[2] or "",
                "title": r[3] or "",
                "severity": r[4] or "",
                "status": r[5] or "",
                "product_area": r[6] or "",
                "revenue_impact": float(r[7] or 0),
                "investigator": r[8] or "",
            }
        )
    return rows


def fetch_aim(ws) -> dict[str, dict]:
    """Map account_name -> {aim_status, aim_ws_enabled}."""
    out: dict[str, dict] = {}
    for r in _run_query(ws, AIM_QUERY):
        name, total_ws, aim_ws = r[0], int(r[1] or 0), int(r[2] or 0)
        if total_ws == 0:
            status = "unknown"
        elif aim_ws == 0:
            status = "off"
        elif aim_ws >= total_ws:
            status = "on"
        else:
            status = "partial"
        # If multiple report rows per account, keep the most-enabled.
        prev = out.get(name)
        if prev is None or aim_ws > prev["aim_ws_enabled"]:
            out[name] = {"aim_status": status, "aim_ws_enabled": aim_ws}
    return out


def build_engine():
    ws = WorkspaceClient(profile=FEVM_PROFILE)
    inst = ws.database.get_database_instance(INSTANCE)
    host = inst.read_write_dns
    user = ws.config.client_id or ws.current_user.me().user_name
    cred = ws.database.generate_database_credential(instance_names=[INSTANCE])
    url = f"postgresql+psycopg://{user}:@{host}:5432/databricks_postgres"
    engine = create_engine(
        url,
        connect_args={"sslmode": "require", "prepare_threshold": None},
    )
    # Bind a fresh credential on every connect.
    from sqlalchemy import event

    @event.listens_for(engine, "do_connect")
    def _before_connect(dialect, conn_rec, cargs, cparams):
        c = ws.database.generate_database_credential(instance_names=[INSTANCE])
        cparams["password"] = c.token

    return engine


def main() -> None:
    ws = WorkspaceClient(profile=LOGFOOD_PROFILE)
    accounts = fetch_accounts(ws)
    use_cases = fetch_use_cases(ws)
    pp = fetch_pp(ws)
    wsc = fetch_ws(ws)
    aim = fetch_aim(ws)
    issues = fetch_issues(ws)
    pp_off = sum(1 for v in pp.values() if v["pp_status"] == "off")
    aim_off = sum(1 for v in aim.values() if v["aim_status"] == "off")
    print(
        f"Fetched {len(accounts)} FINS accounts, {len(use_cases)} Genie use cases, "
        f"PP status for {len(pp)} accounts ({pp_off} PP-off), "
        f"workspace counts for {len(wsc)}, AIM for {len(aim)} ({aim_off} AIM-off), "
        f"{len(issues)} Genie issues"
    )

    # Guard: never wipe the app's data on a partial fetch (e.g. a cold-warehouse
    # timeout on one of the queries). All enrichment queries must return data,
    # otherwise we'd re-seed with blank PP/WS/AIM signals.
    missing = [
        name
        for name, rows in (
            ("accounts", accounts),
            ("use_cases", use_cases),
            ("pp", pp),
            ("workspaces", wsc),
            ("aim", aim),
        )
        if not rows
    ]
    if missing:
        raise SystemExit(
            f"GTM returned 0 rows for: {', '.join(missing)} — aborting so existing "
            "data is not wiped. Re-run once the warehouse is warm."
        )

    engine = build_engine()
    SQLModel.metadata.create_all(engine)

    # The estimated_monthly_dbus column is added by the app's startup migration
    # (backend/migrations.py), which runs as the table-owning service principal.
    # Verify it exists before seeding so we fail fast with a clear message.
    with engine.connect() as conn:
        has_col = conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = 'gat_use_case' "
                "AND column_name = 'estimated_monthly_dbus'"
            )
        ).first()
    if not has_col:
        raise SystemExit(
            "gat_use_case.estimated_monthly_dbus is missing — redeploy the app first "
            "so its startup migration adds the column, then re-run this seed."
        )

    with Session(engine) as session:
        # Full reset: the app mirrors GTM, so all rows are either GTM-seeded or
        # test data. Wipe everything (children first for FKs), then re-seed from
        # GTM. This also clears any manually-entered test accounts/use cases and
        # their checklist/blocker rows.
        for model in (
            ResourceClick,
            ChecklistProgress,
            Blocker,
            StageTransition,
            AccountIssue,
            AccountPlanItem,
            UseCase,
            Account,
        ):
            session.exec(delete(model))
        session.commit()

        # Build ALL FINS accounts (the full universe, incl. whitespace).
        account_ids: dict[str, str] = {}
        n_accounts = 0
        n_use_cases = 0
        for a in accounts:
            name = a["name"]
            if name in account_ids:
                continue
            aid = _uid()
            account_ids[name] = aid
            pp_row = pp.get(name, {})
            ws_row = wsc.get(name, {})
            aim_row = aim.get(name, {})
            session.add(
                Account(
                    id=aid,
                    name=name,
                    sub_vertical=a["sub_vertical"],
                    ae_owner=a["ae"],
                    sa_owner=a["sa"],
                    dsa_owner=a["dsa"],
                    arr=a["arr"],
                    pp_status=pp_row.get("pp_status", "unknown"),
                    pp_enforce=pp_row.get("pp_enforce", "unknown"),
                    ws_total=ws_row.get("ws_total", 0),
                    ws_pp_on=ws_row.get("ws_pp_on", 0),
                    ws_pp_off=ws_row.get("ws_pp_off", 0),
                    aim_status=aim_row.get("aim_status", "unknown"),
                    aim_ws_enabled=aim_row.get("aim_ws_enabled", 0),
                    genie_active=pp_row.get("genie_active", False),
                    created_by=SEED_MARKER,
                )
            )
            n_accounts += 1
        session.flush()

        # One use case per GTM row, with its real name/description/stage/$DBU.
        for row in use_cases:
            gtm_stage = row["stage"]
            stage = STAGE_MAP.get(gtm_stage)
            if stage is None:
                continue
            aid = account_ids.get(row["name"])
            if aid is None:
                continue  # use case's account not in the FINS customer universe
            ucid = _uid()
            session.add(
                UseCase(
                    id=ucid,
                    account_id=aid,
                    title=row["usecase_name"],
                    description=row["description"],
                    stage=stage,
                    estimated_monthly_dbus=row["dbus"],
                    created_by=SEED_MARKER,
                )
            )
            session.flush()
            session.add(
                StageTransition(
                    id=_uid(),
                    use_case_id=ucid,
                    from_stage="",
                    to_stage=stage,
                    created_by=SEED_MARKER,
                )
            )
            n_use_cases += 1

        # Genie Brickroad issues (all severities) per account.
        n_issues = 0
        for row in issues:
            aid = account_ids.get(row["account_name"])
            if aid is None:
                continue
            session.add(
                AccountIssue(
                    id=str(row["id"]),
                    account_id=aid,
                    display_id=row["display_id"],
                    title=row["title"],
                    severity=row["severity"],
                    status=row["status"],
                    product_area=row["product_area"],
                    revenue_impact=row["revenue_impact"],
                    investigator=row["investigator"],
                    synced_by=SEED_MARKER,
                )
            )
            n_issues += 1
        session.commit()

    print(
        f"Seeded {n_accounts} accounts, {n_use_cases} use cases, {n_issues} issues."
    )


if __name__ == "__main__":
    main()
