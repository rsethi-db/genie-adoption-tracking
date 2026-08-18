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
    # New columns are added to any pre-existing gat_campaign; the dropped legacy
    # columns (ask/cta/segment/sub_vertical/deadline/priority/active) are simply left
    # in place if present — harmless and avoids destructive DDL.
    "ALTER TABLE gat_campaign ADD COLUMN IF NOT EXISTS start_date VARCHAR NOT NULL DEFAULT ''",
    "ALTER TABLE gat_campaign ADD COLUMN IF NOT EXISTS end_date VARCHAR NOT NULL DEFAULT ''",
    "ALTER TABLE gat_campaign ADD COLUMN IF NOT EXISTS audience_text VARCHAR NOT NULL DEFAULT ''",
    "ALTER TABLE gat_campaign ADD COLUMN IF NOT EXISTS account_ids JSON NOT NULL DEFAULT '[]'",
    "ALTER TABLE gat_campaign ADD COLUMN IF NOT EXISTS form_url VARCHAR NOT NULL DEFAULT ''",
    # In-app questionnaire + activation.
    "ALTER TABLE gat_campaign ADD COLUMN IF NOT EXISTS form_token VARCHAR NOT NULL DEFAULT ''",
    "ALTER TABLE gat_campaign ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'draft'",
]


class _MigrationDependency(LifespanDependency):
    @asynccontextmanager
    async def lifespan(self, app: FastAPI) -> AsyncGenerator[None, None]:
        engine = getattr(app.state, "engine", None)
        if engine is not None:
            try:
                with engine.begin() as conn:
                    for stmt in _MIGRATIONS:
                        conn.execute(text(stmt))
                logger.info("Startup migrations applied")
            except Exception as e:  # non-fatal: never block startup on a migration
                logger.warning(f"Startup migration skipped: {e}")
        yield

    @staticmethod
    def __call__(request: Request) -> Generator[None, None, None]:
        yield


MigrationDependency: TypeAlias = Annotated[None, _MigrationDependency.depends()]
