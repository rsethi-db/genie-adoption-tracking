"""
Sync Genie Adoption Tracking signal from Lakebase → Unity Catalog.

The app writes all signal to Lakebase (Databricks managed Postgres). To make that
signal queryable in AI/BI dashboards and a Genie space, this job mirrors the six
`gat_*` tables into Delta tables in Unity Catalog.

Run it on a schedule (e.g. hourly) as a Databricks Job, or ad hoc. It is a full
snapshot overwrite — the signal volume is tiny (rows scale with use cases, not
events-per-second), so simplicity beats incremental here.

Usage (locally, against fevm):
    databricks-connect / notebook:  just run the cells
    CLI job:  set the env vars below and run with a serverless job

Environment / widgets:
    CATALOG   Unity Catalog catalog to write to      (default: richa_sethi)
    SCHEMA    Schema to write to                       (default: genie_adoption)
    PG_HOST   Lakebase read-write DNS                  (from the DB instance)
    PG_DB     Postgres database name                   (default: databricks_postgres)
    PG_USER   Postgres user (SP client id or user)     (required)
    INSTANCE  Lakebase instance name                   (default: genie-adoption-tracking)

The Postgres password is a short-lived credential minted from the Databricks SDK,
so no secret is stored.
"""

from __future__ import annotations

import os

from databricks.sdk import WorkspaceClient
from pyspark.sql import SparkSession  # ty: ignore[unresolved-import]  # provided by the Databricks runtime

TABLES = [
    "gat_account",
    "gat_use_case",
    "gat_checklist_progress",
    "gat_blocker",
    "gat_stage_transition",
    "gat_resource_click",
]


def _cfg(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def main() -> None:
    catalog = _cfg("CATALOG", "richa_sethi")
    schema = _cfg("SCHEMA", "genie_adoption")
    instance = _cfg("INSTANCE", "genie-adoption-tracking")
    pg_db = _cfg("PG_DB", "databricks_postgres")
    pg_host = _cfg("PG_HOST")
    pg_user = _cfg("PG_USER")

    ws = WorkspaceClient()

    # Resolve host + a fresh credential if not explicitly provided.
    if not pg_host:
        inst = ws.database.get_database_instance(instance)
        pg_host = inst.read_write_dns
    if not pg_user:
        pg_user = ws.config.client_id or ws.current_user.me().user_name
    cred = ws.database.generate_database_credential(instance_names=[instance])
    pg_password = cred.token

    spark = SparkSession.builder.getOrCreate()
    spark.sql(f"CREATE CATALOG IF NOT EXISTS {catalog}")
    spark.sql(f"CREATE SCHEMA IF NOT EXISTS {catalog}.{schema}")

    jdbc_url = f"jdbc:postgresql://{pg_host}:5432/{pg_db}?sslmode=require"
    props = {
        "user": pg_user,
        "password": pg_password,
        "driver": "org.postgresql.Driver",
    }

    for table in TABLES:
        print(f"Syncing {table} → {catalog}.{schema}.{table}")
        df = (
            spark.read.format("jdbc")
            .option("url", jdbc_url)
            .option("dbtable", f"public.{table}")
            .options(**props)
            .load()
        )
        (
            df.write.format("delta")
            .mode("overwrite")
            .option("overwriteSchema", "true")
            .saveAsTable(f"{catalog}.{schema}.{table}")
        )
        print(f"  wrote {df.count()} rows")

    # Comment the tables so Genie / AI-BI have context.
    _comments = {
        "gat_account": "Customer accounts running the Genie Field Adoption Playbook.",
        "gat_use_case": "Genie use cases being driven through UCO stages Pre-Reqs→U6.",
        "gat_checklist_progress": "Per-use-case playbook action items checked off (Happy Path/Recommended/As Needed).",
        "gat_blocker": "Blockers flagged against use cases, by the 5 'Getting Unstuck' categories.",
        "gat_stage_transition": "Every stage advance/change; drives the adoption funnel.",
        "gat_resource_click": "Which go/ playbook resources the field pulls; engagement signal.",
    }
    for table, comment in _comments.items():
        spark.sql(
            f"COMMENT ON TABLE {catalog}.{schema}.{table} IS '{comment}'"
        )

    print("Sync complete.")


if __name__ == "__main__":
    main()
