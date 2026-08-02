import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { useGetDashboardSuspense, type DashboardOut } from "@/lib/api";
import { selector } from "@/lib/selector";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Layers,
  DollarSign,
  ShieldAlert,
  Gauge,
  Bug,
  Sparkles,
} from "lucide-react";

function fmtDbus(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export const Route = createFileRoute("/dashboard")({
  component: () => <DashboardPage />,
});

function DashboardPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Signals</h1>
        <p className="text-sm text-muted-foreground">
          FINS Genie adoption at a glance — start big, then click any number to drill
          into the accounts behind it.
        </p>
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardBody />
      </Suspense>
    </AppShell>
  );
}

function DashboardBody() {
  const { data } = useGetDashboardSuspense(selector());

  return (
    <div className="space-y-6">
      {/* Tier 1 — headline row (start big) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatTile icon={<Users className="h-4 w-4" />} label="FINS accounts" value={data.total_accounts} />
        <StatTile
          icon={<Sparkles className="h-4 w-4" />}
          label="Genie-active"
          value={data.genie_active_accounts ?? 0}
          tone="good"
        />
        <StatTile
          icon={<DollarSign className="h-4 w-4" />}
          label="Genie spend (90d)"
          display={fmtDbus(data.genie_spend_90d ?? 0)}
          tone="good"
        />
        <StatTile icon={<Layers className="h-4 w-4" />} label="Genie use cases" value={data.total_use_cases} />
        <StatTile
          icon={<Gauge className="h-4 w-4" />}
          label="Avg readiness"
          display={`${data.avg_readiness_pct ?? 0}%`}
        />
        <StatTile
          icon={<DollarSign className="h-4 w-4" />}
          label="Est. pipeline $/mo"
          display={fmtDbus(data.total_monthly_dbus ?? 0)}
        />
      </div>

      {/* Tier 2 — Genie-Ready tiers (GTM) */}
      <div>
        <h2 className="text-sm font-semibold mb-2 text-muted-foreground">
          Genie-Ready tiers <span className="font-normal">(GTM signal — click to drill in)</span>
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile icon={<span>🟢</span>} label="Green" value={data.tier_green ?? 0} tone="good" to="/accounts?tier=green" />
          <StatTile icon={<span>🟡</span>} label="Yellow" value={data.tier_yellow ?? 0} tone="warn" to="/accounts?tier=yellow" />
          <StatTile icon={<span>🔴</span>} label="Red" value={data.tier_red ?? 0} tone="bad" to="/accounts?tier=red" />
          <StatTile icon={<span>⚪</span>} label="Unknown" value={data.tier_unknown ?? 0} to="/accounts?tier=unknown" />
        </div>
      </div>

      {/* Tier 2 — risk & gaps (each drills into a filtered account list) */}
      <div>
        <h2 className="text-sm font-semibold mb-2 text-muted-foreground">
          Gaps & risk <span className="font-normal">(click to see the accounts)</span>
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            icon={<ShieldAlert className="h-4 w-4" />}
            label="Partner-Powered AI off"
            value={data.pp_off_accounts ?? 0}
            tone={(data.pp_off_accounts ?? 0) > 0 ? "bad" : undefined}
            to="/accounts?pp=off"
          />
          <StatTile
            icon={<ShieldAlert className="h-4 w-4" />}
            label="No provisioning (AIM/SCIM)"
            value={data.aim_off_accounts ?? 0}
            tone={(data.aim_off_accounts ?? 0) > 0 ? "bad" : undefined}
            to="/accounts?provisioning=off"
          />
          <StatTile
            icon={<Bug className="h-4 w-4" />}
            label="Accounts w/ open issues"
            value={data.accounts_with_issues ?? 0}
            tone={(data.accounts_with_issues ?? 0) > 0 ? "warn" : undefined}
            to="/accounts?open_issues=true"
          />
          <StatTile
            icon={<Layers className="h-4 w-4" />}
            label="Whitespace"
            value={(data.total_accounts ?? 0) - (data.genie_active_accounts ?? 0)}
            to="/accounts?whitespace=true"
          />
        </div>
      </div>

      {/* Tier 3 — deeper cuts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Funnel data={data} />
        <BlockersByCategory data={data} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Stalled data={data} />
        <TopResources data={data} />
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  display,
  tone,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  display?: string;
  tone?: "good" | "warn" | "bad";
  to?: string; // when set, the tile links to a filtered Accounts view
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-400"
        : tone === "bad"
          ? "text-destructive"
          : "";
  const inner = (
    <CardContent className="py-4">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        {icon} {label}
      </div>
      <div className={`text-3xl font-bold mt-1 ${toneClass}`}>
        {display ?? value}
      </div>
    </CardContent>
  );
  if (to) {
    return (
      <Link to={to}>
        <Card className="hover:border-primary/50 transition-colors h-full">
          {inner}
        </Card>
      </Link>
    );
  }
  return <Card>{inner}</Card>;
}

function Funnel({ data }: { data: DashboardOut }) {
  const max = Math.max(1, ...data.funnel.map((f) => f.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Adoption funnel (current stage)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.funnel.map((f) => (
          <div key={f.stage} className="flex items-center gap-3">
            <div className="w-10 shrink-0">
              <Badge variant="secondary" className="font-mono text-xs">
                {f.code}
              </Badge>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm mb-0.5">
                <span className="text-muted-foreground truncate">{f.name}</span>
                <span className="font-medium">
                  {f.count}
                  {(f.monthly_dbus ?? 0) > 0 && (
                    <span className="text-muted-foreground font-normal ml-2">
                      {fmtDbus(f.monthly_dbus ?? 0)}/mo
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(f.count / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BlockersByCategory({ data }: { data: DashboardOut }) {
  const max = Math.max(
    1,
    ...data.blockers_by_category.map((b) => b.open_count + b.resolved_count),
  );
  const anyBlockers = data.blockers_by_category.some(
    (b) => b.open_count + b.resolved_count > 0,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Blockers by category</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!anyBlockers && (
          <p className="text-sm text-muted-foreground">No blockers flagged yet.</p>
        )}
        {anyBlockers &&
          data.blockers_by_category.map((b) => (
            <div key={b.category_key}>
              <div className="flex items-center justify-between text-sm mb-0.5">
                <span className="truncate">{b.category_name}</span>
                <span className="text-muted-foreground">
                  {b.open_count} open · {b.resolved_count} resolved
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                <div
                  className="h-full bg-destructive"
                  style={{ width: `${(b.open_count / max) * 100}%` }}
                />
                <div
                  className="h-full bg-emerald-600"
                  style={{ width: `${(b.resolved_count / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

function Stalled({ data }: { data: DashboardOut }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Stalled use cases (14+ days)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.stalled.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing stalled — everything moved recently.
          </p>
        )}
        {data.stalled.map((s) => (
          <Link
            key={s.id}
            to="/use-cases/$id"
            params={{ id: s.id }}
            className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent transition-colors"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{s.title}</div>
              <div className="text-xs text-muted-foreground truncate">
                {s.account_name} · {s.stage.toUpperCase()}
              </div>
            </div>
            <Badge variant="outline" className="shrink-0">
              {s.days_since_update}d
            </Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function TopResources({ data }: { data: DashboardOut }) {
  const max = Math.max(1, ...data.top_resources.map((r) => r.clicks));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Most-pulled resources</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.top_resources.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No resource clicks captured yet.
          </p>
        )}
        {data.top_resources.map((r) => (
          <div key={r.resource_key} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-sm mb-0.5">
                <span className="truncate">{r.label}</span>
                <span className="font-medium">{r.clicks}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${(r.clicks / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
