# Genie Adoption Tracking

An app that makes the **FINS Genie Field Adoption Playbook** actionable for account
teams — and captures the signal that feeds MBR reporting.

Built on the [`apx`](https://github.com/databricks-solutions/apx) framework
(React + Vite frontend, FastAPI backend) with **Lakebase** (Databricks managed
Postgres) for persistence.

## What it does

The playbook (from the FINS FE Huddle deck, slides 60–63) is a matrix: UCO-aligned
stages (Pre-Reqs → U1 … U6 Live) × three action lanes (Happy Path / Recommended /
As Needed), plus a five-category "Getting Unstuck" blocker flow and a library of
`go/` resources. On its own it's a static reference. This app turns it into a tool.

### Two surfaces

**1. Playbook Runner** (`/use-cases`)
- Register an account + Genie use case; it starts at Pre-Reqs.
- The current stage shows its checklist grouped by lane, with a progress bar.
- **"I'm stuck"** → pick a blocker category → see the recommended counter-action and
  the exact resource to pull (from slide 62). Flagging it is captured as signal.
- Contextual resource panel shows only the `go/` links relevant to the current stage.
- Advance/rewind through stages with the stepper or footer nav.

**2. Signal Dashboard** (`/dashboard`)
- U1→U6 adoption funnel (use cases by current stage).
- Blockers by category (open vs resolved) — tells the org where the friction is.
- Stalled use cases (no movement in 14+ days).
- Most-pulled resources.

**3. Playbook reference** (`/playbook`) — the full matrix, blocker flow, and resource
library, rendered read-only.

## Signal model (Lakebase → Unity Catalog)

Playbook *content* lives in code (`backend/playbook.py`), versioned in git. Only what
account teams *do* is persisted, in six `gat_*` Lakebase tables:

| Table | Signal |
|---|---|
| `gat_account` | accounts + AE/SA owners |
| `gat_use_case` | Genie use cases + current stage |
| `gat_checklist_progress` | every action item checked/unchecked |
| `gat_blocker` | flagged blockers by category, open/resolved |
| `gat_stage_transition` | every stage change → the funnel |
| `gat_resource_click` | which resources get pulled → engagement |

`scripts/uc_sync.py` mirrors these into Unity Catalog Delta tables
(`<catalog>.genie_adoption.gat_*`) so you can build an AI/BI dashboard and a Genie
space on top of the very signal the playbook says to capture.

## Local development

```bash
# fevm auth must be valid first:
databricks auth login --profile fevm-richasethi

apx dev start        # backend + frontend + local Postgres + OpenAPI watcher
apx dev check        # tsc + Python type check
apx dev logs -f      # follow logs
```

The app auto-creates its `gat_*` tables on startup (SQLModel `create_all`).

## Deploy

```bash
databricks bundle deploy -t dev -p fevm-richasethi
databricks bundle run   -t dev genie-adoption-tracking-app -p fevm-richasethi
```

The bundle (`databricks.yml`) provisions a `CU_1` Lakebase instance and the app with
`CAN_CONNECT_AND_CREATE`, so tables are created on first boot.

## UC sync

Run `scripts/uc_sync.py` as a serverless Databricks Job (hourly is plenty). Set
`CATALOG` / `SCHEMA` if you want somewhere other than `richa_sethi.genie_adoption`.

## Layout

```
src/genie_adoption_tracking/
  backend/
    playbook.py   # the playbook, encoded (single source of truth)
    db.py         # SQLModel tables (Lakebase)
    models.py     # Pydantic I/O models
    router.py     # all API routes
  ui/
    routes/       # index, use-cases, use-cases.$id (Runner), dashboard, playbook
    components/   # app-shell + shadcn/ui
    lib/          # generated api.ts client, playbook-ui helpers
scripts/uc_sync.py
```
