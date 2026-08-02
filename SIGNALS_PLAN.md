# Signals Redesign — Plan

Goal: turn Signals from a sparse tile grid into a **"start big → drill down"** leadership
view, bringing in the most important info from the logfood *FINS Genie AI Adoption*
dashboard (4 pages: Partner-Powered AI, Genie Accounts, Brickroad, Genie Ready), while
letting anyone dig deeper into what account teams are actually filling in.

## Design: three tiers on one page

### Tier 1 — Headline row (start big)
The numbers leadership wants at a glance. Clickable where it makes sense.
- FINS accounts
- Accounts with Genie activity (genie_active)
- **Genie spend / mo** ($ — NEW, from logfood usage_dollars)
- Workspaces with Genie
- Active Genie use cases (u6 / live)
- Avg readiness (workflow-driven — already have)

### Tier 2 — Four lenses (each a section, each drillable)
1. **Adoption funnel** — count + **$DBU** by UCO stage (have count; ADD $ per stage).
2. **Readiness tiers** — 🟢 Green / 🟡 Yellow / 🔴 Red counts (NEW — from
   rpt_account_genie_ready.account_readiness_level). Mirrors the logfood "Genie Ready" page.
3. **Partner-Powered AI** — On / Off-enforced (blocked) / Off-but-consuming-via-workspaces
   (reuse the effective-enabled logic). Mirrors logfood "PP AI off" page.
4. **Brickroad issues** — total / at-risk / revenue impact / by category (have gat_account_issue).

### Tier 3 — Drill-down
Every counter / segment / stage / tier is a **link into the Accounts list filtered to those
accounts**, where the SA sees each account's workflow + what the team has filled. This is the
"dig deeper based on what accounts are filling" flow. Requires:
- Accounts list already supports server-side `?q=`; ADD segment/filter params (e.g.
  `?readiness=red`, `?pp=off`, `?stage=u3`, `?tier=green`) so a Signals click deep-links.
- (This filter capability also feeds Campaigns v2 targeting — shared work.)

## Data to add to the seed (gat_account new columns)
From `main.gtm_gold.rpt_account_genie_ready` (already the seed's AIM source):
- `readiness_tier` (VARCHAR) ← account_readiness_level (green/yellow/red/unknown; strip emoji)
- `genie_spend_90d` (DOUBLE) ← usage_dollars_l90d
- (optional) `db1_mau`, `consumer_sql_mau` for engagement depth

All additive columns → SP startup migration + reseed (entry-preserving seed already safe).

## Backend
- Extend `get_dashboard` (DashboardOut) with: genie_spend_total, funnel $ per stage,
  readiness tier counts (green/yellow/red/unknown), (PP breakdown already derivable).
- Accounts list `list_accounts`: accept optional filters (readiness, pp, tier, stage, provisioning)
  in addition to `q`.

## Frontend
- dashboard.tsx: 3-tier layout; readiness-tier section; $ in funnel; make tiles/rows Links to
  /accounts?<filter>.
- accounts.index.tsx: read filter query params → call API with them → show "Filtered: <label>
  (N) · clear" header when arriving from a Signals drill-down.

## Build order (stages)
1. Seed + schema: readiness_tier + genie_spend_90d (deploy + reseed).
2. Backend: dashboard fields + accounts filters.
3. Frontend: Signals 3-tier redesign.
4. Frontend: Accounts filtered-arrival view + wire Signals links.

## Open questions for Richa
- "Genie spend" = usage_dollars_l90d (all Genie/DBSQL) or a Genie-specific slice?
- Show $ to all users, or gate revenue to leadership?
- Readiness tiers (Green/Yellow/Red) come from GTM (rpt_account_genie_ready) — keep as a
  separate GTM signal, distinct from the workflow-driven readiness % (which is team-filled).
  Confirm both shown side by side is OK (GTM tier vs team progress).

## NOTE — after Signals: CAMPAIGNS v2 (queued, per Richa)
Composable filter permutations, add/remove accounts, ask questions/actions, form link whose
answers land in Lakebase, per-account campaign participation history + results + dates, unique
form link per customer, auto-targeting. (Generation stays manual.)
