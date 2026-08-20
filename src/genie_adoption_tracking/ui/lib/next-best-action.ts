// Next-best-action engine for the account page.
//
// The account page holds rich per-account signals (PP/enforce, provisioning/AIM,
// Genie-Ready tier, genie-active, Genie $, active spaces, use-case stages, Brickroad
// issues, security blocker). Rather than ask a team to fill a blank questionnaire, we
// DERIVE where the account is and RECOMMEND the single highest-leverage next move —
// with a plain-English "why" and the payoff. This makes the page feel like getting
// value ("start here"), not like data entry.
//
// Pure functions over AccountDetailOut so the logic is easy to reason about and reuse.

import type { AccountDetailOut } from "@/lib/api";
import { isPpEnabled, isPpEffectivelyEnabled } from "@/lib/partner-powered";

export type ActionTone = "blocked" | "activate" | "grow" | "done";

export interface NextAction {
  key: string;
  title: string; // the imperative move: "Enable Partner-Powered AI"
  why: string; // why it matters, tied to this account's numbers
  tone: ActionTone;
  href?: string; // optional deep link (docs / play)
  hrefLabel?: string;
}

function fmtDbus(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

type SeriesPoint = [string, number];

// Momentum from the daily $DBU series: compare the last 14 days to the prior 14.
// Returns direction + pct so callers can flag accelerating / dropping / went-dark.
export interface Momentum {
  dir: "up" | "down" | "flat" | "dark" | "none";
  pct: number; // signed % change, last-14d vs prior-14d
  recent: number; // last-14d total
  prior: number; // prior-14d total
  daysDark: number; // trailing consecutive days at ~$0
}

export function momentum(series?: unknown[]): Momentum {
  const pts = (series ?? []) as SeriesPoint[];
  if (pts.length < 4) return { dir: "none", pct: 0, recent: 0, prior: 0, daysDark: 0 };
  // Sum by recency using the last 28 available points (series is oldest→newest).
  const last28 = pts.slice(-28);
  const half = Math.floor(last28.length / 2);
  const prior = last28.slice(0, half).reduce((s, p) => s + (p[1] || 0), 0);
  const recent = last28.slice(half).reduce((s, p) => s + (p[1] || 0), 0);
  // Trailing consecutive near-zero days (churn signal).
  let daysDark = 0;
  for (let i = pts.length - 1; i >= 0; i--) {
    if ((pts[i][1] || 0) < 1) daysDark++;
    else break;
  }
  const pct = prior > 0 ? ((recent - prior) / prior) * 100 : recent > 0 ? 100 : 0;
  let dir: Momentum["dir"] = "flat";
  if (recent < 1 && prior > 0) dir = "dark";
  else if (pct >= 20) dir = "up";
  else if (pct <= -30) dir = "down";
  return { dir, pct: Math.round(pct), recent, prior, daysDark };
}

// Days since an ISO datetime (UTC-safe enough for day-grain staleness).
function daysSince(iso?: string): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86_400_000);
}

// Whitespace = can consume Genie (PP on, or off-but-not-enforced) + provisioned + no
// active agent yet. Same definition as Signals.
export function isWhitespace(a: AccountDetailOut): boolean {
  const pp = a.pp_status ?? "unknown";
  const canConsume =
    isPpEnabled(pp) || (pp === "off" && (a.pp_enforce ?? "") !== "on");
  const provisioned =
    a.provisioning_status === "on" || a.provisioning_status === "partial";
  const idle = (a.active_genie_spaces ?? 0) === 0;
  return canConsume && provisioned && idle;
}

// Build the prioritized list of recommended actions. First item = "start here".
// Ordering encodes leverage: unblock (nothing works until fixed) → enable identity →
// activate idle-but-ready → grow active accounts → celebrate/maintain.
export function nextActions(a: AccountDetailOut): NextAction[] {
  const out: NextAction[] = [];
  const pp = a.pp_status ?? "unknown";
  const enforce = a.pp_enforce ?? "unknown";
  const wsOn = a.ws_pp_on ?? 0;
  const ppEffective = isPpEffectivelyEnabled(pp, enforce, wsOn);
  const provisioned =
    a.provisioning_status === "on" || a.provisioning_status === "partial";
  const spend90 = a.genie_spend_90d ?? 0;
  const activeSpaces = a.active_genie_spaces ?? 0;
  const tier = a.readiness_tier ?? "unknown";
  const mo = momentum(a.genie_dbu_series);
  // Use cases not yet Live (U6) that haven't moved in 30+ days = stalled.
  const stalledUcs = (a.use_cases ?? []).filter(
    (u) => u.stage !== "u6" && daysSince(u.updated_at) >= 30,
  );

  // 1. HARD BLOCK — Partner-Powered AI off + enforced. Nothing else can happen.
  if (pp === "off" && enforce === "on") {
    out.push({
      key: "pp_blocked",
      tone: "blocked",
      title: "Enable Partner-Powered AI (Genie is hard-blocked)",
      why:
        "Partner-Powered AI is off and enforced, so Genie cannot consume in any workspace. " +
        "Run an AI Security Review to approve it — this unblocks everything else.",
      href: "https://go/genie",
      hrefLabel: "Security Review play",
    });
    return out; // don't distract with anything else until unblocked
  }

  // 2. Security Authority Review blocker flagged (from the GTM blockers sheet).
  if (a.security_blocker) {
    out.push({
      key: "sec_review",
      tone: "blocked",
      title: "Engage the Security SWAT team on the Authority Review",
      why:
        "This account has an open Security Authority Review blocker — the top gate " +
        "before Genie can move forward.",
      href: "http://genie-ppai-tracking-6583047541360945.5.azure.databricksapps.com/",
      hrefLabel: "Open the review app",
    });
  }

  // 2b. CHURN EARLY-WARNING — usage was there and has gone dark or dropped sharply.
  // High urgency: re-engage before the account fully lapses.
  if (mo.dir === "dark" && mo.daysDark >= 7) {
    out.push({
      key: "went_dark",
      tone: "blocked",
      title: "Re-engage — Genie usage has gone quiet",
      why:
        `Genie $ dropped to ~$0 for ${mo.daysDark} days after ${fmtDbus(mo.prior)} the prior ` +
        "two weeks. Check in with the champion before this account lapses.",
    });
  } else if (mo.dir === "down") {
    out.push({
      key: "usage_down",
      tone: "activate",
      title: "Check in — Genie usage is dropping",
      why:
        `Genie $ is down ${Math.abs(mo.pct)}% over the last two weeks ` +
        `(${fmtDbus(mo.prior)} → ${fmtDbus(mo.recent)}). Worth a proactive touch to find out why.`,
    });
  }

  // 3. PP off (not enforced) — a lever, not a wall, but worth enabling cleanly.
  if (pp === "off" && enforce !== "on" && !ppEffective) {
    out.push({
      key: "pp_enable",
      tone: "blocked",
      title: "Turn on Partner-Powered AI at the account level",
      why:
        "The account default is off (enforce off). Enable it account-wide so Genie " +
        "consumption isn't left to per-workspace overrides.",
      href: "https://go/genie",
      hrefLabel: "How to enable",
    });
  }

  // 4. Can consume, but not provisioned — identity is the gate to real usage.
  if (ppEffective && !provisioned) {
    out.push({
      key: "provision",
      tone: "activate",
      title: "Set up user provisioning (AIM or SCIM)",
      why:
        "Genie can consume here, but users aren't provisioned — so sharing Genie spaces " +
        "with business users isn't possible yet. AIM/SCIM moves this account toward Genie-Ready Green.",
      href: "https://go/genieready",
      hrefLabel: "Genie-Ready criteria",
    });
  }

  // 4b. MILESTONE NUDGE — Yellow tier: has pre-reqs + AIM/SCIM, but can't yet onboard
  // SQL-only / consumer-only users. That last capability flips it to Genie-Ready (Green).
  // (Genie-Ready is a per-account tier: ONE qualifying workspace is enough — it is NOT
  // a "provision every workspace" goal.)
  if (ppEffective && tier === "yellow") {
    out.push({
      key: "tier_to_green",
      tone: "activate",
      title: "Enable SQL-only / consumer-only onboarding to reach Genie-Ready",
      why:
        "This account has the pre-requisites and AIM/Account SCIM (Yellow), but can't yet " +
        "onboard SQL-only or consumer-only users — the last step to Genie-Ready (Green).",
      href: "https://go/genieready",
      hrefLabel: "Genie-Ready criteria",
    });
  }

  // 5. WHITESPACE — ready to consume + provisioned, but no active agent. Activate it.
  if (isWhitespace(a)) {
    out.push({
      key: "activate",
      tone: "activate",
      title: "Run a demo on their domain data to activate Genie",
      why:
        "This account is ready — Partner-Powered AI on and provisioned — but has no active " +
        "Genie agent yet. A domain-data demo is the fastest path from ready to live.",
      href: "https://dbdemos-demo-catalog-2556758628403379.aws.databricksapps.com/",
      hrefLabel: "Demo assets",
    });
  }

  // 6. Active but Red tier — usage exists without the pre-reqs/identity foundation.
  if (activeSpaces > 0 && tier === "red") {
    out.push({
      key: "shore_up",
      tone: "grow",
      title: "Shore up UC pre-reqs and identity",
      why:
        `Genie is being used (${activeSpaces} active space${activeSpaces === 1 ? "" : "s"}) ` +
        "but the account is Red — no UC pre-reqs or identity management. Lock these in to protect and scale usage.",
      href: "https://go/genieready",
      hrefLabel: "Genie-Ready criteria",
    });
  }

  // 6b. STALLED USE CASES — not Live and untouched 30+ days. Unblock or close.
  if (stalledUcs.length > 0) {
    const oldest = stalledUcs.reduce((a1, b) =>
      daysSince(b.updated_at) > daysSince(a1.updated_at) ? b : a1,
    );
    const blocked = stalledUcs.filter((u) => (u.open_blockers ?? 0) > 0).length;
    out.push({
      key: "stalled_uc",
      tone: "activate",
      title:
        stalledUcs.length === 1
          ? `Unblock "${oldest.title}" — stalled ${daysSince(oldest.updated_at)}d`
          : `Unblock ${stalledUcs.length} stalled use cases`,
      why:
        `${stalledUcs.length} use case${stalledUcs.length === 1 ? " has" : "s have"} not moved in ` +
        `30+ days and ${stalledUcs.length === 1 ? "isn't" : "aren't"} Live` +
        (blocked > 0 ? `; ${blocked} ha${blocked === 1 ? "s" : "ve"} an open blocker` : "") +
        ". Re-engage to move them forward — or close what's dead.",
    });
  }

  // 7. Accelerating usage — strike while it's hot: expand to a new team.
  if (mo.dir === "up" && activeSpaces > 0 && tier !== "red") {
    out.push({
      key: "accelerating",
      tone: "grow",
      title: "Usage is accelerating — expand while it's hot",
      why:
        `Genie $ is up ${mo.pct}% over the last two weeks ` +
        `(${fmtDbus(mo.prior)} → ${fmtDbus(mo.recent)}). Land a second team's use case now ` +
        "while momentum is on your side.",
      href: "https://docs.google.com/presentation/d/1qgix9HjPgRWu-HHUJtf6KArsH3hUDcQI15BLqyz4sns/edit",
      hrefLabel: "Win Business User play",
    });
  } else if (activeSpaces > 0 && spend90 > 0 && tier !== "red") {
    // 7b. Active + spending (steady) — run the Win Business User play to grow.
    out.push({
      key: "grow",
      tone: "grow",
      title: "Run the Win Business User play with a new team",
      why:
        `This account is live and consuming (${fmtDbus(spend90)} Genie $ / 30d, ` +
        `${activeSpaces} active space${activeSpaces === 1 ? "" : "s"}). Identify a second business ` +
        "team and run the play to land their use case.",
      href: "https://docs.google.com/presentation/d/1qgix9HjPgRWu-HHUJtf6KArsH3hUDcQI15BLqyz4sns/edit",
      hrefLabel: "Win Business User play",
    });
  }

  // Fallback — healthy, nothing pressing.
  if (out.length === 0) {
    out.push({
      key: "maintain",
      tone: "done",
      title: "On track — keep the momentum",
      why:
        "No blockers detected from platform signals. Keep driving use cases forward and " +
        "check the workflow below for the next human step.",
    });
  }
  return out;
}
