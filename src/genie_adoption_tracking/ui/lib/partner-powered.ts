// Partner-Powered AI status helpers. Genie relies on Partner-Powered AI (external
// models via the LLM proxy); if it's OFF at the account level, Genie can't consume —
// so the next step is a Security Review to enable it.

export const PP_DOCS_URL =
  "https://docs.databricks.com/aws/en/databricks-ai/partner-powered";
// Internal FINS Security Review play (from the Genie playbook resources).
export const PP_SECURITY_REVIEW_URL = "https://go/genie";

export type PpStatus = "on" | "on_default" | "off" | "unknown";

// Partner-Powered AI is enabled by default, so "on" and "on_default" both mean Genie
// can consume. Only an explicit "off" blocks it.
export function isPpEnabled(status: string): boolean {
  return status === "on" || status === "on_default";
}

export function ppLabel(status: string): string {
  if (status === "on") return "Partner-Powered AI: On";
  if (status === "on_default") return "Partner-Powered AI: On (default)";
  if (status === "off") return "Partner-Powered AI: Off";
  return "Partner-Powered AI: Unknown";
}

export function ppTone(status: string): "good" | "bad" | "muted" {
  if (isPpEnabled(status)) return "good";
  if (status === "off") return "bad";
  return "muted";
}

// The account team's next steps when PP is off (Genie is blocked at the source).
export const PP_OFF_NEXT_STEPS = [
  "Conduct an AI Security Review with the customer to approve Partner-Powered AI.",
  "In the account console → Settings → Feature enablement, set “Enable partner-powered AI features” to On.",
  "Set the Enforce option so the account value applies to all workspaces (prevents per-workspace override).",
  "Confirm Genie can reach Partner-Powered models, then start the U1 demo.",
];

// --- Automatic Identity Management (AIM) ---------------------------------------
// AIM auto-provisions identities (Entra ID) into Databricks. It's a prerequisite for
// the smoothest Genie rollout (users/groups available for sharing & governance).

export const AIM_DOCS_URL =
  "https://docs.databricks.com/aws/en/admin/users-groups/scim/aim";

export const AIM_OFF_NEXT_STEPS = [
  "Enable Automatic Identity Management in the account console → Settings → Identity.",
  "Confirm Entra ID users/groups are provisioned into the workspace.",
  "Once identities are in place, share the Genie space with the right business-user groups.",
];

// Short implication text for the enforce setting.
export function enforceImplication(enforce: string, ppStatus: string): string | null {
  if (ppStatus === "off" && enforce === "off") {
    return "Enforce is off, so individual workspaces could still enable Partner-Powered AI — but the account default blocks it. Enable at the account level and enforce.";
  }
  if (ppStatus === "off" && enforce === "on") {
    return "Enforce is on with Partner-Powered AI off — every workspace is blocked from Genie until the account setting is turned on.";
  }
  if (ppStatus === "on" && enforce === "on") {
    return "Enforce is on — the account setting applies to all workspaces, so Genie is consistently available.";
  }
  return null;
}
