import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useGetDashboardSuspense, type DashboardOut } from "@/lib/api";
import { selector } from "@/lib/selector";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Users,
  Layers,
  DollarSign,
  ShieldAlert,
  ShieldCheck,
  Gauge,
  Bug,
  Sparkles,
  ArrowUpDown,
  X,
  Loader2,
  Search,
} from "lucide-react";

function fmtDbus(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

const TIER_DOT: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-destructive",
  unknown: "bg-muted-foreground/50",
};

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
  arr?: number;
  readiness_tier?: string;
  pp_status?: string;
  pp_enforce?: string;
  ws_pp_on?: number;
  provisioning_status?: string;
  use_case_count?: number;
  genie_spend_90d?: number;
  open_issues?: number;
  open_blockers?: number;
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
        cols="lg:grid-cols-5"
        tiles={[
          { key: "total", icon: <Users className="h-4 w-4" />, label: "FINS accounts", value: data.total_accounts },
          {
            key: "genie_active",
            icon: <Sparkles className="h-4 w-4" />,
            label: "Genie-active (30d)",
            value: data.genie_active_accounts ?? 0,
            tone: "good",
            filter: { label: "Genie-active accounts (last 30d)", params: { genie_active: "true" } },
          },
          {
            key: "revenue",
            icon: <DollarSign className="h-4 w-4" />,
            label: "Genie revenue (30d)",
            display: fmtDbus(data.genie_revenue_t30d ?? 0),
            tone: "good",
            filter: { label: "Accounts with Genie spend (30d)", params: { has_spend: "true" } },
          },
          { key: "readiness", icon: <Gauge className="h-4 w-4" />, label: "Avg readiness", display: `${data.avg_readiness_pct ?? 0}%` },
          { key: "pipeline", icon: <DollarSign className="h-4 w-4" />, label: "Est. pipeline $/mo", display: fmtDbus(data.est_pipeline_per_month ?? 0) },
        ]}
      />

      {/* Four lenses, mirroring the logfood dashboard's pages */}
      <Tabs defaultValue="pp">
        <TabsList>
          <TabsTrigger value="pp">Partner-Powered AI</TabsTrigger>
          <TabsTrigger value="accounts">Genie Accounts</TabsTrigger>
          <TabsTrigger value="brickroad">Brickroad</TabsTrigger>
          <TabsTrigger value="ready">Genie Ready</TabsTrigger>
          <TabsTrigger value="subvertical">By Sub-Vertical</TabsTrigger>
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
        <TabsContent value="subvertical" className="mt-4">
          <SubVerticalTab data={data} />
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

// Sortable columns for the inline account table.
type SortKey = "name" | "arr" | "genie_spend_90d" | "use_case_count" | "open_issues";
const NUMERIC_SORTS: SortKey[] = ["arr", "genie_spend_90d", "use_case_count", "open_issues"];

const PP_LABEL: Record<string, string> = {
  on: "On",
  on_default: "On",
  off: "Off",
  unknown: "—",
};
const PROV_LABEL: Record<string, string> = {
  on: "On",
  partial: "Partial",
  off: "Off",
  unknown: "—",
};

function toneDot(status: string, good: string[], bad: string[]): string {
  if (good.includes(status)) return "bg-emerald-500";
  if (bad.includes(status)) return "bg-destructive";
  return "bg-amber-500";
}

// Inline account TABLE for a drill-down filter — fetches /api/accounts and shows the
// full account picture (tier, PP, provisioning, use cases, Genie spend, issues, ARR),
// sortable by any numeric column. Rendered right on the Signals page.
function InlineAccounts({
  filter,
  onClose,
}: {
  filter: AcctFilter;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<AcctRow[] | null>(null);
  const [sort, setSort] = useState<SortKey>("arr");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const seq = useRef(0);

  // Serialize params so the effect re-runs on value change (not object identity),
  // and debounce so typing in the search box doesn't fire a request per keystroke.
  const qs = new URLSearchParams(filter.params).toString();
  useEffect(() => {
    const mine = ++seq.current;
    setRows(null);
    const t = setTimeout(() => {
      fetch(`/api/accounts?${qs}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => {
          if (mine === seq.current) setRows(Array.isArray(d) ? d : []);
        })
        .catch(() => {
          if (mine === seq.current) setRows([]);
        });
    }, 250);
    return () => clearTimeout(t);
  }, [qs]);

  const sorted = rows
    ? [...rows].sort((a, b) => {
        const mul = dir === "asc" ? 1 : -1;
        if (sort === "name") return mul * a.name.localeCompare(b.name);
        return mul * (((a[sort] as number) ?? 0) - ((b[sort] as number) ?? 0));
      })
    : null;

  const clickSort = (k: SortKey) => {
    if (sort === k) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(k);
      setDir(NUMERIC_SORTS.includes(k) ? "desc" : "asc");
    }
  };

  const Th = ({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "right" }) => (
    <th className={cn("py-2 px-2 font-medium", align === "right" && "text-right")}>
      <button
        onClick={() => clickSort(k)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          align === "right" && "flex-row-reverse"
        )}
      >
        {label}
        <ArrowUpDown className={cn("h-3 w-3", sort === k ? "text-foreground" : "text-muted-foreground/40")} />
      </button>
    </th>
  );

  // Totals footer — quick roll-up of the segment.
  const totalArr = sorted?.reduce((s, a) => s + (a.arr ?? 0), 0) ?? 0;
  const totalSpend = sorted?.reduce((s, a) => s + (a.genie_spend_90d ?? 0), 0) ?? 0;
  const totalUc = sorted?.reduce((s, a) => s + (a.use_case_count ?? 0), 0) ?? 0;

  return (
    <Card className="border-primary/40 bg-primary/[0.03]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            {filter.label}
            {sorted !== null && <Badge variant="secondary">{sorted.length}</Badge>}
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
        {sorted === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading accounts…
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No accounts match this filter.
          </p>
        ) : (
          <div className="max-h-[28rem] overflow-auto rounded-md border bg-card">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10 text-xs text-muted-foreground border-b">
                <tr className="text-left">
                  <Th k="name" label="Account" />
                  <th className="py-2 px-2 font-medium">Tier</th>
                  <th className="py-2 px-2 font-medium">PP AI</th>
                  <th className="py-2 px-2 font-medium">Provisioning</th>
                  <Th k="use_case_count" label="Use cases" align="right" />
                  <Th k="genie_spend_90d" label="Genie $ (30d)" align="right" />
                  <Th k="open_issues" label="Issues" align="right" />
                  <Th k="arr" label="ARR" align="right" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-accent/50">
                    <td className="py-1.5 px-2">
                      <Link
                        to="/accounts/$accountId"
                        params={{ accountId: a.id }}
                        className="font-medium hover:underline"
                      >
                        {a.name}
                      </Link>
                      <div className="text-xs text-muted-foreground truncate max-w-[14rem]">
                        {a.sub_vertical || "—"}
                        {a.ae_owner && <> · AE {a.ae_owner}</>}
                      </div>
                    </td>
                    <td className="py-1.5 px-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${TIER_DOT[a.readiness_tier ?? "unknown"] ?? TIER_DOT.unknown}`} />
                        <span className="capitalize">{a.readiness_tier ?? "—"}</span>
                      </span>
                    </td>
                    <td className="py-1.5 px-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${toneDot(a.pp_status ?? "unknown", ["on", "on_default"], ["off"])}`} />
                        {PP_LABEL[a.pp_status ?? "unknown"] ?? a.pp_status}
                        {a.pp_status === "off" && (
                          <span
                            className="text-xs text-muted-foreground"
                            title={
                              a.pp_enforce === "on"
                                ? "Enforce on — Genie is hard-blocked account-wide."
                                : "Enforce off — the account default is off, but individual workspaces can turn PP on, so Genie can still consume there."
                            }
                          >
                            {a.pp_enforce === "on" ? "· enforce on" : "· enforce off ⓘ"}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-1.5 px-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${toneDot(a.provisioning_status ?? "unknown", ["on"], ["off"])}`} />
                        {PROV_LABEL[a.provisioning_status ?? "unknown"] ?? a.provisioning_status}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{a.use_case_count ?? 0}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {(a.genie_spend_90d ?? 0) > 0 ? fmtDbus(a.genie_spend_90d ?? 0) : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {(a.open_issues ?? 0) > 0 ? (
                        <span className="text-destructive font-medium">{a.open_issues}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums font-medium">{fmtDbus(a.arr ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-muted/80 border-t text-xs font-medium">
                <tr>
                  <td className="py-1.5 px-2 text-muted-foreground">Totals</td>
                  <td colSpan={3}></td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{totalUc}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{fmtDbus(totalSpend)}</td>
                  <td></td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{fmtDbus(totalArr)}</td>
                </tr>
              </tfoot>
            </table>
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
  return (
    <div className="space-y-6">
      <SoWhat>
        Partner-Powered AI must be on for Genie to consume.
      </SoWhat>

      <TileGrid
        tiles={[
          {
            key: "pp_on",
            icon: <ShieldCheck className="h-4 w-4" />,
            label: "PP AI on",
            value: data.pp_on_accounts ?? 0,
            tone: "good",
            filter: { label: "Partner-Powered AI on", params: { pp: "on" } },
          },
          {
            key: "enf_on",
            icon: <ShieldAlert className="h-4 w-4" />,
            label: "PP AI off · enforce on",
            value: data.pp_off_enforce_on ?? 0,
            tone: (data.pp_off_enforce_on ?? 0) > 0 ? "bad" : undefined,
            filter: { label: "PP AI off · enforce on", params: { pp: "off_enforce_on" } },
          },
          {
            key: "enf_off",
            icon: <ShieldAlert className="h-4 w-4" />,
            label: "PP AI off · enforce off",
            value: data.pp_off_enforce_off ?? 0,
            tone: (data.pp_off_enforce_off ?? 0) > 0 ? "warn" : undefined,
            filter: { label: "PP AI off · enforce off", params: { pp: "off_enforce_off" } },
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
  const [filter, setFilter] = useState<AcctFilter | null>(null);
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
        {buckets.map((b) => {
          const isActive = filter?.params.spend_bucket === String(b.order);
          return (
            <button
              key={b.order}
              type="button"
              disabled={b.account_count === 0}
              onClick={() =>
                setFilter(
                  isActive
                    ? null
                    : {
                        label: `Genie spend (30d): ${b.label}`,
                        params: { spend_bucket: String(b.order) },
                      }
                )
              }
              className={cn(
                "w-full flex items-center gap-3 rounded px-1 py-0.5 text-left transition-colors disabled:cursor-default",
                isActive ? "bg-accent" : "enabled:hover:bg-accent"
              )}
            >
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
            </button>
          );
        })}
        {filter && (
          <div className="pt-2">
            <InlineAccounts filter={filter} onClose={() => setFilter(null)} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------- Tab 2: Genie Accounts
function GenieAccountsTab({ data }: { data: DashboardOut }) {
  // Funnel drill-down — its own state so the panel appears right under the funnel row.
  const [stageFilter, setStageFilter] = useState<AcctFilter | null>(null);
  const [q, setQ] = useState("");
  const needle = q.trim();

  return (
    <div className="space-y-6">
      <SoWhat>The UCO funnel, whitespace, and account lookup.</SoWhat>

      {/* Account search — find one account by name, sub-vertical, or owner */}
      <div>
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search accounts by name, sub-vertical, AE, SA, or DSA…"
            className="pl-9 h-10"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {needle && (
          <div className="mt-3">
            <InlineAccounts
              filter={{ label: `Search: “${needle}”`, params: { q: needle } }}
              onClose={() => setQ("")}
            />
          </div>
        )}
      </div>

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
        ]}
      />

      <Funnel data={data} active={stageFilter} onPick={setStageFilter} />
      {stageFilter && (
        <InlineAccounts filter={stageFilter} onClose={() => setStageFilter(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------- Tab 5: By Sub-Vertical
function SubVerticalTab({ data }: { data: DashboardOut }) {
  const rows = data.sub_verticals ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const maxAcct = Math.max(1, ...rows.map((r) => r.accounts));

  return (
    <div className="space-y-4">
      <SoWhat>
        Adoption rolled up by sub-vertical. Click a row to see that sub-vertical's
        accounts, with their full detail.
      </SoWhat>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adoption by sub-vertical</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sub-vertical data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 px-2 font-medium">Sub-vertical</th>
                    <th className="py-2 px-2 font-medium">Accounts</th>
                    <th className="py-2 px-2 font-medium text-right">Genie-active</th>
                    <th className="py-2 px-2 font-medium text-right">Whitespace</th>
                    <th className="py-2 px-2 font-medium text-right">Genie $ (90d)</th>
                    <th className="py-2 px-2 font-medium text-right">Avg readiness</th>
                    <th className="py-2 px-2 font-medium text-right">ARR</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const isOpen = open === r.sub_vertical;
                    const activePct = r.accounts
                      ? Math.round((r.genie_active / r.accounts) * 100)
                      : 0;
                    return (
                      <>
                        <tr
                          key={r.sub_vertical}
                          onClick={() =>
                            setOpen((o) => (o === r.sub_vertical ? null : r.sub_vertical))
                          }
                          className={cn(
                            "border-b last:border-0 cursor-pointer hover:bg-accent/50",
                            isOpen && "bg-accent/50"
                          )}
                        >
                          <td className="py-1.5 px-2 font-medium">{r.sub_vertical}</td>
                          <td className="py-1.5 px-2">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${(r.accounts / maxAcct) * 100}%` }}
                                />
                              </div>
                              <span className="tabular-nums">{r.accounts}</span>
                            </div>
                          </td>
                          <td className="py-1.5 px-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                            {r.genie_active}
                            <span className="text-muted-foreground font-normal"> ({activePct}%)</span>
                          </td>
                          <td className="py-1.5 px-2 text-right tabular-nums text-amber-700 dark:text-amber-400">
                            {r.whitespace}
                          </td>
                          <td className="py-1.5 px-2 text-right tabular-nums">
                            {(r.genie_spend_90d ?? 0) > 0 ? fmtDbus(r.genie_spend_90d ?? 0) : "—"}
                          </td>
                          <td className="py-1.5 px-2 text-right tabular-nums">
                            {r.avg_readiness_pct}%
                          </td>
                          <td className="py-1.5 px-2 text-right tabular-nums font-medium">
                            {fmtDbus(r.arr ?? 0)}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={7} className="p-0">
                              <div className="p-2 bg-primary/[0.03]">
                                <InlineAccounts
                                  filter={{
                                    label: `Sub-vertical: ${r.sub_vertical}`,
                                    params: { sub_vertical: r.sub_vertical },
                                  }}
                                  onClose={() => setOpen(null)}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
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
                    <td className="py-2 pr-3 text-muted-foreground">
                      {PP_LABEL[a.pp_status ?? "unknown"] ?? a.pp_status}
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
  // Only the U1–U6 UCO stages (drop Pre-Reqs) to mirror the logfood
  // "Count & $DBU by UCO Stage" chart.
  const stages = data.funnel.filter((f) => f.stage !== "prereqs");
  const max = Math.max(1, ...stages.map((f) => f.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Count &amp; $DBU by UCO Stage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {stages.map((f) => {
          const isActive = active?.params.stage === f.stage;
          return (
            <button
              key={f.stage}
              type="button"
              disabled={f.count === 0}
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
