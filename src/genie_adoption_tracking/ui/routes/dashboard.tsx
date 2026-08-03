import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useGetDashboardSuspense, type DashboardOut } from "@/lib/api";
import { selector } from "@/lib/selector";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
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

function fmtDbus(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export const Route = createFileRoute("/dashboard")({
  component: () => <DashboardPage />,
});

// A drill-down filter: a human label + the query params sent to /api/accounts.
export interface AcctFilter {
  label: string;
  params: Record<string, string>;
}

interface AcctRow {
  id: string;
  name: string;
  sub_vertical?: string;
  ae_owner?: string;
  sa_owner?: string;
  dsa_owner?: string;
}

// A tile spec — clickable (drill-down) when `filter` is set, otherwise a plain metric.
interface TileSpec {
  key: string;
  icon: ReactNode;
  label: string;
  value?: number;
  display?: string;
  tone?: "good" | "warn" | "bad";
  filter?: AcctFilter;
}

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

  return (
    <div className="space-y-6">
      {/* Headline row (start big) — click a tile to expand the accounts beneath it */}
      <TileGrid
        cols="lg:grid-cols-3 xl:grid-cols-6"
        tiles={[
          { key: "total", icon: <Users className="h-4 w-4" />, label: "FINS accounts", value: data.total_accounts },
          {
            key: "genie_active",
            icon: <Sparkles className="h-4 w-4" />,
            label: "Genie-active",
            value: data.genie_active_accounts ?? 0,
            tone: "good",
            filter: { label: "Genie-active accounts", params: { genie_active: "true" } },
          },
          {
            key: "revenue",
            icon: <DollarSign className="h-4 w-4" />,
            label: "Genie revenue (30d)",
            display: fmtDbus(data.genie_revenue_t30d ?? 0),
            tone: "good",
            filter: { label: "Accounts with Genie spend (30d)", params: { has_spend: "true" } },
          },
          { key: "spaces", icon: <MessageSquare className="h-4 w-4" />, label: "Active Genie spaces", value: data.active_genie_spaces ?? 0 },
          { key: "readiness", icon: <Gauge className="h-4 w-4" />, label: "Avg readiness", display: `${data.avg_readiness_pct ?? 0}%` },
          { key: "pipeline", icon: <DollarSign className="h-4 w-4" />, label: "Est. pipeline $/mo", display: fmtDbus(data.total_monthly_dbus ?? 0) },
        ]}
      />

      {/* Four lenses, mirroring the logfood dashboard's pages */}
      <Tabs defaultValue="pp">
        <TabsList>
          <TabsTrigger value="pp">Partner-Powered AI</TabsTrigger>
          <TabsTrigger value="accounts">Genie Accounts</TabsTrigger>
          <TabsTrigger value="brickroad">Brickroad</TabsTrigger>
          <TabsTrigger value="ready">Genie Ready</TabsTrigger>
        </TabsList>

        <TabsContent value="pp" className="mt-4">
          <PartnerPoweredTab data={data} />
        </TabsContent>
        <TabsContent value="accounts" className="mt-4">
          <GenieAccountsTab data={data} />
        </TabsContent>
        <TabsContent value="brickroad" className="mt-4">
          <BrickroadTab data={data} />
        </TabsContent>
        <TabsContent value="ready" className="mt-4">
          <GenieReadyTab data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// A grid of stat tiles that expands the matching accounts INLINE, directly beneath
// the row, when a clickable tile is selected. The active tile is ringed and points a
// caret at the panel so the link between "the number" and "the accounts" is obvious.
function TileGrid({ tiles, cols = "lg:grid-cols-4" }: { tiles: TileSpec[]; cols?: string }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = tiles.find((t) => t.key === openKey && t.filter);
  // Column count at the widest breakpoint (last "grid-cols-N" wins), for caret placement.
  const colClasses = cols.match(/grid-cols-(\d+)/g) ?? [];
  const maxCols = colClasses.length
    ? Number(colClasses[colClasses.length - 1].split("-").pop())
    : 4;
  const openIdx = open ? tiles.findIndex((t) => t.key === open.key) : -1;

  return (
    <div>
      <div className={cn("grid grid-cols-2 gap-4", cols)}>
        {tiles.map((t) => (
          <StatTile
            key={t.key}
            icon={t.icon}
            label={t.label}
            value={t.value}
            display={t.display}
            tone={t.tone}
            active={openKey === t.key}
            onClick={
              t.filter
                ? () => setOpenKey((k) => (k === t.key ? null : t.key))
                : undefined
            }
          />
        ))}
      </div>
      {open?.filter && (
        <div className="mt-2">
          {/* Caret pointing up at the active tile (best-effort: aligns to the tile's
              column at the widest breakpoint). */}
          <div
            className="hidden lg:block h-2 overflow-hidden"
            aria-hidden
          >
            <div
              className="h-3 w-3 rotate-45 bg-card border-l border-t border-primary/40 mx-auto"
              style={{
                marginLeft: `calc((100% / ${maxCols}) * ${openIdx + 0.5} - 0.375rem)`,
              }}
            />
          </div>
          <InlineAccounts filter={open.filter} onClose={() => setOpenKey(null)} />
        </div>
      )}
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
    <Card className="border-primary/40 bg-primary/[0.03]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            {filter.label}
            {rows !== null && <Badge variant="secondary">{rows.length}</Badge>}
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
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2 max-h-[26rem] overflow-y-auto">
            {rows.map((a) => (
              <Link
                key={a.id}
                to="/accounts/$accountId"
                params={{ accountId: a.id }}
                className="flex items-center justify-between rounded-md border bg-card px-3 py-2 hover:border-primary/50 transition-colors"
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
function SoWhat({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground mb-4 max-w-3xl">{children}</p>
  );
}

// ------------------------------------------------------------------ Tab 1: PP AI
function PartnerPoweredTab({ data }: { data: DashboardOut }) {
  const ppOff = data.pp_off_accounts ?? 0;
  return (
    <div className="space-y-6">
      <SoWhat>
        Partner-Powered AI must be on for Genie to consume. Accounts that are off (and
        can't consume via any workspace) are the hard blocker; enforce-off accounts can
        still consume through select workspaces.
      </SoWhat>

      <TileGrid
        tiles={[
          {
            key: "pp_off",
            icon: <ShieldAlert className="h-4 w-4" />,
            label: "PP AI off (blocked)",
            value: ppOff,
            tone: ppOff > 0 ? "bad" : undefined,
            filter: { label: "Partner-Powered AI off (blocked)", params: { pp: "off" } },
          },
          {
            key: "enf_on",
            icon: <ShieldAlert className="h-4 w-4" />,
            label: "PP AI Off · enforce on",
            value: data.pp_off_enforce_on ?? 0,
            tone: (data.pp_off_enforce_on ?? 0) > 0 ? "bad" : undefined,
            filter: { label: "PP AI off · enforce on", params: { pp: "off_enforce_on" } },
          },
          {
            key: "enf_off",
            icon: <ShieldAlert className="h-4 w-4" />,
            label: "PP AI Off · enforce off",
            value: data.pp_off_enforce_off ?? 0,
            tone: (data.pp_off_enforce_off ?? 0) > 0 ? "warn" : undefined,
            filter: { label: "PP AI off · enforce off", params: { pp: "off_enforce_off" } },
          },
          {
            key: "revenue",
            icon: <DollarSign className="h-4 w-4" />,
            label: "Genie revenue (30d)",
            display: fmtDbus(data.genie_revenue_t30d ?? 0),
            tone: "good",
            filter: { label: "Accounts with Genie spend (30d)", params: { has_spend: "true" } },
          },
        ]}
      />

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
function GenieAccountsTab({ data }: { data: DashboardOut }) {
  // Funnel drill-down — its own state so the panel appears right under the funnel row.
  const [stageFilter, setStageFilter] = useState<AcctFilter | null>(null);

  return (
    <div className="space-y-6">
      <SoWhat>
        Where Genie use cases sit in the UCO funnel, and the untapped whitespace —
        FINS customers with no Genie use case at all, ranked by ARR.
      </SoWhat>

      <TileGrid
        tiles={[
          { key: "uc", icon: <Layers className="h-4 w-4" />, label: "Genie use cases", value: data.total_use_cases },
          {
            key: "live",
            icon: <Sparkles className="h-4 w-4" />,
            label: "Live (U6)",
            value: data.live_use_cases,
            tone: "good",
            filter: { label: "Accounts with a Live (U6) use case", params: { stage: "u6" } },
          },
          {
            key: "whitespace",
            icon: <Layers className="h-4 w-4" />,
            label: "Whitespace",
            value: data.whitespace_accounts ?? 0,
            tone: (data.whitespace_accounts ?? 0) > 0 ? "warn" : undefined,
            filter: { label: "Whitespace — no Genie use case", params: { whitespace: "true" } },
          },
          { key: "pipeline", icon: <DollarSign className="h-4 w-4" />, label: "Est. pipeline $/mo", display: fmtDbus(data.total_monthly_dbus ?? 0) },
        ]}
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <Funnel data={data} active={stageFilter} onPick={setStageFilter} />
        <Whitespace data={data} />
      </div>
      {stageFilter && (
        <InlineAccounts filter={stageFilter} onClose={() => setStageFilter(null)} />
      )}
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
function BrickroadTab({ data }: { data: DashboardOut }) {
  return (
    <div className="space-y-6">
      <SoWhat>
        Genie-related Brickroad issues on FINS accounts — what's blocking or at risk,
        ranked by revenue impact.
      </SoWhat>

      <TileGrid
        tiles={[
          {
            key: "open",
            icon: <Bug className="h-4 w-4" />,
            label: "Open issues",
            value: data.open_issues ?? 0,
            tone: (data.open_issues ?? 0) > 0 ? "warn" : undefined,
          },
          {
            key: "at_risk",
            icon: <Bug className="h-4 w-4" />,
            label: "At risk",
            value: data.issues_at_risk ?? 0,
            tone: (data.issues_at_risk ?? 0) > 0 ? "bad" : undefined,
          },
          {
            key: "accts",
            icon: <Users className="h-4 w-4" />,
            label: "Accounts w/ issues",
            value: data.accounts_with_issues ?? 0,
            filter: { label: "Accounts with open Genie issues", params: { open_issues: "true" } },
          },
          {
            key: "rev",
            icon: <DollarSign className="h-4 w-4" />,
            label: "Revenue impact",
            display: fmtDbus(data.total_revenue_impact ?? 0),
            tone: (data.total_revenue_impact ?? 0) > 0 ? "bad" : undefined,
          },
        ]}
      />

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
function GenieReadyTab({ data }: { data: DashboardOut }) {
  return (
    <div className="space-y-6">
      <SoWhat>
        GTM Genie-Ready tier per account (green / yellow / red). A readiness signal from
        GTM, distinct from the team-filled workflow readiness. Click a tier to see those
        accounts.
      </SoWhat>

      <TileGrid
        tiles={[
          { key: "green", icon: <span>🟢</span>, label: "Green", value: data.tier_green ?? 0, tone: "good", filter: { label: "Genie-Ready tier: Green", params: { tier: "green" } } },
          { key: "yellow", icon: <span>🟡</span>, label: "Yellow", value: data.tier_yellow ?? 0, tone: "warn", filter: { label: "Genie-Ready tier: Yellow", params: { tier: "yellow" } } },
          { key: "red", icon: <span>🔴</span>, label: "Red", value: data.tier_red ?? 0, tone: "bad", filter: { label: "Genie-Ready tier: Red", params: { tier: "red" } } },
          { key: "unknown", icon: <span>⚪</span>, label: "Unknown", value: data.tier_unknown ?? 0, filter: { label: "Genie-Ready tier: Unknown", params: { tier: "unknown" } } },
        ]}
      />

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
  active,
}: {
  icon: ReactNode;
  label: string;
  value?: number;
  display?: string;
  tone?: "good" | "warn" | "bad";
  onClick?: () => void; // when set, the tile opens an inline drill-down on this page
  active?: boolean;
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
        <Card
          className={cn(
            "transition-colors h-full",
            active
              ? "border-primary ring-2 ring-primary/40 bg-primary/[0.03]"
              : "hover:border-primary/50"
          )}
        >
          {inner}
        </Card>
      </button>
    );
  }
  return <Card>{inner}</Card>;
}

function Funnel({
  data,
  active,
  onPick,
}: {
  data: DashboardOut;
  active: AcctFilter | null;
  onPick: (f: AcctFilter | null) => void;
}) {
  const max = Math.max(1, ...data.funnel.map((f) => f.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Adoption funnel (count &amp; $DBU by stage)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.funnel.map((f) => {
          const isActive = active?.params.stage === f.stage;
          return (
            <button
              key={f.stage}
              type="button"
              disabled={f.count === 0 || f.stage === "prereqs"}
              onClick={() =>
                onPick(
                  isActive
                    ? null
                    : {
                        label: `Use case at stage ${f.code} — ${f.name}`,
                        params: { stage: f.stage },
                      }
                )
              }
              className={cn(
                "w-full flex items-center gap-3 text-left rounded-md px-1 py-0.5 transition-colors disabled:cursor-default",
                isActive ? "bg-accent" : "enabled:hover:bg-accent"
              )}
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
          );
        })}
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
