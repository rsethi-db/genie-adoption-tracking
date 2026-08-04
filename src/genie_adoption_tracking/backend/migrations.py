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
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS genie_dollars_t30d DOUBLE PRECISION NOT NULL DEFAULT 0",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS active_genie_spaces INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE gat_account ADD COLUMN IF NOT EXISTS sfdc_account_id VARCHAR NOT NULL DEFAULT ''",
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
