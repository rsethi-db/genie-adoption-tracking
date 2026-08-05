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

import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from databricks.sdk import WorkspaceClient
from sqlalchemy import create_engine, text
from sqlmodel import Session, SQLModel, delete, select  # noqa: F401

# Make the backend package importable when run as a script.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from genie_adoption_tracking.backend.db import (  # noqa: E402
    Account,
    AccountIssue,
    StageTransition,
    UseCase,
)

# --- Config -------------------------------------------------------------------

FEVM_PROFILE = "fevm-richasethi"
LOGFOOD_PROFILE = "logfood"
LOGFOOD_WAREHOUSE = "9fb2ea023126d1f4"  # Metric Store (X-Large)
INSTANCE = "genie-adoption-tracking"
SEED_MARKER = "gtm-seed"

# fevm workspace URL (where the Lakebase lives). The nightly job (running in logfood)
# reaches fevm via a token read from a secret and injected as GAT_FEVM_TOKEN.
FEVM_HOST = "https://fevm-richasethi-ws.cloud.databricks.com"


def _fevm_ws() -> "WorkspaceClient":
    """WorkspaceClient for fevm (Lakebase writes).

    Unattended job: authenticate with GAT_FEVM_HOST/GAT_FEVM_TOKEN env vars (the token
    comes from a Databricks secret — see scripts/README nightly-job section).
    Local run: fall back to the fevm-richasethi CLI profile.
    """
    token = os.environ.get("GAT_FEVM_TOKEN")
    if token:
        host = os.environ.get("GAT_FEVM_HOST", FEVM_HOST)
        return WorkspaceClient(host=host, token=token)
    return WorkspaceClient(profile=FEVM_PROFILE)


def _logfood_ws() -> "WorkspaceClient":
    """WorkspaceClient for logfood (GTM reads).

    When running as a job inside logfood, GAT_IN_LOGFOOD=1 selects native (default)
    auth; locally fall back to the logfood CLI profile.
    """
    if os.environ.get("GAT_IN_LOGFOOD"):
        return WorkspaceClient()
    return WorkspaceClient(profile=LOGFOOD_PROFILE)

STAGE_MAP = {
    "U1": "u1",
    "U2": "u2",
    "U3": "u3",
    "U4": "u4",
    "U5": "u5",
    "U6": "u6",
}
# Everything else (Lost, Disqualified) is skipped — not actionable for the playbook.

# LIVE FINS customer accounts, keyed by SFDC account_id (the stable identity — two
# accounts can share a display name, so we never dedupe by name). Universe = active
# customers: on the latest account_dim snapshot, status Customer%, FINS, with paid
# usage (> $0) in the LAST 6 MONTHS (fin_live_gold.paid_usage_metering). Lapsed/dormant
# accounts (no recent usage, often no running workspace) are excluded so they don't
# inflate whitespace or drag ratios.
# Accounts with no Genie use case are still "whitespace" — shown as the untapped list.
ACCOUNTS_QUERY = """
WITH latest_accounts AS (
  SELECT * FROM main.gtm_silver.account_dim
  WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM main.gtm_silver.account_dim)
),
active_usage AS (
  SELECT DISTINCT sfdc_account_id
  FROM main.fin_live_gold.paid_usage_metering
  WHERE usage_dollars > 0
    AND date BETWEEN add_months(current_date(), -6) AND current_date()
)
SELECT a.account_id,
  a.account_name,
  COALESCE(a.account_executive, '') AS ae,
  COALESCE(a.last_solution_architect_engaged_user_name,
           a.last_solution_architect_engaged, '') AS sa,
  COALESCE(a.dsa, '') AS dsa,
  COALESCE(a.sales_subregion_level_2, '') AS sub_vertical,
  COALESCE(a.t3m_annualized, a.arr, 0) AS arr
FROM latest_accounts a
JOIN active_usage u ON a.account_id = u.sfdc_account_id
WHERE a.sales_business_unit = 'AMER Industries'
  AND a.sales_subregion_level_1 = 'FINS'
  AND a.account_status LIKE 'Customer%'
  AND a.account_name IS NOT NULL
ORDER BY a.account_name
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
),
-- SFDC accounts that have an EXPLICITLY-OFF Databricks account which is actually
-- CONSUMING in T30D. This is logfood's PP-off definition: one SFDC account maps to
-- many Databricks accounts, so "off" is determined by a real off+consuming db-account,
-- not an optimistic "any on wins" rollup. Matches the logfood FINS dashboard.
off_consuming AS (
  SELECT DISTINCT m.sfdc_account_id
  FROM account_mapping m
    JOIN acct_settings a ON m.db_account_id = a.db_account_id
  WHERE a.pp_value = 'false'
    AND EXISTS (
      SELECT 1 FROM main.field_usage_dashboard.fins_data fd
        JOIN main.certified.workspaces_latest w
          ON fd.workspaceId = w.workspace_id AND w.account_id = m.db_account_id
      WHERE fd.accountId = m.sfdc_account_id
        AND fd.date BETWEEN date_sub(fd.max_date, 29) AND fd.max_date
        AND fd.dbu_dollars > 0
    )
)
SELECT f.sfdc_account_id,
  MAX(CASE WHEN a.pp_value='true' THEN 1 ELSE 0 END) AS any_on,
  MAX(CASE WHEN a.pp_value='false' THEN 1 ELSE 0 END) AS any_off,
  MAX(CASE WHEN a.enforce_value='true' THEN 1 ELSE 0 END) AS enforce_on,
  MAX(CASE WHEN a.enforce_value='false' THEN 1 ELSE 0 END) AS enforce_off,
  MAX(CASE WHEN m.db_account_id IS NOT NULL THEN 1 ELSE 0 END) AS has_running_ws,
  MAX(CASE WHEN c.accountId IS NOT NULL THEN 1 ELSE 0 END) AS consumes_genie,
  MAX(CASE WHEN oc.sfdc_account_id IS NOT NULL THEN 1 ELSE 0 END) AS off_consuming
FROM fins f
  LEFT JOIN account_mapping m ON f.sfdc_account_id = m.sfdc_account_id
  LEFT JOIN acct_settings a ON m.db_account_id = a.db_account_id
  LEFT JOIN consume c ON f.sfdc_account_id = c.accountId
  LEFT JOIN off_consuming oc ON f.sfdc_account_id = oc.sfdc_account_id
GROUP BY f.sfdc_account_id
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
SELECT f.sfdc_account_id,
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
GROUP BY f.sfdc_account_id
"""

# User provisioning per account, from the GTM Genie-ready report (same source the
# Genie Ready dashboard uses). Per the Genie Ready FAQ, the readiness criterion is
# "User Provisioning — AIM OR SCIM": AIM is preferred, but SCIM provisioning is an
# acceptable path. So we pull BOTH the AIM workspace count and the broader
# `workspaces_with_user_provisioning` count (any provisioning = AIM or SCIM).
AIM_QUERY = """
SELECT g.salesforce_account_id AS sfdc_account_id,
  COALESCE(g.total_workspaces, 0) AS total_ws,
  COALESCE(g.workspaces_with_aim_enabled, 0) AS aim_ws,
  COALESCE(g.workspaces_with_user_provisioning, 0) AS prov_ws,
  CASE WHEN g.is_green=1 THEN 'green' WHEN g.is_yellow=1 THEN 'yellow'
       WHEN g.is_red=1 THEN 'red' ELSE 'unknown' END AS readiness_tier
FROM main.gtm_gold.rpt_account_genie_ready g
JOIN (
  SELECT DISTINCT account_id AS sfdc_account_id FROM main.gtm_silver.account_dim
  WHERE sales_business_unit='AMER Industries' AND sales_subregion_level_1='FINS'
    AND account_status LIKE '%Customer%' AND account_name IS NOT NULL
) f ON g.salesforce_account_id = f.sfdc_account_id
"""

# Per-account Genie/pipeline signals over the trailing 30 days, keyed by SFDC
# account_id — the EXACT definitions used by the logfood FINS Genie dashboard, so the
# app matches it with no discrepancies:
#   * genie_active           — has ≥1 Genie space with actual MESSAGE usage in the last
#                              30d (metric_store.fct_data_room_messages_daily → the
#                              logfood "agent_consuming" set). Genuinely using Genie now.
#   * genie_revenue_30d      — standalone-Genie DBU $ over the last 30d
#     (gtm_gold.account_consumption_daily.genie_standalone_dbu_dollars)
#   * active_genie_spaces    — Genie spaces with usage in the last 30d, per account
#   * est_pipeline_per_month — open-opportunity booking ARR / 12
#     (gtm_silver.opportunity_detail, opportunity_status = 'open')
GENIE_30D_QUERY = """
WITH genie_space_counts AS (
  SELECT workspace_id,
    COUNT(DISTINCT CASE WHEN ds >= date_sub(current_date(), 30)
      THEN dim_data_room_id END) AS genie_spaces_with_usage
  FROM main.metric_store.fct_data_room_messages_daily
  WHERE ds >= '2025-04-13'
  GROUP BY workspace_id
),
acct_ws AS (
  SELECT DISTINCT accountId, workspaceId
  FROM main.field_usage_dashboard.fins_data
  WHERE date BETWEEN date_sub(max_date, 29) AND max_date
),
spaces AS (
  SELECT aw.accountId AS account_id,
    SUM(COALESCE(gc.genie_spaces_with_usage, 0)) AS active_genie_spaces
  FROM acct_ws aw
    LEFT JOIN genie_space_counts gc ON aw.workspaceId = gc.workspace_id
  GROUP BY aw.accountId
),
agent_consuming AS (
  SELECT DISTINCT aw.accountId AS account_id
  FROM acct_ws aw
    LEFT JOIN genie_space_counts gc ON aw.workspaceId = gc.workspace_id
  WHERE COALESCE(gc.genie_spaces_with_usage, 0) > 0
),
revenue AS (
  SELECT account_id,
    ROUND(SUM(COALESCE(genie_standalone_dbu_dollars, 0)), 2) AS genie_revenue_30d
  FROM main.gtm_gold.account_consumption_daily
  WHERE usage_date >= current_date() - INTERVAL 30 DAYS
  GROUP BY account_id
),
pipeline AS (
  SELECT account_id,
    ROUND(SUM(COALESCE(booking_arr, 0)) / 12, 2) AS est_pipeline_per_month
  FROM main.gtm_silver.opportunity_detail
  WHERE opportunity_status = 'open'
  GROUP BY account_id
),
ids AS (
  SELECT account_id FROM spaces
  UNION SELECT account_id FROM revenue
  UNION SELECT account_id FROM pipeline
)
SELECT i.account_id,
  COALESCE(r.genie_revenue_30d, 0) AS genie_revenue_30d,
  COALESCE(p.est_pipeline_per_month, 0) AS est_pipeline_per_month,
  CASE WHEN ac.account_id IS NOT NULL THEN 1 ELSE 0 END AS genie_active,
  COALESCE(s.active_genie_spaces, 0) AS active_genie_spaces
FROM ids i
  LEFT JOIN spaces s ON i.account_id = s.account_id
  LEFT JOIN revenue r ON i.account_id = r.account_id
  LEFT JOIN pipeline p ON i.account_id = p.account_id
  LEFT JOIN agent_consuming ac ON i.account_id = ac.account_id
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
SELECT f.sfdc_id AS account_id,
  i.id, COALESCE(i.display_id,'') AS display_id, COALESCE(i.title,'') AS title,
  COALESCE(i.severity,'') AS severity, COALESCE(i.status,'') AS status,
  COALESCE(g.product_area,'') AS product_area,
  COALESCE(i.revenue_impact,0) AS revenue_impact,
  COALESCE(i.investigator_full_name,'') AS investigator
FROM main.it_brick_road.issues i
  JOIN genie_issue_ids g ON i.id = g.issue_id
  JOIN fins f ON i.customer_id = f.sfdc_id
WHERE i.is_deleted = false
ORDER BY f.sfdc_id
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
SELECT a.account_id,
  u.usecase_id,
  COALESCE(NULLIF(TRIM(u.usecase_name), ''), 'Genie use case') AS usecase_name,
  COALESCE(u.usecase_description, u.description, '') AS description,
  u.stage,
  ROUND(COALESCE(u.estimated_monthly_dollar_dbus, 0), 2) AS estimated_monthly_dollar_dbus
FROM main.gtm_silver.use_case_detail u
  JOIN filtered_accounts a ON u.account_id = a.account_id
WHERE LOWER(COALESCE(u.usecase_name, '')) LIKE '%genie%'
   OR LOWER(COALESCE(u.description, '')) LIKE '%genie%'
ORDER BY a.account_id, u.stage
"""


def _uid() -> str:
    return uuid.uuid4().hex


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _run_query(ws, statement: str, max_wait_s: int = 1200) -> list:
    """Run a SQL statement and poll until it finishes. Heavy queries (the
    prod_settings_log workspace-counts query especially) can exceed 10min on a cold
    warehouse, so we allow up to 20min. Raises on FAILED/CANCELED so the guard aborts
    cleanly."""
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
                "account_id": r[0],
                "name": r[1],
                "ae": r[2] or "",
                "sa": r[3] or "",
                "dsa": r[4] or "",
                "sub_vertical": r[5] or "",
                "arr": float(r[6] or 0),
            }
        )
    return rows


def fetch_use_cases(ws) -> list[dict]:
    rows: list[dict] = []
    for r in _run_query(ws, USE_CASES_QUERY):
        rows.append(
            {
                "account_id": r[0],
                "usecase_id": r[1],
                "usecase_name": r[2] or "Genie use case",
                "description": r[3] or "",
                "stage": r[4],
                "dbus": float(r[5] or 0),
            }
        )
    return rows


def fetch_pp(ws) -> dict[str, dict]:
    """Map SFDC account_id -> {pp_status, pp_enforce, genie_active}.

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
        sfdc = r[0]
        if not sfdc:
            continue
        any_on, any_off, enf_on, enf_off, has_ws, consumes, off_consuming = (
            int(r[1]),
            int(r[2]),
            int(r[3]),
            int(r[4]),
            int(r[5]),
            int(r[6]),
            int(r[7]),
        )
        # PP-off matches logfood EXACTLY: an account is off ONLY if it has an
        # explicitly-off Databricks account that is actually CONSUMING in T30D (a live
        # risk to real usage). An explicit off that isn't consuming does NOT count as
        # off — logfood excludes it, and a SFDC account fans out to many db-accounts
        # (e.g. Morgan Stanley → 44), so a dormant off account shouldn't label the whole
        # account off.
        if off_consuming:
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
        out[sfdc] = {
            "pp_status": pp,
            "pp_enforce": enforce,
            "genie_active": bool(consumes),
        }
    return out


def fetch_ws(ws) -> dict[str, dict]:
    """Map SFDC account_id -> {ws_total, ws_pp_on, ws_pp_off}."""
    out: dict[str, dict] = {}
    for r in _run_query(ws, WS_QUERY):
        if not r[0]:
            continue
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
                "account_id": r[0],
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


def _prov_status(total_ws: int, enabled_ws: int) -> str:
    """on / partial / off / unknown from a workspace-enabled share."""
    if total_ws == 0:
        return "unknown"
    if enabled_ws == 0:
        return "off"
    if enabled_ws >= total_ws:
        return "on"
    return "partial"


def fetch_aim(ws) -> dict[str, dict]:
    """Map SFDC account_id -> AIM + user-provisioning (AIM or SCIM) signals.

    Returns aim_status/aim_ws_enabled (AIM specifically) plus provisioning_status/
    provisioning_ws_enabled (ANY provisioning = AIM or SCIM). The readiness criterion
    is AIM-or-SCIM, so provisioning_* is what drives 'ready'; aim_* is kept to still
    show whether the preferred method (AIM) is in place.
    """
    out: dict[str, dict] = {}
    for r in _run_query(ws, AIM_QUERY):
        sfdc = r[0]
        if not sfdc:
            continue
        total_ws, aim_ws, prov_ws = int(r[1] or 0), int(r[2] or 0), int(r[3] or 0)
        tier = (r[4] or "unknown") if len(r) > 4 else "unknown"
        # If multiple report rows per account, keep the most-provisioned.
        prev = out.get(sfdc)
        if prev is None or prov_ws > prev.get("provisioning_ws_enabled", -1):
            out[sfdc] = {
                "aim_status": _prov_status(total_ws, aim_ws),
                "aim_ws_enabled": aim_ws,
                "provisioning_status": _prov_status(total_ws, prov_ws),
                "provisioning_ws_enabled": prov_ws,
                # The report's OWN total — the denominator provisioning_status was
                # derived against — so the banner fraction stays self-consistent
                # (distinct from ws_total, which comes from the PP workspace query).
                "provisioning_ws_total": total_ws,
                "readiness_tier": tier,
            }
    return out


def fetch_genie_30d(ws) -> dict[str, dict]:
    """Map SFDC account_id -> trailing-30d Genie/pipeline signals.
    Columns: account_id, genie_revenue_30d, est_pipeline_per_month, genie_active,
    active_genie_spaces."""
    out: dict[str, dict] = {}
    for r in _run_query(ws, GENIE_30D_QUERY):
        aid = r[0]
        if not aid:
            continue
        out[aid] = {
            "genie_revenue_30d": float(r[1] or 0),
            "est_pipeline_per_month": float(r[2] or 0),
            "genie_active": bool(int(r[3] or 0)),
            "active_genie_spaces": int(r[4] or 0),
        }
    return out


def build_engine():
    ws = _fevm_ws()
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
    ws = _logfood_ws()
    accounts = fetch_accounts(ws)
    use_cases = fetch_use_cases(ws)
    pp = fetch_pp(ws)
    wsc = fetch_ws(ws)
    aim = fetch_aim(ws)
    genie30 = fetch_genie_30d(ws)  # keyed by SFDC account_id
    issues = fetch_issues(ws)
    pp_off = sum(1 for v in pp.values() if v["pp_status"] == "off")
    aim_off = sum(1 for v in aim.values() if v["aim_status"] == "off")
    genie_active_n = sum(1 for v in genie30.values() if v.get("genie_active"))
    print(
        f"Fetched {len(accounts)} FINS accounts, {len(use_cases)} Genie use cases, "
        f"PP status for {len(pp)} accounts ({pp_off} PP-off), "
        f"workspace counts for {len(wsc)}, AIM for {len(aim)} ({aim_off} AIM-off), "
        f"30d Genie signals for {len(genie30)} accounts ({genie_active_n} genie-active), "
        f"{len(issues)} Genie issues"
    )

    # Guard: never wipe the app's data on a partial fetch (e.g. a cold-warehouse
    # timeout on one of the queries). All enrichment queries must return data,
    # otherwise we'd re-seed with blank PP/WS/AIM/Genie signals.
    missing = [
        name
        for name, rows in (
            ("accounts", accounts),
            ("use_cases", use_cases),
            ("pp", pp),
            ("workspaces", wsc),
            ("aim", aim),
            ("genie30", genie30),
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

    # UPSERT-BY-SFDC-ACCOUNT-ID + TRANSACTIONAL refresh.
    #   * Accounts are matched by SFDC account_id (the stable identity — distinct
    #     accounts can share a display name, so name is NOT a safe key). On the FIRST
    #     id-keyed run, existing rows have no sfdc_account_id yet, so we FALL BACK to
    #     matching by name to adopt their internal uuid + backfill the id — this keeps
    #     hand-entered data (task states/plan/history, FK'd to the uuid) attached.
    #   * Enrichment (PP/WS/AIM/spend/t30d) is still keyed by NAME; the few accounts
    #     that share a name will share those status values (small, explainable).
    #   * GTM-mirror children (use_case + stage_transition, account_issue) rebuilt fresh.
    #   * ONE transaction: any failure rolls back to the previous good state.
    n_accounts = n_new = n_use_cases = n_issues = n_pruned = 0
    with Session(engine) as session:
        with session.begin():  # atomic: commit-all-or-rollback
            all_existing = session.exec(select(Account)).all()
            by_sfdc = {a.sfdc_account_id: a for a in all_existing if a.sfdc_account_id}
            by_name = {a.name: a for a in all_existing}  # first-run fallback
            account_ids: dict[str, str] = {}  # sfdc_account_id -> internal uuid

            # --- Accounts: update in place by sfdc id (or name on first run), else insert ---
            seen: set[str] = set()
            for a in accounts:
                sfdc = a["account_id"]
                if not sfdc or sfdc in seen:
                    continue
                seen.add(sfdc)
                name = a["name"]
                # All enrichment is keyed by SFDC account_id (not name) so accounts
                # sharing a display name never cross-contaminate, and each account gets
                # exactly its own PP/WS/AIM/Genie signals.
                pp_row = pp.get(sfdc, {})
                ws_row = wsc.get(sfdc, {})
                aim_row = aim.get(sfdc, {})
                g30 = genie30.get(sfdc, {})  # 30d Genie signals, keyed by SFDC id
                fields = dict(
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
                    provisioning_status=aim_row.get("provisioning_status", "unknown"),
                    provisioning_ws_enabled=aim_row.get("provisioning_ws_enabled", 0),
                    provisioning_ws_total=aim_row.get("provisioning_ws_total", 0),
                    readiness_tier=aim_row.get("readiness_tier", "unknown"),
                    # Trailing-30d Genie signals, keyed by SFDC account_id (logfood-exact):
                    #   genie_active = Genie space w/ message usage in last 30d
                    #   genie_dollars_t30d / genie_spend_90d = standalone-Genie DBU $ (30d)
                    #   active_genie_spaces = Genie spaces with usage (last 30d)
                    genie_spend_90d=g30.get("genie_revenue_30d", 0.0),
                    genie_dollars_t30d=g30.get("genie_revenue_30d", 0.0),
                    active_genie_spaces=g30.get("active_genie_spaces", 0),
                    est_pipeline_per_month=g30.get("est_pipeline_per_month", 0.0),
                    genie_active=g30.get("genie_active", False),
                )
                # Match by sfdc id; else adopt an existing name-keyed row (first run);
                # else it's genuinely new. by_name is only used when NOT already claimed
                # by another sfdc id this run (guards duplicate names on first run).
                acct = by_sfdc.get(sfdc)
                if acct is None:
                    cand = by_name.get(name)
                    if cand is not None and not cand.sfdc_account_id:
                        acct = cand  # first-run adoption: keep its uuid, stamp the id
                if acct is None:
                    acct = Account(id=_uid(), sfdc_account_id=sfdc, created_by=SEED_MARKER, **fields)
                    session.add(acct)
                    n_new += 1
                else:
                    acct.sfdc_account_id = sfdc
                    for k, v in fields.items():
                        setattr(acct, k, v)
                    session.add(acct)
                account_ids[sfdc] = acct.id
                n_accounts += 1
            session.flush()

            # --- GTM-mirror children: rebuild fresh (no user data on these) ---
            # Safe inside the txn — rolled back with everything else on failure.
            session.exec(delete(StageTransition))
            session.exec(delete(UseCase))
            session.exec(delete(AccountIssue))
            session.flush()

            # Insert use cases first and FLUSH before their stage_transition children:
            # there's no ORM relationship between them, so SQLAlchemy orders inserts by
            # mapper sort key — and gat_stage_transition sorts before gat_use_case, which
            # would violate the FK. Two passes with a flush between guarantee the parent
            # rows exist first.
            pending_transitions: list[tuple[str, str]] = []  # (use_case_id, stage)
            for row in use_cases:
                stage = STAGE_MAP.get(row["stage"])
                if stage is None:
                    continue
                aid = account_ids.get(row["account_id"])
                if aid is None:
                    continue
                ucid = _uid()
                session.add(
                    UseCase(
                        id=ucid, account_id=aid, title=row["usecase_name"],
                        description=row["description"], stage=stage,
                        estimated_monthly_dbus=row["dbus"], created_by=SEED_MARKER,
                    )
                )
                pending_transitions.append((ucid, stage))
                n_use_cases += 1
            session.flush()  # parents committed to the FK's satisfaction

            for ucid, stage in pending_transitions:
                session.add(
                    StageTransition(
                        id=_uid(), use_case_id=ucid, from_stage="", to_stage=stage,
                        created_by=SEED_MARKER,
                    )
                )

            for row in issues:
                aid = account_ids.get(row["account_id"])
                if aid is None:
                    continue
                session.add(
                    AccountIssue(
                        id=str(row["id"]), account_id=aid, display_id=row["display_id"],
                        title=row["title"], severity=row["severity"], status=row["status"],
                        product_area=row["product_area"], revenue_impact=row["revenue_impact"],
                        investigator=row["investigator"], synced_by=SEED_MARKER,
                    )
                )
                n_issues += 1

            # --- Prune accounts that dropped out of the live universe --------------
            # An account previously seeded but NOT in this run's active set (dormant /
            # lost paid usage) is removed — BUT only if it is GTM-seeded AND carries no
            # user-entered data (no adoption task state/history, no plan items). Any
            # account someone has worked is always kept, so hand-entered signal is safe.
            # Set-based (one statement per table, not a per-row loop — that made hundreds
            # of round-trips and stranded on a slow Lakebase connection).
            live_ids = set(account_ids.values())
            prunable = [
                a.id for a in all_existing
                if a.id not in live_ids and a.created_by == SEED_MARKER
            ]
            if prunable:
                conn = session.connection()  # raw SQL via the bound connection
                worked = {
                    r[0]
                    for r in conn.execute(
                        text(
                            "SELECT account_id FROM gat_adoption_task_state WHERE account_id = ANY(:ids) "
                            "UNION SELECT account_id FROM gat_adoption_task_history WHERE account_id = ANY(:ids) "
                            "UNION SELECT account_id FROM gat_account_plan_item WHERE account_id = ANY(:ids)"
                        ),
                        {"ids": prunable},
                    ).all()
                }
                to_drop = [aid for aid in prunable if aid not in worked]
                if to_drop:
                    p = {"ids": to_drop}
                    conn.execute(
                        text(
                            "DELETE FROM gat_stage_transition WHERE use_case_id IN "
                            "(SELECT id FROM gat_use_case WHERE account_id = ANY(:ids))"
                        ),
                        p,
                    )
                    conn.execute(text("DELETE FROM gat_use_case WHERE account_id = ANY(:ids)"), p)
                    conn.execute(text("DELETE FROM gat_account_issue WHERE account_id = ANY(:ids)"), p)
                    conn.execute(text("DELETE FROM gat_account WHERE id = ANY(:ids)"), p)
                    n_pruned = len(to_drop)
            # session.begin() commits here on success, or rolls back on any exception.

    print(
        f"Refreshed {n_accounts} accounts ({n_new} new), {n_use_cases} use cases, "
        f"{n_issues} issues. Pruned {n_pruned} dormant accounts (no user data). "
        f"User entries (adoption tasks + plan notes) preserved in place."
    )


if __name__ == "__main__":
    main()
