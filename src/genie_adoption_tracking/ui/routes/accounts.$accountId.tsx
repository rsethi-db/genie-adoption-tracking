import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import {
  useGetAccountSuspense,
  useToggleAccountPlanItem,
  getAccountKey,
  listAccountsKey,
  type AccountPlanItemOut,
  type AccountIssueOut,
} from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Clock,
  Circle,
  MinusCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  PP_DOCS_URL,
  PP_SECURITY_REVIEW_URL,
  PP_OFF_NEXT_STEPS,
  AIM_DOCS_URL,
  AIM_OFF_NEXT_STEPS,
  enforceImplication,
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

      <AimBanner
        status={data.aim_status ?? "unknown"}
        enabled={data.aim_ws_enabled ?? 0}
        total={data.ws_total ?? 0}
      />

      <AccountPlan
        accountId={data.id}
        plan={data.plan ?? []}
        issues={data.issues ?? []}
      />

      <h2 className="text-lg font-semibold mb-3">Genie use cases</h2>
      {data.use_cases.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No Genie use cases synced from GTM for this account yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {data.use_cases.map((uc) => (
            <Link key={uc.id} to="/use-cases/$id" params={{ id: uc.id }}>
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="py-4 flex items-center gap-4">
                  <Badge variant="secondary" className="font-mono text-xs w-12 justify-center">
                    {uc.stage.toUpperCase()}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{uc.title}</div>
                    {(uc.estimated_monthly_dbus ?? 0) > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {fmtDbus(uc.estimated_monthly_dbus ?? 0)}/mo est. DBU
                      </div>
                    )}
                  </div>
                  {(uc.open_blockers ?? 0) > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {uc.open_blockers}
                    </Badge>
                  )}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

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

function AccountPlan({
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
      onError: () => toast.error("Could not update the plan"),
    },
  });

  // Group items in declared group order.
  const groups: { key: string; name: string; items: AccountPlanItemOut[] }[] = [];
  for (const item of plan) {
    let g = groups.find((x) => x.key === item.group);
    if (!g) {
      g = { key: item.group, name: item.group_name, items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Account action plan</CardTitle>
        <p className="text-sm text-muted-foreground">
          Tailored to this account from its signals — Partner-Powered AI, identity,
          UCO stages, consumption and open issues. Auto items resolve themselves;
          steps that don't apply are marked N/A; the rest are yours to work.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              {g.name}
            </div>
            <div className="space-y-2">
              {g.items.map((item) => (
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
            </div>
          </div>
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
