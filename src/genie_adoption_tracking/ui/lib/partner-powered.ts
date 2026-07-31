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

// --- User provisioning: AIM or SCIM --------------------------------------------
// The Genie-ready criterion is account-level user provisioning via EITHER Automatic
// Identity Management (AIM, preferred) OR SCIM (acceptable fallback). Both put
// users/groups in place for Genie sharing & governance. See go/genieready.

export const AIM_DOCS_URL =
  "https://docs.databricks.com/aws/en/admin/users-groups/automatic-identity-management/";

// Field references for the Genie-ready provisioning criterion.
export const GENIE_READY_DOC_URL = "https://go/genieready";
export const GENIE_READY_DASHBOARD_URL =
  "https://home.databricks.com/sales/field-performance/products/genie-and-ai-bi/";

export const AIM_OFF_NEXT_STEPS = [
  "Set up account-level user provisioning — AIM (preferred) or SCIM.",
  "AIM: enable Automatic Identity Management for the account (Entra/Okta) for just-in-time provisioning.",
  "SCIM: if AIM isn't available for this cloud/IdP, configure account-level SCIM provisioning instead.",
  "Once identities are in place, share the Genie space with the right business-user groups.",
];

export type EnforceStatus = "on" | "off" | "unknown";

// Short badge label for the account-level Enforce setting.
export function enforceLabel(enforce: string): string {
  if (enforce === "on") return "Enforce On";
  if (enforce === "off") return "Enforce Off";
  return "Enforce Unknown";
}

// Tone of the enforce badge *in the Partner-Powered-off context* (where it's shown).
// PP off + enforce on → every workspace is hard-blocked (bad).
// PP off + enforce off → a workspace could still enable it (a lever — warn, not block).
export function enforceTone(enforce: string): "bad" | "warn" | "muted" {
  if (enforce === "on") return "bad";
  if (enforce === "off") return "warn";
  return "muted";
}

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
