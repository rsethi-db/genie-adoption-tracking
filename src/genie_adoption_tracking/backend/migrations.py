"""
Lightweight, idempotent startup migrations.

SQLModel's `create_all` (run by the lakebase addon on startup) creates missing
tables but never ALTERs existing ones. When we add a column to an existing table,
the deployed Lakebase table would otherwise lag the model. These `ADD COLUMN IF NOT
EXISTS` statements run inside the app — which connects as the service principal that
owns the tables — so they have the privilege to alter them.

Registered as a LifespanDependency imported last in app.py, so it chains after the
lakebase lifespan (which sets `app.state.engine`).
"""

from __future__ import annotations

from collections.abc import Generator
from contextlib import asynccontextmanager
from typing import Annotated, AsyncGenerator, TypeAlias

from fastapi import FastAPI, Request
from sqlalchemy import text

from .core._base import LifespanDependency
from .core._config import logger

# Idempotent DDL applied on every boot. Safe to run repeatedly.
_MIGRATIONS = [
    "ALTER TABLE gat_use_case "
    "ADD COLUMN IF NOT EXISTS estimated_monthly_dbus "
    "DOUBLE PRECISION NOT NULL DEFAULT 0",
    "ALTER TABLE gat_use_case ADD COLUMN IF NOT EXISTS stage_move_in_date TIMESTAMP",
    "ALTER TABLE gat_account "
    "ADD COLUMN IF NOT EXISTS dsa_owner VARCHAR NOT NULL DEFAULT ''",
    "ALTER TABLE gat_account "
    "ADD COLUMN IF NOT EXISTS arr DOUBLE PRECISION NOT NULL DEFAULT 0",
    "ALTER TABLE gat_account "
    "ADD COLUMN IF NOT EXISTS pp_status VARCHAR NOT NULL DEFAULT 'unknown'",
    "ALTER TABLE gat_account "
    "ADD COLUMN IF NOT EXISTS pp_enforce VARCHAR NOT NULL DEFAULT 'unknown'",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS ws_total INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS ws_pp_on INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS ws_pp_off INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS aim_status VARCHAR NOT NULL DEFAULT 'unknown'",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS aim_ws_enabled INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS provisioning_status VARCHAR NOT NULL DEFAULT 'unknown'",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS provisioning_ws_enabled INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS provisioning_ws_total INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS genie_active BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS readiness_tier VARCHAR NOT NULL DEFAULT 'unknown'",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS genie_spend_90d DOUBLE PRECISION NOT NULL DEFAULT 0",
    # New gat_account columns from main (Genie spend/spaces, SFDC id, pipeline).
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS genie_dollars_t30d DOUBLE PRECISION NOT NULL DEFAULT 0",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS active_genie_spaces INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS sfdc_account_id VARCHAR NOT NULL DEFAULT ''",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS est_pipeline_per_month DOUBLE PRECISION NOT NULL DEFAULT 0",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS vertical VARCHAR NOT NULL DEFAULT 'FINS'",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS genie_activated BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS genie_dbu_t7d DOUBLE PRECISION NOT NULL DEFAULT 0",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS genie_dbu_t28d DOUBLE PRECISION NOT NULL DEFAULT 0",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS genie_dbu_t90d DOUBLE PRECISION NOT NULL DEFAULT 0",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS genie_dbu_series JSON NOT NULL DEFAULT '[]'",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS security_blocker BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS security_status VARCHAR NOT NULL DEFAULT ''",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS readiness_tier_prev VARCHAR NOT NULL DEFAULT 'unknown'",
    "ALTER TABLE gat_vertical_book ADD COLUMN IF NOT EXISTS book_green INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE gat_vertical_book ADD COLUMN IF NOT EXISTS book_yellow INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE gat_vertical_book ADD COLUMN IF NOT EXISTS book_red INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE gat_vertical_book ADD COLUMN IF NOT EXISTS book_green_prev INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE gat_vertical_book ADD COLUMN IF NOT EXISTS book_yellow_prev INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE gat_vertical_book ADD COLUMN IF NOT EXISTS book_red_prev INTEGER NOT NULL DEFAULT 0",
    # Adoption task state/history: human-readable account/task + questionnaire ordering.
    "ALTER TABLE gat_adoption_task_state ADD COLUMN IF NOT EXISTS account_name VARCHAR NOT NULL DEFAULT ''",
    "ALTER TABLE gat_adoption_task_state ADD COLUMN IF NOT EXISTS task_name VARCHAR NOT NULL DEFAULT ''",
    "ALTER TABLE gat_adoption_task_state ADD COLUMN IF NOT EXISTS task_order INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE gat_adoption_task_state ADD COLUMN IF NOT EXISTS count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE gat_adoption_task_history ADD COLUMN IF NOT EXISTS account_name VARCHAR NOT NULL DEFAULT ''",
    "ALTER TABLE gat_adoption_task_history ADD COLUMN IF NOT EXISTS task_name VARCHAR NOT NULL DEFAULT ''",
    "ALTER TABLE gat_adoption_task_history ADD COLUMN IF NOT EXISTS task_order INTEGER NOT NULL DEFAULT 0",
    # Campaign redesign: time-boxed outreach to a chosen set of accounts + a Form.
    # New columns are added to any pre-existing gat_campaign.
    "ALTER TABLE gat_campaign ADD COLUMN IF NOT EXISTS start_date VARCHAR NOT NULL DEFAULT ''",
    "ALTER TABLE gat_campaign ADD COLUMN IF NOT EXISTS end_date VARCHAR NOT NULL DEFAULT ''",
    "ALTER TABLE gat_campaign ADD COLUMN IF NOT EXISTS audience_text VARCHAR NOT NULL DEFAULT ''",
    "ALTER TABLE gat_campaign ADD COLUMN IF NOT EXISTS account_ids JSON NOT NULL DEFAULT '[]'",
    "ALTER TABLE gat_campaign ADD COLUMN IF NOT EXISTS form_url VARCHAR NOT NULL DEFAULT ''",
    # In-app questionnaire + activation.
    "ALTER TABLE gat_campaign ADD COLUMN IF NOT EXISTS form_token VARCHAR NOT NULL DEFAULT ''",
    "ALTER TABLE gat_campaign ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'draft'",
    # The redesign dropped these columns from the model, but a pre-existing table
    # created under the old schema still has them as NOT NULL with no default. The
    # new code never sets them, so every INSERT violated their NOT NULL constraint
    # ("null value in column ask ..."). We keep the columns (non-destructive) but drop
    # NOT NULL so the current insert succeeds. IF EXISTS guards a table already migrated.
    "ALTER TABLE gat_campaign ALTER COLUMN ask DROP NOT NULL",
    "ALTER TABLE gat_campaign ALTER COLUMN cta DROP NOT NULL",
    "ALTER TABLE gat_campaign ALTER COLUMN segment DROP NOT NULL",
    "ALTER TABLE gat_campaign ALTER COLUMN sub_vertical DROP NOT NULL",
    "ALTER TABLE gat_campaign ALTER COLUMN deadline DROP NOT NULL",
    "ALTER TABLE gat_campaign ALTER COLUMN priority DROP NOT NULL",
    "ALTER TABLE gat_campaign ALTER COLUMN active DROP NOT NULL",
]


class _MigrationDependency(LifespanDependency):
    @asynccontextmanager
    async def lifespan(self, app: FastAPI) -> AsyncGenerator[None, None]:
        engine = getattr(app.state, "engine", None)
        if engine is not None:
            # Each statement runs in its own transaction so one failure doesn't roll
            # back the rest. This matters because some statements are conditionally
            # applicable — e.g. `ALTER COLUMN ask DROP NOT NULL` errors on a fresh DB
            # where the legacy column never existed (Postgres has no IF EXISTS form
            # for it); that expected failure must not abort the other migrations.
            applied = failed = 0
            for stmt in _MIGRATIONS:
                try:
                    with engine.begin() as conn:
                        conn.execute(text(stmt))
                    applied += 1
                except Exception as e:  # non-fatal: never block startup on a migration
                    failed += 1
                    logger.warning(f"Startup migration skipped: {stmt!r}: {e}")
            logger.info(f"Startup migrations: {applied} applied, {failed} skipped")
        yield

    @staticmethod
    def __call__(request: Request) -> Generator[None, None, None]:
        yield


MigrationDependency: TypeAlias = Annotated[None, _MigrationDependency.depends()]
