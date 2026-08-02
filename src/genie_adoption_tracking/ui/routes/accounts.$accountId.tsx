import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, useState, useEffect, type ReactNode } from "react";
import {
  useGetAccountSuspense,
  useToggleAccountPlanItem,
  useSaveAdoptionTasks,
  getAccountKey,
  listAccountsKey,
  type AccountPlanItemOut,
  type AccountIssueOut,
  type AccountDetailOut,
  type AdoptionWorkflowOut,
  type AdoptionTaskOut,
  type UseCaseListOut,
} from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Clock,
  Circle,
  MinusCircle,
  ChevronDown,
  Megaphone,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import {
  PP_DOCS_URL,
  PP_SECURITY_REVIEW_URL,
  PP_OFF_NEXT_STEPS,
  AIM_DOCS_URL,
  AIM_OFF_NEXT_STEPS,
  GENIE_READY_DOC_URL,
  GENIE_READY_DASHBOARD_URL,
  enforceImplication,
  isPpEnabled,
  isPpEffectivelyEnabled,
} from "@/lib/partner-powered";
import { openGenieChat } from "@/components/genie-chat";

export const Route = createFileRoute("/accounts/$accountId")({
  component: () => <AccountDetailPage />,
});

function fmtDbus(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function AccountDetailPage() {
  const { accountId } = Route.useParams();
  return (
    <AppShell>
      <Link
        to="/accounts"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> All accounts
      </Link>
      <Suspense fallback={<DetailSkeleton />}>
        <AccountDetail accountId={accountId} />
      </Suspense>
    </AppShell>
  );
}

function AccountDetail({ accountId }: { accountId: string }) {
  const { data } = useGetAccountSuspense({
    params: { account_id: accountId },
    query: { select: (d) => d.data },
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{data.name}</h1>
            <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {data.sub_vertical && <span>{data.sub_vertical}</span>}
              {data.ae_owner && <span>AE · {data.ae_owner}</span>}
              {data.sa_owner && <span>SA · {data.sa_owner}</span>}
              {data.dsa_owner && <span>DSA · {data.dsa_owner}</span>}
            </div>
            <div className="flex items-center gap-3 mt-3 text-sm">
              {data.monthly_dbus > 0 && (
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  {fmtDbus(data.monthly_dbus)}/mo est. DBU
                </span>
              )}
              {data.open_blockers > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {data.open_blockers} open blocker
                  {data.open_blockers === 1 ? "" : "s"}
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2 shrink-0"
            onClick={() =>
              openGenieChat(`What should I focus on next with ${data.name}?`)
            }
          >
            <Sparkles className="h-4 w-4" /> Ask about this account
          </Button>
        </div>
      </div>

      {/* Active leadership campaigns targeting this account */}
      <AccountCampaigns accountId={data.id} />

      {/* Readiness & eligibility — one compact card replacing the 3 stacked banners */}
      <ReadinessEligibility data={data} />

      {data.adoption && (
        <AdoptionWorkflow
          accountId={data.id}
          accountName={data.name}
          workflow={data.adoption}
          ppStatus={data.pp_status ?? "unknown"}
        />
      )}
      <AdoptionHistory accountId={data.id} />

      <UseCaseFlow useCases={data.use_cases} />

      <ObjectionsBlockers
        accountId={data.id}
        plan={data.plan ?? []}
        issues={data.issues ?? []}
      />
    </div>
  );
}

// Active leadership campaigns targeting this account — shown as a banner so the
// account team sees the ask (CTA + deadline) right where they work the account.
interface AccountCampaign {
  id: string;
  title: string;
  ask: string;
  cta: string;
  deadline?: string;
  priority: string;
}

function AccountCampaigns({ accountId }: { accountId: string }) {
  const [campaigns, setCampaigns] = useState<AccountCampaign[]>([]);
  useEffect(() => {
    fetch(`/api/accounts/${accountId}/campaigns`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCampaigns(Array.isArray(d) ? d : []))
      .catch(() => setCampaigns([]));
  }, [accountId]);
  if (campaigns.length === 0) return null;
  return (
    <div className="mb-4 space-y-2">
      {campaigns.map((c) => (
        <div
          key={c.id}
          className={cn(
            "rounded-lg border p-3 flex items-start gap-3",
            c.priority === "high"
              ? "border-destructive/50 bg-destructive/5"
              : "border-primary/40 bg-primary/5"
          )}
        >
          <Megaphone
            className={cn(
              "h-4 w-4 mt-0.5 shrink-0",
              c.priority === "high" ? "text-destructive" : "text-primary"
            )}
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold flex items-center gap-2">
              {c.title}
              {c.priority === "high" && (
                <Badge variant="destructive" className="text-xs">
                  High
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{c.ask}</p>
            {c.cta && (
              <p className="text-sm mt-1">
                <span className="font-medium">Action: </span>
                {c.cta}
              </p>
            )}
            {c.deadline && (
              <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" /> Due {c.deadline}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const SEVERITY_META: Record<
  string,
  { label: string; cls: string }
> = {
  blocked: {
    label: "Blocked",
    cls: "border-destructive/50 text-destructive",
  },
  risk: {
    label: "Risk",
    cls: "border-amber-600/50 text-amber-700 dark:text-amber-400",
  },
  friction: {
    label: "Friction",
    cls: "border-sky-600/50 text-sky-700 dark:text-sky-400",
  },
  nice_to_have: {
    label: "Nice to have",
    cls: "border-muted-foreground/40 text-muted-foreground",
  },
};

const BRICKROAD_URL = "https://go/brickroad";

function AccountIssues({ issues }: { issues: AccountIssueOut[] }) {
  const openCount = issues.filter((i) => i.is_open).length;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">
          {openCount} open of {issues.length} · from Brickroad
        </p>
        <a
          href={BRICKROAD_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" /> Open in Brickroad
        </a>
      </div>
      <div className="grid gap-2">
        {issues.map((iss) => {
          const sev = SEVERITY_META[iss.severity] ?? {
            label: iss.severity || "—",
            cls: "border-muted-foreground/40 text-muted-foreground",
          };
          return (
            <Card key={iss.id} className={iss.is_open ? "" : "opacity-60"}>
              <CardContent className="py-3 flex items-center gap-3">
                <Badge variant="outline" className={`shrink-0 ${sev.cls}`}>
                  {sev.label}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {iss.title || "(untitled issue)"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {iss.display_id && <>{iss.display_id} · </>}
                    {iss.product_area && <>{iss.product_area} · </>}
                    {iss.status}
                    {iss.investigator && <> · {iss.investigator}</>}
                  </div>
                </div>
                {iss.revenue_impact > 0 && (
                  <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                    {fmtDbus(iss.revenue_impact)} at risk
                  </span>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Adoption Workflow — "What happens at every stage".
// Stage columns (U1–U6); tasks colored by lane (border). Edits are held locally
// and persisted to Lakebase in one shot via the Save button.
// ---------------------------------------------------------------------------

const ADOPTION_STATUSES: { value: string; label: string }[] = [
  { value: "not_initiated", label: "Not Initiated" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "blocked", label: "Blocked" },
];

// Task-specific blocker reasons. When a task is Blocked, the team picks the reason
// that actually applies to THAT task (not a generic category). Stored as a
// "[Blocker: <reason>]" prefix in the task note. A generic fallback covers any task
// without a bespoke list.
const GENERIC_BLOCKERS = [
  "Customer prioritization / bandwidth",
  "Waiting on customer stakeholder",
  "Needs internal SME / specialist help",
  "Technical / platform issue",
  "Other (see note)",
];
const TASK_BLOCKERS: Record<string, string[]> = {
  hp_u1_demo: [
    "No suitable domain data/assets for a demo",
    "Can't get the right business audience",
    "Security review blocking the demo environment",
    "Waiting on customer stakeholder",
  ],
  hp_u1_champions: [
    "No engaged business champion identified",
    "Champion lacks influence / bandwidth",
    "Wrong persona engaged (IT-only, no business)",
  ],
  hp_u1_aim: [
    "Incorrect AIM messaging / positioned as Genie-only",
    "IdP not AIM-supported",
    "Middle translation layer / IDP concern",
    "No C-suite sponsorship for identity change",
  ],
  hp_u2_workshop: [
    "Can't schedule the workshop with customer",
    "Right attendees (business SMEs) unavailable",
    "No prod-like data ready for the workshop",
  ],
  hp_u2_usecase: [
    "No clear use case with a path to Prod",
    "Use case value not agreed with business",
    "Competing priorities / not prioritized",
  ],
  hp_u2_csuite: [
    "No C-suite access / sponsor",
    "Exec not convinced of value",
    "Budget / procurement concern",
  ],
  hp_u3_prototype: [
    "Prod-like data not available in lower env",
    "Data not arranged by domain / hard to find",
    "Access / permissions to customer data",
  ],
  hp_u3_evaldata: [
    "No SME-validated Q&A available",
    "SMEs unavailable to validate answers",
    "Eval data quality / coverage insufficient",
  ],
  hp_u3_metricview: [
    "Metric / ontology specs not defined",
    "No agreement on KPI definitions",
    "Metric views not built yet",
  ],
  hp_u4_signoff: [
    "Accuracy not meeting business bar",
    "Needs more tuning in Genie Workbench",
    "Business users not signing off",
  ],
  hp_u4_uco_sizing: [
    "Can't get usage/volume estimates",
    "Pricing / forecasting concern",
    "Waiting on customer stakeholder",
  ],
  hp_u4_import_export: [
    "DAB / sharing setup issue",
    "Governance / permissions on sharing",
    "Technical / platform issue",
  ],
  hp_u5_aim_ready: [
    "AIM not enabled account-wide",
    "Identity federation / SCIM gap",
    "Unified Login not enabled",
  ],
  hp_u5_pricing: [
    "Cost concerns / sticker shock",
    "No clear cost projections",
    "Serving-layer competition (Snowflake/Fabric)",
  ],
  hp_u6_monitor: [
    "No cost/quality monitoring in place",
    "Genie space proliferation / unclear costs",
    "Needs tuning to control cost or quality",
  ],
  hp_u6_followup: [
    "Can't re-engage IT / business stakeholders",
    "Champion left / changed",
    "Waiting on customer stakeholder",
  ],
  rec_u1_objection: [
    "Unprepared for common objections",
    "Security / trust objection",
    "Cost objection",
  ],
  rec_u2_flavors: [
    "Unclear which Genie flavor fits",
    "Needs SME guidance on options",
  ],
  rec_u3_workbench: [
    "Accuracy plateau despite tuning",
    "Missing eval data / KPI metrics",
    "Governance tags not applied",
  ],
  rec_u3_hackathon: [
    "Prerequisites for hackathon not met",
    "Can't schedule / recruit business SMEs",
    "No gold-layer (non-synthetic) data ready",
  ],
  an_u3_scale: [
    "STS / Partner enablement not in place",
    "Scale approach undecided",
  ],
  rec_u5_endpoint: [
    "Consumption API / endpoint setup issue",
    "Governance on programmatic access",
  ],
};
function blockersForTask(taskKey: string): string[] {
  return TASK_BLOCKERS[taskKey] ?? GENERIC_BLOCKERS;
}
const BLOCKER_PREFIX_RE = /^\[Blocker:\s*([^\]]*)\]\s*/;

function parseBlockerNote(note: string): { category: string; rest: string } {
  const m = BLOCKER_PREFIX_RE.exec(note || "");
  return m ? { category: m[1].trim(), rest: note.slice(m[0].length) } : { category: "", rest: note || "" };
}
function withBlockerCategory(note: string, category: string): string {
  const { rest } = parseBlockerNote(note);
  return category ? `[Blocker: ${category}] ${rest}`.trimEnd() : rest;
}

// Lane tone → color: Happy Path = green, Recommended = blue, As Needed = orange.
const LANE_ACCENT: Record<string, string> = {
  green: "border-l-green-500",
  blue: "border-l-blue-500",
  orange: "border-l-orange-500",
};
const LANE_DOT: Record<string, string> = {
  green: "bg-green-500",
  blue: "bg-blue-500",
  orange: "bg-orange-500",
};

// Reference links shown under specific workflow/security questions (by task key).
const TASK_RESOURCES: Record<string, { label: string; url: string }[]> = {
  sec_authority_review: [
    {
      label: "Security Authority Review guide",
      url: "https://docs.google.com/document/d/1t1hZc6gJ6zrVOL9bPuTjAg4C6FLRbZzTPrVsFg3mXas/edit?tab=t.0#heading=h.hq2sxeq7ozii",
    },
    {
      label: "Databricks AI trust & safety",
      url: "https://docs.databricks.com/aws/en/databricks-ai/databricks-ai-trust",
    },
  ],
};

// Collapsed-by-default section with a click-to-expand label + chevron
// (same pattern as the Genie use cases box).
function Collapsible({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground"
      >
        {label}
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="mt-1.5">{children}</div>}
    </div>
  );
}

function StatusRadio({
  value,
  options,
  onPick,
}: {
  value: string;
  options: { value: string; label: string }[];
  onPick: (v: string) => void;
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-1.5 mt-2">
      {options.map((s) => {
        const selected = value === s.value;
        // Blocked selects in destructive red to stand out from the other statuses.
        const isBlocked = s.value === "blocked";
        return (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onPick(s.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors",
              selected
                ? isBlocked
                  ? "border-destructive bg-destructive/10 text-destructive font-medium"
                  : "border-primary bg-primary/10 text-foreground font-medium"
                : "border-border text-muted-foreground hover:bg-accent"
            )}
          >
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full border",
                selected
                  ? isBlocked
                    ? "border-destructive bg-destructive"
                    : "border-primary bg-primary"
                  : "border-muted-foreground"
              )}
            />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

function AdoptionStatusIcon({ status }: { status: string }) {
  // Show an indicator only for answered statuses; Not Initiated stays blank.
  // Completed = green, Blocked = red, In Progress / NA are neutral.
  if (status === "completed")
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />;
  if (status === "blocked")
    return <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />;
  if (status === "in_progress")
    return <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />;
  if (status === "na")
    return <MinusCircle className="h-4 w-4 shrink-0 text-muted-foreground" />;
  return null; // not_initiated → blank
}

function AdoptionTaskCard({
  task,
  tone,
  value,
  onChange,
  accountName,
}: {
  task: AdoptionTaskOut;
  tone: string;
  value: { status: string; note: string };
  onChange: (patch: { status?: string; note?: string }) => void;
  accountName: string;
}) {
  const blocked = value.status === "blocked";
  // All five statuses (incl. Blocked) are available on every task.
  const statusOptions = ADOPTION_STATUSES;
  return (
    <div
      className={cn(
        "rounded-md border border-l-4 bg-card p-2.5",
        blocked ? "border-l-destructive ring-1 ring-destructive/30" : LANE_ACCENT[tone] ?? "border-l-border"
      )}
    >
      <div className="flex items-start gap-1.5">
        <AdoptionStatusIcon status={value.status} />
        <div className="text-xs font-medium leading-snug">{task.label}</div>
      </div>
      <StatusRadio
        value={value.status}
        options={statusOptions}
        onPick={(v) => onChange({ status: v })}
      />
      {/* When blocked, the reason dropdown sits right under the status (task-specific
          reasons), then the note, then the Ask-Genie link. */}
      {blocked && (
        <div className="mt-2">
          <label className="text-xs font-medium uppercase tracking-wide text-destructive">
            What's blocking this?
          </label>
          <select
            value={parseBlockerNote(value.note).category}
            onChange={(e) =>
              onChange({ note: withBlockerCategory(value.note, e.target.value) })
            }
            className="mt-1 w-full h-8 rounded-md border border-destructive/40 bg-destructive/5 px-2 text-xs"
          >
            <option value="">Select a reason…</option>
            {blockersForTask(task.key).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      )}
      <Textarea
        value={blocked ? parseBlockerNote(value.note).rest : value.note}
        onChange={(e) => {
          if (!blocked) {
            onChange({ note: e.target.value });
            return;
          }
          // Preserve the "[Blocker: reason]" prefix; edit only the free text.
          const cat = parseBlockerNote(value.note).category;
          onChange({
            note: cat ? `[Blocker: ${cat}] ${e.target.value}`.trimEnd() : e.target.value,
          });
        }}
        placeholder={blocked ? "Add detail…" : "Add a note…"}
        className="mt-2 min-h-[38px] text-xs"
      />
      {blocked && (
        <button
          type="button"
          onClick={() => {
            const cat = parseBlockerNote(value.note).category;
            openGenieChat(
              `${accountName} is blocked on "${task.label}"` +
                (cat ? ` — ${cat}` : "") +
                `. How do I get unstuck? What play, demo, or resource should I use?`
            );
          }}
          className="mt-2 inline-flex items-center gap-1 text-xs text-destructive hover:underline font-medium"
        >
          <Sparkles className="h-3 w-3 shrink-0" />
          Ask Genie how to get unstuck
        </button>
      )}
      {(TASK_RESOURCES[task.key] ?? []).length > 0 && (
        <div className="mt-2 space-y-1">
          {TASK_RESOURCES[task.key].map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              {r.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// Append-only edit history for the account's Adoption Workflow tasks — who changed
// what, when. Collapsed by default; fetched on expand.
interface HistoryEntry {
  task_key: string;
  task_label: string;
  status: string;
  note: string;
  changed_at: string;
  changed_by: string;
}

const STATUS_LABEL: Record<string, string> = {
  not_initiated: "Not Initiated",
  na: "NA",
  in_progress: "In Progress",
  completed: "Completed",
  blocked: "Blocked",
};

function AdoptionHistory({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);

  async function expand() {
    if (!open && entries === null) {
      try {
        const res = await fetch(`/api/accounts/${accountId}/adoption/history`);
        setEntries(res.ok ? await res.json() : []);
      } catch {
        setEntries([]);
      }
    }
    setOpen((o) => !o);
  }

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={expand}
        className="w-full flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-left hover:border-primary/50 transition-colors"
      >
        <span className="text-base font-semibold">
          Adoption activity{" "}
          {entries !== null && (
            <span className="font-normal text-muted-foreground">
              ({entries.length} change{entries.length === 1 ? "" : "s"})
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <Card className="mt-3">
          <CardContent className="pt-4">
            {entries === null ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No changes recorded yet — edits to the Adoption Workflow will appear
                here.
              </p>
            ) : (
              <ul className="space-y-3">
                {entries.map((e, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2">
                        <span className="font-medium">{e.task_label}</span>
                        <Badge variant="outline" className="text-xs">
                          {STATUS_LABEL[e.status] ?? e.status}
                        </Badge>
                      </div>
                      {e.note && (
                        <p className="text-muted-foreground mt-0.5">“{e.note}”</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(e.changed_at).toLocaleString()}
                        {e.changed_by ? ` · ${e.changed_by}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AdoptionWorkflow({
  accountId,
  accountName,
  workflow,
  ppStatus,
}: {
  accountId: string;
  accountName: string;
  workflow: AdoptionWorkflowOut;
  ppStatus: string;
}) {
  const qc = useQueryClient();

  // Hold all task edits locally; persist to Lakebase only on Save.
  const [edits, setEdits] = useState<Record<string, { status: string; note: string }>>(
    () => {
      const m: Record<string, { status: string; note: string }> = {};
      for (const t of workflow.tasks)
        m[t.key] = { status: t.status ?? "not_initiated", note: t.note ?? "" };
      return m;
    }
  );
  const [dirty, setDirty] = useState(false);

  const save = useSaveAdoptionTasks({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getAccountKey({ account_id: accountId }) });
        qc.invalidateQueries({ queryKey: listAccountsKey() });
        setDirty(false);
        toast.success("Responses saved");
      },
      onError: () => toast.error("Could not save responses"),
    },
  });

  const setField = (key: string, patch: { status?: string; note?: string }) => {
    setEdits((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setDirty(true);
  };

  const onSave = () =>
    save.mutate({
      params: { account_id: accountId },
      data: {
        items: Object.entries(edits).map(([task_key, v]) => ({
          task_key,
          status: v.status,
          note: v.note,
        })),
      },
    });

  // Index tasks by lane+stage so each lane renders as one aligned horizontal band
  // (color row) across the stage columns — matching the workflow slide.
  const byCell = new Map<string, AdoptionTaskOut[]>();
  for (const t of workflow.tasks) {
    const k = `${t.lane}::${t.stage}`;
    const arr = byCell.get(k);
    if (arr) arr.push(t);
    else byCell.set(k, [t]);
  }

  const gridCols = `repeat(${workflow.stages.length}, minmax(230px, 1fr))`;

  // Pre-Reqs eligibility banner shows only when Partner-Powered AI is not enabled;
  // Security & Review (below) shows for ALL accounts.
  const showPrereqs = !isPpEnabled(ppStatus);
  const securityTasks = workflow.tasks.filter((t) => t.lane === "security");

  const blockedCount = Object.values(edits).filter(
    (e) => e.status === "blocked"
  ).length;
  const unsavedCount = Object.entries(edits).filter(([key, e]) => {
    const orig = workflow.tasks.find((t) => t.key === key);
    return (
      (orig?.status ?? "not_initiated") !== e.status ||
      (orig?.note ?? "") !== e.note
    );
  }).length;

  return (
    <Card className="mb-6">
      {/* Sticky header — stays visible while working down the tall matrix so the
          Save button (and unsaved / blocked counts) are always reachable. */}
      <CardHeader className="pb-3 sticky top-16 z-20 bg-card/95 backdrop-blur-sm rounded-t-xl border-b flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">The Adoption Workflow</CardTitle>
          <p className="text-sm text-muted-foreground">
            What happens at every stage — set the status and add notes per task, then
            Save.
          </p>
          {blockedCount > 0 && (
            <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-destructive font-medium">
              <AlertTriangle className="h-3 w-3" />
              {blockedCount} blocked task{blockedCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Button onClick={onSave} disabled={save.isPending || !dirty}>
            {save.isPending
              ? "Saving…"
              : unsavedCount > 0
                ? `Save (${unsavedCount})`
                : "Save"}
          </Button>
          {dirty && !save.isPending && (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Pre-Reqs eligibility banner — only when Partner-Powered AI is not on. */}
        {showPrereqs && (
          <div className="rounded-md bg-[#0B2026] text-white px-4 py-2.5 mb-4 text-sm">
            <span className="font-mono font-semibold tracking-wide mr-2">
              PRE-REQS · READY?
            </span>
            <span className="text-white/80">
              Determine eligibility — do they have the foundational tech blocks to
              proceed?
            </span>
          </div>
        )}

        {/* Security & Review — shown for ALL accounts. */}
        {securityTasks.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Security &amp; Review</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {securityTasks.map((t) => (
                <AdoptionTaskCard
                  key={t.key}
                  task={t}
                  tone=""
                  value={edits[t.key] ?? { status: "not_initiated", note: "" }}
                  onChange={(patch) => setField(t.key, patch)}
                  accountName={accountName}
                />
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <div style={{ minWidth: 900 }}>
            {/* Stage header row — U-codes in red */}
            <div className="grid gap-3 mb-2" style={{ gridTemplateColumns: gridCols }}>
              {workflow.stages.map((s) => (
                <div key={s.key} className="px-1">
                  <div className="text-xs font-bold text-red-600">{s.code}</div>
                  <div className="text-xs font-medium leading-tight">{s.name}</div>
                </div>
              ))}
            </div>

            {/* One row per lane — aligned color bands across the stage columns */}
            {workflow.lanes.map((lane) => (
              <div
                key={lane.key}
                className="grid gap-3 py-3 border-t"
                style={{ gridTemplateColumns: gridCols }}
              >
                {workflow.stages.map((s) => {
                  const cell = byCell.get(`${lane.key}::${s.key}`) ?? [];
                  return (
                    <div key={s.key} className="space-y-2">
                      {cell.length === 0 ? (
                        <div className="min-h-[24px] flex items-center justify-center text-muted-foreground/40 text-sm">
                          —
                        </div>
                      ) : (
                        cell.map((t) => (
                          <AdoptionTaskCard
                            key={t.key}
                            task={t}
                            tone={lane.tone}
                            value={edits[t.key] ?? { status: "not_initiated", note: "" }}
                            onChange={(patch) => setField(t.key, patch)}
                            accountName={accountName}
                          />
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Legend — what each border color means */}
            <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t text-xs">
              <span className="text-muted-foreground">Border color:</span>
              {workflow.lanes.map((l) => (
                <div key={l.key} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-block h-3 w-3 rounded-sm",
                      LANE_DOT[l.tone] ?? "bg-border"
                    )}
                  />
                  <span>{l.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const UC_STAGES: { key: string; code: string }[] = [
  { key: "u1", code: "U1" },
  { key: "u2", code: "U2" },
  { key: "u3", code: "U3" },
  { key: "u4", code: "U4" },
  { key: "u5", code: "U5" },
  { key: "u6", code: "U6" },
];

// Genie use cases arranged as a horizontal U1–U6 stage flow (matches the
// Adoption Workflow layout). Read-only — no create option here.
function UseCaseFlow({ useCases }: { useCases: UseCaseListOut[] }) {
  const [open, setOpen] = useState(false);
  const byStage = new Map<string, UseCaseListOut[]>();
  for (const s of UC_STAGES) byStage.set(s.key, []);
  for (const uc of useCases) {
    const arr = byStage.get(uc.stage);
    if (arr) arr.push(uc);
    else byStage.set(uc.stage, [uc]);
  }
  const gridCols = `repeat(${UC_STAGES.length}, minmax(190px, 1fr))`;

  return (
    <div className="mb-6">
      {/* Clickable box — expands to the U1–U6 use-case flow */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-left hover:border-primary/50 transition-colors"
      >
        <span className="text-base font-semibold">
          Genie use cases{" "}
          <span className="font-normal text-muted-foreground">
            ({useCases.length})
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open &&
        (useCases.length === 0 ? (
          <Card className="mt-3">
            <CardContent className="py-10 text-center text-muted-foreground">
              No Genie use cases synced from GTM for this account yet.
            </CardContent>
          </Card>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <div style={{ minWidth: 900 }}>
              {/* Stage header row (U-codes in red) */}
              <div
                className="grid gap-3 mb-2"
                style={{ gridTemplateColumns: gridCols }}
              >
                {UC_STAGES.map((s) => (
                  <div key={s.key} className="text-xs font-bold text-red-600 px-1">
                    {s.code}
                  </div>
                ))}
              </div>
              {/* One column per stage */}
              <div className="grid gap-3" style={{ gridTemplateColumns: gridCols }}>
                {UC_STAGES.map((s) => {
                  const list = byStage.get(s.key) ?? [];
                  return (
                    <div key={s.key} className="space-y-2">
                      {list.length === 0 ? (
                        <div className="min-h-[24px] flex items-center justify-center text-muted-foreground/40 text-sm">
                          —
                        </div>
                      ) : (
                        list.map((uc) => (
                          <Link key={uc.id} to="/use-cases/$id" params={{ id: uc.id }}>
                            <Card className="hover:border-primary/50 transition-colors">
                              <CardContent className="py-3 px-3">
                                <div className="text-sm font-medium leading-snug">
                                  {uc.title}
                                </div>
                                {(uc.estimated_monthly_dbus ?? 0) > 0 && (
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {fmtDbus(uc.estimated_monthly_dbus ?? 0)}/mo est. DBU
                                  </div>
                                )}
                                {(uc.open_blockers ?? 0) > 0 && (
                                  <Badge variant="destructive" className="gap-1 mt-1.5">
                                    <AlertTriangle className="h-3 w-3" />
                                    {uc.open_blockers}
                                  </Badge>
                                )}
                              </CardContent>
                            </Card>
                          </Link>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}

// Objections & Blockers — kept as its own card (extracted from the removed
// "Account action plan"; the other plan groups are no longer shown).
function ObjectionsBlockers({
  accountId,
  plan,
  issues,
}: {
  accountId: string;
  plan: AccountPlanItemOut[];
  issues: AccountIssueOut[];
}) {
  const qc = useQueryClient();
  const toggle = useToggleAccountPlanItem({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getAccountKey({ account_id: accountId }) });
        qc.invalidateQueries({ queryKey: listAccountsKey() });
      },
      onError: () => toast.error("Could not update"),
    },
  });
  // Keep only "Customer objections captured & handled" (with its note); drop
  // "Open blockers triaged" — it duplicated the Genie issues list, which now
  // renders as-is directly beneath, inside this card.
  const items = plan.filter((p) => p.key === "objections");
  const openIssues = issues.filter((i) => i.is_open).length;
  if (items.length === 0 && issues.length === 0) return null;

  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-left hover:border-primary/50 transition-colors"
      >
        <span className="text-lg font-semibold">
          Objections &amp; Blockers{" "}
          {openIssues > 0 && (
            <span className="font-normal text-muted-foreground">
              ({openIssues} open issue{openIssues === 1 ? "" : "s"})
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <Card className="mt-3">
          <CardContent className="space-y-2 pt-4">
            {items.map((item) => (
              <PlanRow
                key={item.key}
                accountId={accountId}
                item={item}
                onToggle={(done, note) =>
                  toggle.mutate({
                    params: { account_id: accountId },
                    data: { item_key: item.key, done, note },
                  })
                }
              />
            ))}
            {issues.length > 0 && <AccountIssues issues={issues} />}
            <div className="pt-2 border-t flex flex-wrap gap-4 text-sm">
              <a
                href={BRICKROAD_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> File a blocker on Brickroad (PM help)
              </a>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "done")
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "in_progress")
    return <Clock className="h-4 w-4 text-amber-600" />;
  if (status === "na")
    return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

function PlanRow({
  item,
  issues = [],
  onToggle,
}: {
  accountId: string;
  item: AccountPlanItemOut;
  issues?: AccountIssueOut[];
  onToggle: (done: boolean | null, note: string | null) => void;
}) {
  const [note, setNote] = useState(item.note ?? "");
  const editable = !item.auto && item.applicable;
  const isNa = !item.applicable;

  return (
    <div className={`flex items-start gap-3 ${isNa ? "opacity-50" : ""}`}>
      {editable ? (
        <Checkbox
          checked={item.done}
          onCheckedChange={(v) => onToggle(Boolean(v), null)}
          className="mt-0.5"
        />
      ) : (
        <span
          title={item.auto ? "Auto-derived from platform signals" : ""}
          className="mt-0.5 flex h-4 w-4 items-center justify-center"
        >
          <StatusIcon status={item.status ?? "todo"} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={
              item.status === "done" || isNa
                ? "text-sm text-muted-foreground"
                : "text-sm"
            }
          >
            {item.label}
          </span>
          {item.auto && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Sparkles className="h-2.5 w-2.5" />
              auto
            </Badge>
          )}
          {isNa && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              N/A
            </Badge>
          )}
          {item.status === "in_progress" && (
            <Badge
              variant="outline"
              className="text-xs border-amber-600/50 text-amber-700 dark:text-amber-400"
            >
              in progress
            </Badge>
          )}
        </div>
        {item.reason && (
          <p className="text-xs text-muted-foreground mt-0.5">{item.reason}</p>
        )}
        {issues.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {issues.map((iss) => {
              const sev = SEVERITY_META[iss.severity];
              return (
                <li key={iss.id} className="flex items-center gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-xs ${sev?.cls ?? "text-muted-foreground"}`}
                  >
                    {sev?.label ?? iss.severity}
                  </Badge>
                  <span className="truncate">{iss.title || "(untitled issue)"}</span>
                  {iss.revenue_impact > 0 && (
                    <span className="text-muted-foreground shrink-0 hidden sm:inline">
                      {fmtDbus(iss.revenue_impact)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {item.has_note && editable && (
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (note !== (item.note ?? "")) onToggle(null, note);
            }}
            placeholder="Add notes…"
            className="mt-1.5 h-8 text-sm"
          />
        )}
      </div>
    </div>
  );
}

function WsCounts({
  on,
  off,
  total,
}: {
  on: number;
  off: number;
  total: number;
}) {
  if (total <= 0) return null;
  return (
    <p className="text-xs text-muted-foreground mt-1">
      Partner-Powered active workspaces: {on.toLocaleString()} on ·{" "}
      {off.toLocaleString()} off (of {total.toLocaleString()})
    </p>
  );
}

// One compact "Readiness & eligibility" card that replaces the three full-width
// stacked banners (PP / Enforce / AIM). Shows the readiness bar with an expandable
// plan breakdown, plus a status strip for the eligibility signals — each row expands
// to the full banner detail (next steps, docs links) on demand.
function ReadinessEligibility({ data }: { data: AccountDetailOut }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openStages, setOpenStages] = useState<Set<string>>(new Set());
  const toggleStage = (k: string) =>
    setOpenStages((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const pp = data.pp_status ?? "unknown";
  // Effective consumption: account default OR workspace-level (enforce off + some on).
  const ppEnabled = isPpEffectivelyEnabled(pp, data.pp_enforce ?? "unknown", data.ws_pp_on ?? 0);
  // Account default off, but enabled on select workspaces (enforce off + some on).
  const ppConsumeViaWs = !isPpEnabled(pp) && ppEnabled;
  const aim = data.aim_status ?? "unknown";
  // User-provisioning readiness = AIM OR SCIM (provisioning_status is the broader
  // "any provisioning" signal); aim tells us whether the preferred method is used.
  const prov = data.provisioning_status ?? "unknown";
  // Readiness reflects the team-filled Adoption Workflow (matrix tasks, excluding the
  // Security & Review questions) — not GTM auto-signals. Done = marked "completed".
  const workflowTasks = (data.adoption?.tasks ?? []).filter((t) => t.lane !== "security");
  const applicable = workflowTasks;
  const done = workflowTasks.filter((t) => t.status === "completed");
  const readinessPct =
    workflowTasks.length > 0
      ? Math.round((done.length / workflowTasks.length) * 100)
      : 0;
  // Consolidate the breakdown by stage (U1–U6): one row per stage with done/total +
  // the tasks still open, instead of a flat 28-item list.
  const stageGroups = (data.adoption?.stages ?? []).map((s) => {
    const tasks = workflowTasks.filter((t) => t.stage === s.key);
    return {
      key: s.key,
      code: s.code,
      name: s.name,
      total: tasks.length,
      done: tasks.filter((t) => t.status === "completed").length,
      notDone: tasks.filter((t) => t.status !== "completed"),
    };
  }).filter((g) => g.total > 0);

  const toggle = (k: string) => setExpanded((e) => (e === k ? null : k));

  // Fully on = good; on only for select workspaces = warn (nudge to enable account-wide).
  const ppTone: RowTone = ppConsumeViaWs
    ? "warn"
    : ppEnabled
      ? "good"
      : pp === "off"
        ? "bad"
        : "warn";
  const provTone: RowTone =
    prov === "on" ? "good" : prov === "off" ? "bad" : "warn";

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Readiness &amp; eligibility</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Readiness — the headline of this card; made prominent so it isn't skipped. */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-end justify-between gap-3 mb-2">
            <button
              type="button"
              onClick={() => setShowBreakdown((s) => !s)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-primary"
            >
              Account readiness
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  showBreakdown && "rotate-180"
                )}
              />
            </button>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{readinessPct}%</span>
              <span className="text-sm text-muted-foreground">
                {done.length}/{applicable.length} tasks
              </span>
            </div>
          </div>
          <Progress value={readinessPct} className="h-2.5" />
          {showBreakdown && (
            <>
              <p className="text-xs text-muted-foreground mt-1.5">
                By stage — from the Adoption Workflow the team fills below.{" "}
                <span className="font-medium">{done.length}/{applicable.length}</span>{" "}
                tasks done.
              </p>
              <div className="mt-2 space-y-2 text-xs">
                {stageGroups.map((g) => {
                  const complete = g.done === g.total;
                  const isOpen = openStages.has(g.key);
                  return (
                    <div key={g.key}>
                      <button
                        type="button"
                        onClick={() => g.notDone.length > 0 && toggleStage(g.key)}
                        className={cn(
                          "w-full flex items-center gap-2 text-left",
                          g.notDone.length > 0 && "hover:text-foreground"
                        )}
                      >
                        {g.notDone.length > 0 ? (
                          <ChevronDown
                            className={cn(
                              "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                              isOpen && "rotate-180"
                            )}
                          />
                        ) : (
                          <span className="w-3 shrink-0" />
                        )}
                        <span className="font-bold text-red-600 w-7 shrink-0">
                          {g.code}
                        </span>
                        <span className="flex-1 truncate">{g.name}</span>
                        <span
                          className={cn(
                            "font-medium shrink-0",
                            complete
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {g.done}/{g.total}
                        </span>
                        {complete && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        )}
                      </button>
                      {isOpen && g.notDone.length > 0 && (
                        <ul className="ml-12 mt-0.5 space-y-0.5 text-muted-foreground">
                          {g.notDone.map((t) => (
                            <li key={t.key} className="flex items-center gap-1.5" title={t.label}>
                              <Circle className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{t.label}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Eligibility status strip — click a row to see its detail */}
        <div className="divide-y border-t">
          <EligibilityRow
            tone={ppTone}
            label="Partner-Powered AI"
            value={
              ppConsumeViaWs
                ? "On (select workspaces)"
                : isPpEnabled(pp)
                  ? pp === "on_default"
                    ? "On (default)"
                    : "On"
                  : pp === "off"
                    ? "Off"
                    : "Unknown"
            }
            open={expanded === "pp"}
            onToggle={() => toggle("pp")}
          >
            <PartnerPoweredBanner
              status={pp}
              enforce={data.pp_enforce ?? "unknown"}
              wsOn={data.ws_pp_on ?? 0}
              wsOff={data.ws_pp_off ?? 0}
              wsTotal={data.ws_total ?? 0}
              bare
            />
          </EligibilityRow>

          <EligibilityRow
            tone={provTone}
            label="User provisioning (AIM or SCIM)"
            value={
              prov === "on"
                ? aim === "on" || aim === "partial"
                  ? "On (AIM)"
                  : "On (SCIM)"
                : prov === "partial"
                  ? "Partial"
                  : prov === "off"
                    ? "Off"
                    : "Unknown"
            }
            open={expanded === "prov"}
            onToggle={() => toggle("prov")}
          >
            <ProvisioningBanner
              status={prov}
              aimStatus={aim}
              enabled={data.provisioning_ws_enabled ?? 0}
              total={data.provisioning_ws_total ?? 0}
              bare
            />
          </EligibilityRow>
        </div>
      </CardContent>
    </Card>
  );
}

type RowTone = "good" | "bad" | "warn" | "muted";

const ROW_DOT: Record<RowTone, string> = {
  good: "bg-emerald-500",
  bad: "bg-destructive",
  warn: "bg-amber-500",
  muted: "bg-muted-foreground/50",
};

function EligibilityRow({
  tone,
  label,
  value,
  open,
  onToggle,
  children,
}: {
  tone: RowTone;
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 py-2.5 text-left"
      >
        <span className={cn("h-2 w-2 rounded-full shrink-0", ROW_DOT[tone])} />
        <span className="text-sm flex-1">{label}</span>
        <span className="text-sm font-medium">{value}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

function PartnerPoweredBanner({
  status,
  enforce,
  wsOn,
  wsOff,
  wsTotal,
  bare = false,
}: {
  status: string;
  enforce: string;
  wsOn: number;
  wsOff: number;
  wsTotal: number;
  bare?: boolean;
}) {
  const implication = enforceImplication(enforce, status);
  // Account default off, but enforce not on and some workspaces on → those workspaces
  // can still consume Genie, so treat as enabled (no "blocked" warning).
  const consumeViaWs = !isPpEnabled(status) && isPpEffectivelyEnabled(status, enforce, wsOn);

  if (isPpEnabled(status) || consumeViaWs) {
    // Fully on → green. On only for select workspaces → amber (nudge to account-wide).
    const wrapCls = bare
      ? "px-0"
      : consumeViaWs
        ? "rounded-lg border border-amber-600/40 bg-amber-600/5 p-4 mb-4"
        : "rounded-lg border border-emerald-600/40 bg-emerald-600/5 p-4 mb-4";
    const titleCls = consumeViaWs
      ? "flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium"
      : "flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium";
    return (
      <div className={wrapCls}>
        <div className={titleCls}>
          {consumeViaWs ? (
            <ShieldAlert className="h-4 w-4" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          {consumeViaWs
            ? "Partner-Powered AI: account default Off, On for select workspaces — Genie can consume there, but not account-wide."
            : status === "on_default"
              ? "Partner-Powered AI is On (platform default) — Genie can consume."
              : "Partner-Powered AI is On — Genie can consume."}
        </div>
        {consumeViaWs && (
          <p className="text-sm text-muted-foreground mt-1">
            Enforce is not set, so workspaces with it enabled can still use Genie.
            Enable it at the account level (with enforce) to cover all workspaces.
          </p>
        )}
        {implication && !consumeViaWs && (
          <p className="text-sm text-muted-foreground mt-1">{implication}</p>
        )}
        <WsCounts on={wsOn} off={wsOff} total={wsTotal} />
        {consumeViaWs && (
          <>
            <Collapsible label="Next steps to enable account-wide">
              <ul className="space-y-1.5">
                {PP_OFF_NEXT_STEPS.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                    {step}
                  </li>
                ))}
              </ul>
            </Collapsible>
            <div className="flex flex-wrap gap-4 mt-3 text-sm">
              <a
                href={PP_DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                How to enable Partner-Powered AI (docs)
              </a>
            </div>
          </>
        )}
      </div>
    );
  }

  // Off or unknown → surface the Security Review next steps.
  const isOff = status === "off";
  return (
    <div
      className={
        bare
          ? "px-0"
          : [
              "rounded-lg border p-4 mb-4",
              isOff
                ? "border-destructive/50 bg-destructive/5"
                : "border-amber-600/40 bg-amber-600/5",
            ].join(" ")
      }
    >
      <div
        className={[
          "flex items-center gap-2 font-medium",
          isOff
            ? "text-destructive"
            : "text-amber-700 dark:text-amber-400",
        ].join(" ")}
      >
        <ShieldAlert className="h-4 w-4" />
        {isOff
          ? "Partner-Powered AI is Off — Genie cannot consume for this account."
          : "Partner-Powered AI status unknown — confirm it's enabled before Genie can consume."}
      </div>
      {implication && (
        <p className="text-sm text-muted-foreground mt-1">{implication}</p>
      )}
      <WsCounts on={wsOn} off={wsOff} total={wsTotal} />

      <Collapsible label="Next steps">
        <ul className="space-y-1.5">
          {PP_OFF_NEXT_STEPS.map((step, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              {step}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-4 mt-3 text-sm">
          <a
            href={PP_SECURITY_REVIEW_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            AI Security Review play
          </a>
          <a
            href={PP_DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            How to enable Partner-Powered AI (docs)
          </a>
        </div>
      </Collapsible>
    </div>
  );
}

// User provisioning readiness = AIM OR SCIM. `status` is the broader provisioning
// signal; `aimStatus` tells us whether the preferred method (AIM) is in use so we can
// name the path and still nudge SCIM→AIM where it helps.
function ProvisioningBanner({
  status,
  aimStatus,
  enabled,
  total,
  bare = false,
}: {
  status: string;
  aimStatus: string;
  enabled: number;
  total: number;
  bare?: boolean;
}) {
  // `total` is the Genie-ready report's own total_workspaces (the same denominator
  // provisioning_status was derived from), so the fraction is self-consistent —
  // Partial reads <100%, On reads full. Math.min is a defensive guard only.
  const shownEnabled = Math.min(enabled, total);
  const count =
    total > 0 ? (
      <span className="text-muted-foreground">
        {" "}
        ({shownEnabled.toLocaleString()}/{total.toLocaleString()} workspaces)
      </span>
    ) : null;
  const viaAim = aimStatus === "on" || aimStatus === "partial";
  const method = viaAim ? "AIM" : "SCIM";

  const genieReadyLinks = (
    <div className="flex flex-wrap gap-4 mt-3 text-sm">
      <a
        href={GENIE_READY_DOC_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        go/genieready
      </a>
      <a
        href={GENIE_READY_DASHBOARD_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Genie Ready dashboard
      </a>
      <a
        href={AIM_DOCS_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        AIM docs
      </a>
    </div>
  );

  if (status === "on") {
    return (
      <div className={bare ? "text-sm" : "rounded-lg border border-emerald-600/40 bg-emerald-600/5 p-3 mb-6 text-sm"}>
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
          <ShieldCheck className="h-4 w-4" />
          User provisioning: On (via {method}){count}
        </div>
        {!viaAim && (
          <p className="text-muted-foreground mt-1">
            Provisioned via SCIM — meets the Genie-ready criterion. AIM is preferred
            where available (handles account identity and workspace access in one flow).
          </p>
        )}
        {genieReadyLinks}
      </div>
    );
  }
  if (status === "partial") {
    return (
      <div className={bare ? "text-sm" : "rounded-lg border border-amber-600/40 bg-amber-600/5 p-3 mb-6 text-sm"}>
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
          <ShieldAlert className="h-4 w-4" />
          User provisioning: Partial{count}
        </div>
        <p className="text-muted-foreground mt-1">
          Some workspaces have provisioning ({method}); extend it everywhere so
          identities are ready for Genie sharing.
        </p>
        {genieReadyLinks}
      </div>
    );
  }
  // off (red) / unknown (amber)
  const isOff = status === "off";
  return (
    <div
      className={
        bare
          ? ""
          : [
              "rounded-lg border p-4 mb-6",
              isOff ? "border-destructive/50 bg-destructive/5" : "border-amber-600/40 bg-amber-600/5",
            ].join(" ")
      }
    >
      <div
        className={[
          "flex items-center gap-2 font-medium",
          isOff ? "text-destructive" : "text-amber-700 dark:text-amber-400",
        ].join(" ")}
      >
        <ShieldAlert className="h-4 w-4" />
        {isOff
          ? "No user provisioning (AIM or SCIM)"
          : "User provisioning: Unknown"}
        {count}
      </div>
      <Collapsible label="Next steps">
        <ul className="space-y-1.5">
          {AIM_OFF_NEXT_STEPS.map((step, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              {step}
            </li>
          ))}
        </ul>
      </Collapsible>
      {genieReadyLinks}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
