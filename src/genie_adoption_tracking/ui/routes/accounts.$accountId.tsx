import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import {
  useGetAccountSuspense,
  useToggleAccountPlanItem,
  useSaveAdoptionTasks,
  getAccountKey,
  listAccountsKey,
  type AccountPlanItemOut,
  type AccountIssueOut,
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
  Lock,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import {
  PP_DOCS_URL,
  PP_SECURITY_REVIEW_URL,
  PP_OFF_NEXT_STEPS,
  AIM_DOCS_URL,
  AIM_OFF_NEXT_STEPS,
  enforceImplication,
  enforceLabel,
  enforceTone,
  isPpEnabled,
} from "@/lib/partner-powered";

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
      <div className="mb-6">
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
        <div className="mt-4 max-w-md">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Account readiness</span>
            <span className="font-medium">{data.readiness_pct ?? 0}%</span>
          </div>
          <Progress value={data.readiness_pct ?? 0} />
        </div>
      </div>

      <PartnerPoweredBanner
        status={data.pp_status ?? "unknown"}
        enforce={data.pp_enforce ?? "unknown"}
        wsOn={data.ws_pp_on ?? 0}
        wsOff={data.ws_pp_off ?? 0}
        wsTotal={data.ws_total ?? 0}
      />

      <EnforceStatus
        status={data.pp_status ?? "unknown"}
        enforce={data.pp_enforce ?? "unknown"}
      />

      <AimBanner
        status={data.aim_status ?? "unknown"}
        enabled={data.aim_ws_enabled ?? 0}
        total={data.ws_total ?? 0}
      />

      {data.adoption && (
        <AdoptionWorkflow
          accountId={data.id}
          workflow={data.adoption}
          ppStatus={data.pp_status ?? "unknown"}
        />
      )}

      <UseCaseFlow useCases={data.use_cases} />

      <ObjectionsBlockers
        accountId={data.id}
        plan={data.plan ?? []}
        issues={data.issues ?? []}
      />

      {(data.issues ?? []).length > 0 && (
        <AccountIssues issues={data.issues ?? []} />
      )}
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

function AccountIssues({ issues }: { issues: AccountIssueOut[] }) {
  const openCount = issues.filter((i) => i.is_open).length;
  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-3">
        Genie issues{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({openCount} open of {issues.length})
        </span>
      </h2>
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
  { value: "na", label: "NA" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

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

function StatusRadio({
  value,
  onPick,
}: {
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-1.5 mt-2">
      {ADOPTION_STATUSES.map((s) => {
        const selected = value === s.value;
        return (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onPick(s.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors",
              selected
                ? "border-primary bg-primary/10 text-foreground font-medium"
                : "border-border text-muted-foreground hover:bg-accent"
            )}
          >
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full border",
                selected ? "border-primary bg-primary" : "border-muted-foreground"
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
  // Only Completed is colored (green); In Progress / NA are neutral.
  if (status === "completed")
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />;
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
}: {
  task: AdoptionTaskOut;
  tone: string;
  value: { status: string; note: string };
  onChange: (patch: { status?: string; note?: string }) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-l-4 bg-card p-2.5",
        LANE_ACCENT[tone] ?? "border-l-border"
      )}
    >
      <div className="flex items-start gap-1.5">
        <AdoptionStatusIcon status={value.status} />
        <div className="text-xs font-medium leading-snug">{task.label}</div>
      </div>
      <StatusRadio value={value.status} onPick={(v) => onChange({ status: v })} />
      <Textarea
        value={value.note}
        onChange={(e) => onChange({ note: e.target.value })}
        placeholder="Add a note…"
        className="mt-2 min-h-[38px] text-xs"
      />
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

function AdoptionWorkflow({
  accountId,
  workflow,
  ppStatus,
}: {
  accountId: string;
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

  // Prerequisites (Pre-Reqs banner + Security & Review questions) only show when
  // Partner-Powered AI is NOT enabled; hidden entirely for PP-on accounts.
  const showPrereqs = !isPpEnabled(ppStatus);
  const securityTasks = workflow.tasks.filter((t) => t.lane === "security");

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">The Adoption Workflow</CardTitle>
          <p className="text-sm text-muted-foreground">
            What happens at every stage — set the status and add notes per task, then
            Save.
          </p>
        </div>
        <Button
          onClick={onSave}
          disabled={save.isPending || !dirty}
          className="shrink-0"
        >
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </CardHeader>
      <CardContent>
        {/* Prerequisites — only for accounts where Partner-Powered AI is not on. */}
        {showPrereqs && (
          <div className="mb-4">
            <div className="rounded-md bg-[#0B2026] text-white px-4 py-2.5 text-sm">
              <span className="font-mono font-semibold tracking-wide mr-2">
                PRE-REQS · READY?
              </span>
              <span className="text-white/80">
                Determine eligibility — do they have the foundational tech blocks to
                proceed?
              </span>
            </div>
            {securityTasks.length > 0 && (
              <div className="mt-3">
                <h3 className="text-sm font-semibold mb-2">Security &amp; Review</h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {securityTasks.map((t) => (
                    <AdoptionTaskCard
                      key={t.key}
                      task={t}
                      tone=""
                      value={edits[t.key] ?? { status: "not_initiated", note: "" }}
                      onChange={(patch) => setField(t.key, patch)}
                    />
                  ))}
                </div>
              </div>
            )}
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
  const openIssues = issues.filter((i) => i.is_open);
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
  const items = plan.filter((p) => p.group === "objections");
  if (items.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Objections &amp; Blockers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <PlanRow
            key={item.key}
            accountId={accountId}
            item={item}
            issues={item.key === "other_blockers" ? openIssues : []}
            onToggle={(done, note) =>
              toggle.mutate({
                params: { account_id: accountId },
                data: { item_key: item.key, done, note },
              })
            }
          />
        ))}
      </CardContent>
    </Card>
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
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Sparkles className="h-2.5 w-2.5" />
              auto
            </Badge>
          )}
          {isNa && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              N/A
            </Badge>
          )}
          {item.status === "in_progress" && (
            <Badge
              variant="outline"
              className="text-[10px] border-amber-600/50 text-amber-700 dark:text-amber-400"
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
                    className={`shrink-0 text-[10px] ${sev?.cls ?? "text-muted-foreground"}`}
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
      Active workspaces: {on.toLocaleString()} on · {off.toLocaleString()} off
      (of {total.toLocaleString()})
    </p>
  );
}

function PartnerPoweredBanner({
  status,
  enforce,
  wsOn,
  wsOff,
  wsTotal,
}: {
  status: string;
  enforce: string;
  wsOn: number;
  wsOff: number;
  wsTotal: number;
}) {
  const implication = enforceImplication(enforce, status);

  if (isPpEnabled(status)) {
    return (
      <div className="rounded-lg border border-emerald-600/40 bg-emerald-600/5 p-4 mb-4">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
          <ShieldCheck className="h-4 w-4" />
          {status === "on_default"
            ? "Partner-Powered AI is On (platform default) — Genie can consume."
            : "Partner-Powered AI is On — Genie can consume."}
        </div>
        {implication && (
          <p className="text-sm text-muted-foreground mt-1">{implication}</p>
        )}
        <WsCounts on={wsOn} off={wsOff} total={wsTotal} />
      </div>
    );
  }

  // Off or unknown → surface the Security Review next steps.
  const isOff = status === "off";
  return (
    <div
      className={[
        "rounded-lg border p-4 mb-4",
        isOff
          ? "border-destructive/50 bg-destructive/5"
          : "border-amber-600/40 bg-amber-600/5",
      ].join(" ")}
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

      <div className="mt-3">
        <div className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
          Next steps
        </div>
        <ul className="space-y-1.5">
          {PP_OFF_NEXT_STEPS.map((step, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              {step}
            </li>
          ))}
        </ul>
      </div>

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
    </div>
  );
}

// Enforce status — shown only when Partner-Powered AI is off, directly below the
// PP banner (mirrors the enforce badge from the old accounts list).
function EnforceStatus({
  status,
  enforce,
}: {
  status: string;
  enforce: string;
}) {
  if (status !== "off") return null;
  // Shown for every PP-off account, including enforce = unknown.
  const tone = enforceTone(enforce); // bad (on) | warn (off) | muted (unknown)
  const cls =
    tone === "bad"
      ? "border-destructive/50 bg-destructive/5"
      : tone === "warn"
        ? "border-amber-600/40 bg-amber-600/5"
        : "border-border bg-muted/30";
  const iconCls =
    tone === "bad"
      ? "text-destructive"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-400"
        : "text-muted-foreground";
  const msg =
    enforceImplication(enforce, status) ??
    "Enforce setting is unknown for this account — confirm the account-level Partner-Powered AI enforce setting.";
  return (
    <div
      className={cn(
        "rounded-lg border p-3 mb-4 flex items-start gap-2 text-sm",
        cls
      )}
    >
      {enforce === "on" ? (
        <Lock className={cn("h-4 w-4 shrink-0 mt-0.5", iconCls)} />
      ) : (
        <Unlock className={cn("h-4 w-4 shrink-0 mt-0.5", iconCls)} />
      )}
      <div>
        <span className="font-medium">{enforceLabel(enforce)}</span>{" "}
        <span className="text-muted-foreground">{msg}</span>
      </div>
    </div>
  );
}

function AimBanner({
  status,
  enabled,
  total,
}: {
  status: string;
  enabled: number;
  total: number;
}) {
  const count =
    total > 0 ? (
      <span className="text-muted-foreground">
        {" "}
        ({enabled.toLocaleString()}/{total.toLocaleString()} workspaces)
      </span>
    ) : null;

  if (status === "on") {
    return (
      <div className="rounded-lg border border-emerald-600/40 bg-emerald-600/5 p-3 mb-6 text-sm flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
        <ShieldCheck className="h-4 w-4" />
        <span className="font-medium">Automatic Identity Management: On</span>
        {count}
      </div>
    );
  }
  if (status === "partial") {
    return (
      <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 p-3 mb-6 text-sm">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
          <ShieldAlert className="h-4 w-4" />
          Automatic Identity Management: Partial{count}
        </div>
        <p className="text-muted-foreground mt-1">
          Some workspaces have AIM; enable it everywhere so identities are ready for
          Genie sharing.{" "}
          <a
            href={AIM_DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" /> docs
          </a>
        </p>
      </div>
    );
  }
  // off (red) / unknown (amber)
  const isOff = status === "off";
  return (
    <div
      className={[
        "rounded-lg border p-4 mb-6",
        isOff
          ? "border-destructive/50 bg-destructive/5"
          : "border-amber-600/40 bg-amber-600/5",
      ].join(" ")}
    >
      <div
        className={[
          "flex items-center gap-2 font-medium",
          isOff ? "text-destructive" : "text-amber-700 dark:text-amber-400",
        ].join(" ")}
      >
        <ShieldAlert className="h-4 w-4" />
        {isOff
          ? "Automatic Identity Management is Off"
          : "Automatic Identity Management: Unknown"}
        {count}
      </div>
      <div className="mt-3">
        <div className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
          Next steps
        </div>
        <ul className="space-y-1.5">
          {AIM_OFF_NEXT_STEPS.map((step, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              {step}
            </li>
          ))}
        </ul>
      </div>
      <a
        href={AIM_DOCS_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:underline text-sm mt-3"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Enable Automatic Identity Management (docs)
      </a>
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
