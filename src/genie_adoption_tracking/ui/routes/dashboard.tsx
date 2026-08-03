import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, useEffect, useRef, useState } from "react";
import { useGetDashboardSuspense, type DashboardOut } from "@/lib/api";
import { selector } from "@/lib/selector";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Layers,
  DollarSign,
  ShieldAlert,
  Gauge,
  Bug,
  Sparkles,
  MessageSquare,
  ArrowRight,
  X,
  Loader2,
} from "lucide-react";

// A drill-down filter: a human label + the query params sent to /api/accounts.
export interface AcctFilter {
  label: string;
  params: Record<string, string>;
}
type OnFilter = (f: AcctFilter) => void;

interface AcctRow {
  id: string;
  name: string;
  sub_vertical?: string;
  ae_owner?: string;
  sa_owner?: string;
  dsa_owner?: string;
}

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
          FINS Genie adoption at a glance
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
  // The active drill-down filter — set when a tile/segment is clicked; the matching
  // accounts render inline (below) rather than navigating to the Accounts page.
  const [filter, setFilter] = useState<AcctFilter | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const onFilter: OnFilter = (f) => {
    setFilter(f);
    // Bring the inline panel into view.
    requestAnimationFrame(() =>
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  return (
    <div className="space-y-6">
      {/* Headline row (start big) — always visible above the tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatTile icon={<Users className="h-4 w-4" />} label="FINS accounts" value={data.total_accounts} />
        <StatTile
          icon={<Sparkles className="h-4 w-4" />}
          label="Genie-active"
          value={data.genie_active_accounts ?? 0}
          tone="good"
          onClick={() =>
            onFilter({ label: "Genie-active accounts", params: { genie_active: "true" } })
          }
        />
        <StatTile
          icon={<DollarSign className="h-4 w-4" />}
          label="Genie revenue (30d)"
          display={fmtDbus(data.genie_revenue_t30d ?? 0)}
          tone="good"
          onClick={() =>
            onFilter({ label: "Accounts with Genie spend (30d)", params: { has_spend: "true" } })
          }
        />
        <StatTile
          icon={<MessageSquare className="h-4 w-4" />}
          label="Active Genie spaces"
          value={data.active_genie_spaces ?? 0}
        />
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

      {/* Four lenses, mirroring the logfood dashboard's pages */}
      <Tabs defaultValue="pp">
        <TabsList>
          <TabsTrigger value="pp">Partner-Powered AI</TabsTrigger>
          <TabsTrigger value="accounts">Genie Accounts</TabsTrigger>
          <TabsTrigger value="brickroad">Brickroad</TabsTrigger>
          <TabsTrigger value="ready">Genie Ready</TabsTrigger>
        </TabsList>

        <TabsContent value="pp" className="mt-4">
          <PartnerPoweredTab data={data} onFilter={onFilter} />
        </TabsContent>
        <TabsContent value="accounts" className="mt-4">
          <GenieAccountsTab data={data} onFilter={onFilter} />
        </TabsContent>
        <TabsContent value="brickroad" className="mt-4">
          <BrickroadTab data={data} onFilter={onFilter} />
        </TabsContent>
        <TabsContent value="ready" className="mt-4">
          <GenieReadyTab data={data} onFilter={onFilter} />
        </TabsContent>
      </Tabs>

      {/* Inline drill-down panel — shows the accounts behind a clicked tile/segment,
          rendered BELOW the lens it was triggered from. */}
      <div ref={panelRef}>
        {filter && (
          <InlineAccounts filter={filter} onClose={() => setFilter(null)} />
        )}
      </div>
    </div>
  );
}

// Inline account list for a drill-down filter — fetches /api/accounts with the
// filter's params and renders the matches right on the Signals page.
function InlineAccounts({
  filter,
  onClose,
}: {
  filter: AcctFilter;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<AcctRow[] | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    setRows(null);
    const qs = new URLSearchParams(filter.params).toString();
    fetch(`/api/accounts?${qs}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (mine === seq.current) setRows(Array.isArray(d) ? d : []);
      })
      .catch(() => {
        if (mine === seq.current) setRows([]);
      });
  }, [filter]);

  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            {filter.label}
            {rows !== null && (
              <Badge variant="secondary">{rows.length}</Badge>
            )}
          </CardTitle>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" /> Close
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {rows === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading accounts…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No accounts match this filter.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2 max-h-[26rem] overflow-y-auto">
            {rows.map((a) => (
              <Link
                key={a.id}
                to="/accounts/$accountId"
                params={{ accountId: a.id }}
                className="flex items-center justify-between rounded-md border px-3 py-2 hover:border-primary/50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{a.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {a.sub_vertical || "—"}
                    {a.ae_owner && <> · AE {a.ae_owner}</>}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// A one-line "so what" callout above each tab's content.
function SoWhat({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground mb-4 max-w-3xl">{children}</p>
  );
}

// ------------------------------------------------------------------ Tab 1: PP AI
function PartnerPoweredTab({ data, onFilter }: { data: DashboardOut; onFilter: OnFilter }) {
  const ppOff = data.pp_off_accounts ?? 0;
  return (
    <div className="space-y-6">
      <SoWhat>
        Partner-Powered AI must be on for Genie to consume. Accounts that are off (and
        can't consume via any workspace) are the hard blocker; enforce-off accounts can
        still consume through select workspaces.
      </SoWhat>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          icon={<ShieldAlert className="h-4 w-4" />}
          label="PP AI off (blocked)"
          value={ppOff}
          tone={ppOff > 0 ? "bad" : undefined}
          onClick={() =>
            onFilter({ label: "Partner-Powered AI off (blocked)", params: { pp: "off" } })
          }
        />
        <StatTile
          icon={<ShieldAlert className="h-4 w-4" />}
          label="PP AI Off · enforce on"
          value={data.pp_off_enforce_on ?? 0}
          tone={(data.pp_off_enforce_on ?? 0) > 0 ? "bad" : undefined}
          onClick={() =>
            onFilter({ label: "PP AI off · enforce on", params: { pp: "off_enforce_on" } })
          }
        />
        <StatTile
          icon={<ShieldAlert className="h-4 w-4" />}
          label="PP AI Off · enforce off"
          value={data.pp_off_enforce_off ?? 0}
          tone={(data.pp_off_enforce_off ?? 0) > 0 ? "warn" : undefined}
          onClick={() =>
            onFilter({ label: "PP AI off · enforce off", params: { pp: "off_enforce_off" } })
          }
        />
        <StatTile
          icon={<DollarSign className="h-4 w-4" />}
          label="Genie revenue (30d)"
          display={fmtDbus(data.genie_revenue_t30d ?? 0)}
          tone="good"
          onClick={() =>
            onFilter({ label: "Accounts with Genie spend (30d)", params: { has_spend: "true" } })
          }
        />
      </div>

      <SpendDistribution data={data} />
    </div>
  );
}

function SpendDistribution({ data }: { data: DashboardOut }) {
  const buckets = data.spend_buckets ?? [];
  const max = Math.max(1, ...buckets.map((b) => b.account_count));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Genie spend distribution (T30D) — accounts per spend bucket
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {buckets.length === 0 && (
          <p className="text-sm text-muted-foreground">No spend data yet.</p>
        )}
        {buckets.map((b) => (
          <div key={b.order} className="flex items-center gap-3">
            <div className="w-24 shrink-0 text-sm text-muted-foreground text-right">
              {b.label}
            </div>
            <div className="flex-1">
              <div className="h-4 rounded bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded"
                  style={{ width: `${(b.account_count / max) * 100}%` }}
                />
              </div>
            </div>
            <div className="w-10 shrink-0 text-sm font-medium">{b.account_count}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------- Tab 2: Genie Accounts
function GenieAccountsTab({ data, onFilter }: { data: DashboardOut; onFilter: OnFilter }) {
  return (
    <div className="space-y-6">
      <SoWhat>
        Where Genie use cases sit in the UCO funnel, and the untapped whitespace —
        FINS customers with no Genie use case at all, ranked by ARR.
      </SoWhat>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          icon={<Layers className="h-4 w-4" />}
          label="Genie use cases"
          value={data.total_use_cases}
        />
        <StatTile
          icon={<Sparkles className="h-4 w-4" />}
          label="Live (U6)"
          value={data.live_use_cases}
          tone="good"
          onClick={() =>
            onFilter({ label: "Accounts with a Live (U6) use case", params: { stage: "u6" } })
          }
        />
        <StatTile
          icon={<Layers className="h-4 w-4" />}
          label="Whitespace"
          value={data.whitespace_accounts ?? 0}
          tone={(data.whitespace_accounts ?? 0) > 0 ? "warn" : undefined}
          onClick={() =>
            onFilter({ label: "Whitespace — no Genie use case", params: { whitespace: "true" } })
          }
        />
        <StatTile
          icon={<DollarSign className="h-4 w-4" />}
          label="Est. pipeline $/mo"
          display={fmtDbus(data.total_monthly_dbus ?? 0)}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Funnel data={data} onFilter={onFilter} />
        <Whitespace data={data} />
      </div>
    </div>
  );
}

function Whitespace({ data }: { data: DashboardOut }) {
  const rows = data.whitespace_top ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Top whitespace accounts (no Genie use case)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No whitespace — every account has a Genie use case.</p>
        )}
        {rows.map((a) => (
          <Link
            key={a.id}
            to="/accounts/$accountId"
            params={{ accountId: a.id }}
            className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent transition-colors"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{a.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {a.sub_vertical || "—"}
                {a.ae_owner && <> · AE {a.ae_owner}</>}
              </div>
            </div>
            <span className="text-sm font-medium shrink-0 ml-2">
              {fmtDbus(a.arr ?? 0)}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------- Tab 3: Brickroad
function BrickroadTab({ data, onFilter }: { data: DashboardOut; onFilter: OnFilter }) {
  return (
    <div className="space-y-6">
      <SoWhat>
        Genie-related Brickroad issues on FINS accounts — what's blocking or at risk,
        ranked by revenue impact.
      </SoWhat>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          icon={<Bug className="h-4 w-4" />}
          label="Open issues"
          value={data.open_issues ?? 0}
          tone={(data.open_issues ?? 0) > 0 ? "warn" : undefined}
        />
        <StatTile
          icon={<Bug className="h-4 w-4" />}
          label="At risk"
          value={data.issues_at_risk ?? 0}
          tone={(data.issues_at_risk ?? 0) > 0 ? "bad" : undefined}
        />
        <StatTile
          icon={<Users className="h-4 w-4" />}
          label="Accounts w/ issues"
          value={data.accounts_with_issues ?? 0}
          onClick={() =>
            onFilter({ label: "Accounts with open Genie issues", params: { open_issues: "true" } })
          }
        />
        <StatTile
          icon={<DollarSign className="h-4 w-4" />}
          label="Revenue impact"
          display={fmtDbus(data.total_revenue_impact ?? 0)}
          tone={(data.total_revenue_impact ?? 0) > 0 ? "bad" : undefined}
        />
      </div>

      <BrickroadTable data={data} />
    </div>
  );
}

function severityTone(sev: string): string {
  const s = sev.toLowerCase();
  if (s.includes("block")) return "border-destructive/50 text-destructive";
  if (s.includes("risk")) return "border-amber-600/50 text-amber-700 dark:text-amber-400";
  return "border-border text-muted-foreground";
}

function BrickroadTable({ data }: { data: DashboardOut }) {
  const rows = data.brickroad_issues ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Genie Brickroad blockers</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open Genie issues.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-3 font-medium">Issue</th>
                  <th className="py-2 pr-3 font-medium">Account</th>
                  <th className="py-2 pr-3 font-medium">Severity</th>
                  <th className="py-2 pr-3 font-medium">Product area</th>
                  <th className="py-2 pr-3 font-medium text-right">Revenue impact</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-3">
                      {i.display_id ? (
                        <a
                          href={`https://brickroad.databricks.com/issues/${i.display_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          #{i.display_id}
                        </a>
                      ) : null}
                      <div className="text-xs text-muted-foreground max-w-xs truncate">
                        {i.title}
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <Link
                        to="/accounts/$accountId"
                        params={{ accountId: i.account_id ?? "" }}
                        className="hover:underline"
                      >
                        {i.account_name}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className={severityTone(i.severity ?? "")}>
                        {i.severity}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{i.product_area || "—"}</td>
                    <td className="py-2 pr-3 text-right font-medium">
                      {(i.revenue_impact ?? 0) > 0 ? fmtDbus(i.revenue_impact ?? 0) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------- Tab 4: Genie Ready
function GenieReadyTab({ data, onFilter }: { data: DashboardOut; onFilter: OnFilter }) {
  const tierFilter = (tier: string, label: string) => () =>
    onFilter({ label: `Genie-Ready tier: ${label}`, params: { tier } });
  return (
    <div className="space-y-6">
      <SoWhat>
        GTM Genie-Ready tier per account (green / yellow / red). A readiness signal from
        GTM, distinct from the team-filled workflow readiness. Click a tier to see those
        accounts.
      </SoWhat>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={<span>🟢</span>} label="Green" value={data.tier_green ?? 0} tone="good" onClick={tierFilter("green", "Green")} />
        <StatTile icon={<span>🟡</span>} label="Yellow" value={data.tier_yellow ?? 0} tone="warn" onClick={tierFilter("yellow", "Yellow")} />
        <StatTile icon={<span>🔴</span>} label="Red" value={data.tier_red ?? 0} tone="bad" onClick={tierFilter("red", "Red")} />
        <StatTile icon={<span>⚪</span>} label="Unknown" value={data.tier_unknown ?? 0} onClick={tierFilter("unknown", "Unknown")} />
      </div>

      <GenieReadyTable data={data} />
    </div>
  );
}

const TIER_DOT: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-destructive",
  unknown: "bg-muted-foreground/50",
};

function GenieReadyTable({ data }: { data: DashboardOut }) {
  const rows = data.genie_ready_accounts ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Genie-Ready accounts (by ARR)</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-3 font-medium">Account</th>
                  <th className="py-2 pr-3 font-medium">Tier</th>
                  <th className="py-2 pr-3 font-medium">Provisioning</th>
                  <th className="py-2 pr-3 font-medium">PP AI</th>
                  <th className="py-2 pr-3 font-medium text-right">Genie $ (30d)</th>
                  <th className="py-2 pr-3 font-medium text-right">ARR</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <Link
                        to="/accounts/$accountId"
                        params={{ accountId: a.id }}
                        className="font-medium hover:underline"
                      >
                        {a.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{a.sub_vertical || "—"}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${TIER_DOT[a.readiness_tier ?? "unknown"] ?? TIER_DOT.unknown}`}
                        />
                        <span className="capitalize">{a.readiness_tier}</span>
                      </span>
                    </td>
                    <td className="py-2 pr-3 capitalize text-muted-foreground">
                      {a.provisioning_status}
                    </td>
                    <td className="py-2 pr-3 capitalize text-muted-foreground">
                      {(a.pp_status ?? "").replace("_", " ")}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {(a.genie_dollars_t30d ?? 0) > 0 ? fmtDbus(a.genie_dollars_t30d ?? 0) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium">{fmtDbus(a.arr ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ shared bits
function StatTile({
  icon,
  label,
  value,
  display,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  display?: string;
  tone?: "good" | "warn" | "bad";
  onClick?: () => void; // when set, the tile opens an inline drill-down on this page
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
      <div className={`text-2xl font-bold mt-1 ${toneClass}`}>
        {display ?? value}
      </div>
    </CardContent>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="text-left">
        <Card className="hover:border-primary/50 transition-colors h-full">
          {inner}
        </Card>
      </button>
    );
  }
  return <Card>{inner}</Card>;
}

function Funnel({ data, onFilter }: { data: DashboardOut; onFilter: OnFilter }) {
  const max = Math.max(1, ...data.funnel.map((f) => f.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Adoption funnel (count &amp; $DBU by stage)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.funnel.map((f) => (
          <button
            key={f.stage}
            type="button"
            disabled={f.count === 0 || f.stage === "prereqs"}
            onClick={() =>
              onFilter({
                label: `Use case at stage ${f.code} — ${f.name}`,
                params: { stage: f.stage },
              })
            }
            className="w-full flex items-center gap-3 text-left rounded-md px-1 py-0.5 enabled:hover:bg-accent transition-colors disabled:cursor-default"
          >
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
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-10 w-96" />
      <div className="grid lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
