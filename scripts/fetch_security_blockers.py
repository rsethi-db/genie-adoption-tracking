"""
Refresh scripts/security_blockers.json from the "Genie Security Blockers" Google Sheet.

The sheet lists accounts with an open Security Authority Review blocker (the accounts
that should surface the "Complete your Security Authority Review" action in the app).
The seed (seed_from_gtm.py) reads the JSON this writes and flags matching accounts —
it does NOT call Google directly, so the unattended nightly job has no Google dependency.

Run locally (requires Google auth via the fe-google-tools skill):
    uv run python scripts/fetch_security_blockers.py

Re-run whenever the sheet changes.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import requests

SHEET_ID = "1BBqXShETy7bjbmKupsOza7zH7sTJYi_BPQTCI9uw0Eg"
TAB = "Security Blockers"  # the current (top) tab
RANGE = f"'{TAB}'!A2:H60"
OUT = Path(__file__).resolve().parent / "security_blockers.json"

# Path to the shared google-auth token helper (fe-google-tools skill).
_AUTH = (
    Path.home()
    / ".vibe/marketplace/plugins/fe-google-tools/skills/google-auth/resources/google_auth.py"
)


def _token() -> str:
    out = subprocess.run(
        ["python3", str(_AUTH), "token"], capture_output=True, text=True
    )
    tok = out.stdout.strip()
    if not tok:
        sys.exit(f"Could not get Google token (run /google-auth first): {out.stderr[:200]}")
    return tok


def main() -> None:
    token = _token()
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/{RANGE}"
    resp = requests.get(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "x-goog-user-project": "gcp-sandbox-field-eng",
        },
        timeout=60,
    )
    resp.raise_for_status()
    rows = resp.json().get("values", [])
    # Columns: Account, Account Team Outreach, Security Status, SWAT Lever, Genie Ready,
    # Activation Status, SWAT Owner, SWAT Action.
    blockers = []
    for r in rows:
        name = (r[0] if r else "").strip()
        if not name:
            continue
        blockers.append(
            {
                "name": name,
                "security_status": (r[2].strip() if len(r) > 2 else ""),
                "swat_owner": (r[6].strip() if len(r) > 6 else ""),
            }
        )
    OUT.write_text(json.dumps(blockers, indent=2))
    print(f"Wrote {len(blockers)} security-blocker accounts to {OUT}")


if __name__ == "__main__":
    main()
