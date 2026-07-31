# Databricks notebook source
# MAGIC %md
# MAGIC # Genie Adoption Tracking — Lakebase → Unity Catalog sync (serverless)
# MAGIC
# MAGIC Mirrors the app's `gat_*` Lakebase (Postgres) tables into Delta tables in UC so
# MAGIC they can back an AI/BI dashboard and a **Genie Space**. Full snapshot overwrite —
# MAGIC signal volume is tiny.
# MAGIC
# MAGIC Reads Postgres via **psycopg** (no external JDBC driver needed on serverless) and
# MAGIC writes via Spark. A short-lived credential is minted from the Databricks SDK, so no
# MAGIC secret is stored.

# COMMAND ----------

# MAGIC %pip install "psycopg[binary]" "databricks-sdk>=0.40" --quiet
# MAGIC dbutils.library.restartPython()

# COMMAND ----------

import psycopg
import pandas as pd  # ty: ignore[unresolved-import]  # installed via %pip on the runtime
from databricks.sdk import WorkspaceClient
from pyspark.sql import SparkSession  # ty: ignore[unresolved-import]  # provided by the runtime

spark = SparkSession.builder.getOrCreate()

CATALOG = "richasethi_ws_catalog"
SCHEMA = "genie_adoption"
INSTANCE = "genie-adoption-tracking"
PG_DB = "databricks_postgres"

# All nine gat_* tables (uc_sync.py only covered six; the adoption-workflow,
# account-plan and account-issue tables are added here so Genie can answer
# readiness / blocker / issue questions).
TABLES = [
    "gat_account",
    "gat_use_case",
    "gat_stage_transition",
    "gat_checklist_progress",
    "gat_blocker",
    "gat_resource_click",
    "gat_adoption_task_state",
    "gat_account_plan_item",
    "gat_account_issue",
]

# COMMAND ----------

ws = WorkspaceClient()
inst = ws.database.get_database_instance(INSTANCE)
host = inst.read_write_dns
user = ws.config.client_id or ws.current_user.me().user_name
cred = ws.database.generate_database_credential(instance_names=[INSTANCE])
password = cred.token

# Catalog richasethi_ws_catalog already exists (managed). Only create the schema.
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.{SCHEMA}")

# COMMAND ----------

conn = psycopg.connect(
    host=host, dbname=PG_DB, user=user, password=password,
    sslmode="require", prepare_threshold=None,
)

for table in TABLES:
    with conn.cursor() as cur:
        cur.execute(f'SELECT * FROM public."{table}"')  # ty: ignore[no-matching-overload]
        cols = [c.name for c in cur.description]  # ty: ignore[not-iterable]
        rows = cur.fetchall()
    pdf = pd.DataFrame(rows, columns=cols)
    # Cast everything to string-safe via Spark from pandas; object dtypes with
    # datetimes/bools survive the round-trip. Empty tables still create the schema.
    if pdf.empty:
        print(f"{table}: 0 rows — skipping write (no schema to infer); will still comment if exists")
        # Create an empty table only if we can't infer schema; safe to skip.
        continue
    sdf = spark.createDataFrame(pdf)
    (
        sdf.write.format("delta")
        .mode("overwrite")
        .option("overwriteSchema", "true")
        .saveAsTable(f"{CATALOG}.{SCHEMA}.{table}")
    )
    print(f"{table}: wrote {len(pdf)} rows → {CATALOG}.{SCHEMA}.{table}")

conn.close()

# COMMAND ----------

# Table-level comments so Genie / AI-BI have business context.
_comments = {
    "gat_account": "FINS customer accounts in the Genie Field Adoption Playbook. One row per account with owners (AE/SA/DSA), sub-vertical, ARR, Partner-Powered AI status (pp_status), AIM status, whitespace flag and Genie-active flag.",
    "gat_use_case": "Genie use cases per account, driven through UCO stages Pre-Reqs→U6 (stage column). One row per real use case with estimated monthly DBUs.",
    "gat_stage_transition": "Every use-case stage advance/change; drives the U1→U6 adoption funnel.",
    "gat_checklist_progress": "Per-use-case playbook action items checked off across the Happy Path / Recommended / As Needed lanes.",
    "gat_blocker": "Blockers flagged against use cases, categorized by the 5 'Getting Unstuck' categories.",
    "gat_resource_click": "Which go/ playbook resources the field pulled; engagement signal.",
    "gat_adoption_task_state": "Per-account Adoption Workflow questionnaire responses: status (not_initiated/na/in_progress/completed/blocked) + note per task_key across the U1-U6 x lane matrix and Security & Review questions.",
    "gat_account_plan_item": "Per-account readiness action-plan items (PP enabled, Security Review, AIM, data readiness, etc.) with done-state and notes; drives readiness_pct.",
    "gat_account_issue": "Genie Brickroad issues per account (all severities: blocked/risk/friction/nice_to_have) with revenue impact; open = status not resolved/will_not_solve.",
}
for table, comment in _comments.items():
    safe = comment.replace("'", "''")
    try:
        spark.sql(f"COMMENT ON TABLE {CATALOG}.{SCHEMA}.{table} IS '{safe}'")
        print(f"commented {table}")
    except Exception as e:
        print(f"skip comment {table}: {e}")

print("Sync complete.")
