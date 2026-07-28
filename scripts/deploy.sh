#!/usr/bin/env bash
#
# Fast deploy for code-only changes (React/FastAPI) — skips the full DAB bundle
# reconciliation. Builds the app wheel, syncs it to a stable workspace path, and
# rolls the running app over to it.
#
# Use this for day-to-day code changes. Use `databricks bundle deploy` +
# `databricks bundle run genie-adoption-tracking-app` ONLY when you change infra in
# databricks.yml (app resource, Lakebase instance, permissions, env vars).
#
# Usage:
#   scripts/deploy.sh              # build + sync + deploy
#   scripts/deploy.sh --no-build   # skip the wheel rebuild (sync + deploy only)
#
set -euo pipefail

PROFILE="${DATABRICKS_CONFIG_PROFILE:-richasethi}"
APP="genie-adoption-tracking"
# Stable workspace path we own and re-sync to (independent of per-deployment paths).
SRC_PATH="/Workspace/Users/amee.vora@databricks.com/.apps-src/${APP}"

export DATABRICKS_CONFIG_PROFILE="$PROFILE"

if [[ "${1:-}" != "--no-build" ]]; then
  echo "▶ Building app wheel (apx build)…"
  apx build
fi

echo "▶ Syncing .build → ${SRC_PATH} …"
databricks sync .build "$SRC_PATH" --full

echo "▶ Deploying app ${APP} …"
databricks apps deploy "$APP" --source-code-path "$SRC_PATH"

echo "▶ Status:"
databricks apps get "$APP" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('  compute   :', (d.get('compute_status') or {}).get('state'))
print('  app       :', (d.get('app_status') or {}).get('state'), '-', (d.get('app_status') or {}).get('message'))
ad=d.get('active_deployment') or {}
print('  deployment:', ad.get('deployment_id'), '|', (ad.get('status') or {}).get('state'))
"
echo "✓ Done — https://${APP}-7474645739022563.aws.databricksapps.com"
