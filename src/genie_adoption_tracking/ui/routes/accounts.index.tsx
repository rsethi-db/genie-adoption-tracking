import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, useMemo, useState } from "react";
import { useListAccountsSuspense } from "@/lib/api";
import { selector } from "@/lib/selector";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Search,
  AlertTriangle,
  Layers,
  ArrowRight,
  ShieldAlert,
  Bug,
} from "lucide-react";

export const Route = createFileRoute("/accounts/")({
  component: () => <AccountsPage />,
});

function fmtDbus(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function AccountsPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <p className="text-sm text-muted-foreground">
          FINS accounts synced from GTM. Search for an account to run the Genie
          playbook against its use cases.
        </p>
      </div>
      <Suspense fallback={<Fallback />}>
        <AccountSearch />
      </Suspense>
    </AppShell>
  );
}

type Filter = "all" | "genie" | "whitespace" | "pp_off" | "pp_off_enforce_off";

function AccountSearch() {
  const { data: accounts } = useListAccountsSuspense(selector());
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const stats = useMemo(() => {
    const withGenie = accounts.filter((a) => (a.use_case_count ?? 0) > 0);
    const pipeline = accounts.reduce((s, a) => s + (a.monthly_dbus ?? 0), 0);
    const ppOff = accounts.filter((a) => a.pp_status === "off");
    const ppOffEnforceOff = ppOff.filter((a) => a.pp_enforce === "off");
    const wsOn = accounts.reduce((s, a) => s + (a.ws_pp_on ?? 0), 0);
    const wsOff = accounts.reduce((s, a) => s + (a.ws_pp_off ?? 0), 0);
    return {
      total: accounts.length,
      genie: withGenie.length,
      whitespace: accounts.length - withGenie.length,
      ppOff: ppOff.length,
      ppOffEnforceOff: ppOffEnforceOff.length,
      wsOn,
      wsOff,
      pipeline,
    };
  }, [accounts]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return accounts
      .filter((a) => {
        if (filter === "genie" && (a.use_case_count ?? 0) === 0) return false;
        if (filter === "whitespace" && (a.use_case_count ?? 0) > 0) return false;
        if (filter === "pp_off" && a.pp_status !== "off") return false;
        if (
          filter === "pp_off_enforce_off" &&
          !(a.pp_status === "off" && a.pp_enforce === "off")
        )
          return false;
        if (!needle) return true;
        return (
          a.name.toLowerCase().includes(needle) ||
          (a.ae_owner ?? "").toLowerCase().includes(needle) ||
          (a.sa_owner ?? "").toLowerCase().includes(needle) ||
          (a.dsa_owner ?? "").toLowerCase().includes(needle) ||
          (a.sub_vertical ?? "").toLowerCase().includes(needle)
        );
      })
      // Genie-active first, then by pipeline, then name.
      .sort((a, b) => {
        const ag = (a.use_case_count ?? 0) > 0 ? 1 : 0;
        const bg = (b.use_case_count ?? 0) > 0 ? 1 : 0;
        if (ag !== bg) return bg - ag;
        if ((b.monthly_dbus ?? 0) !== (a.monthly_dbus ?? 0))
          return (b.monthly_dbus ?? 0) - (a.monthly_dbus ?? 0);
        return a.name.localeCompare(b.name);
      });
  }, [accounts, q, filter]);

  return (
    <div className="space-y-5">
      {/* Summary counters double as filters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatChip
          label="FINS accounts"
          value={String(stats.total)}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <StatChip
          label="Running Genie"
          value={String(stats.genie)}
          active={filter === "genie"}
          onClick={() => setFilter("genie")}
        />
        <StatChip
          label="Whitespace"
          value={String(stats.whitespace)}
          active={filter === "whitespace"}
          onClick={() => setFilter("whitespace")}
        />
        <StatChip
          label="PP AI Off"
          value={String(stats.ppOff)}
          tone={stats.ppOff > 0 ? "bad" : undefined}
          active={filter === "pp_off"}
          onClick={() => setFilter("pp_off")}
        />
        <StatChip label="Est. pipeline" value={`${fmtDbus(stats.pipeline)}/mo`} />
      </div>

      {/* When viewing PP-off, offer an enforce-disabled refinement */}
      {(filter === "pp_off" || filter === "pp_off_enforce_off") && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Refine:</span>
          <button
            type="button"
            onClick={() => setFilter("pp_off")}
            className={[
              "rounded-full border px-3 py-1 transition-colors",
              filter === "pp_off" ? "border-primary bg-accent" : "hover:bg-accent",
            ].join(" ")}
          >
            All PP off ({stats.ppOff})
          </button>
          <button
            type="button"
            onClick={() => setFilter("pp_off_enforce_off")}
            className={[
              "rounded-full border px-3 py-1 transition-colors",
              filter === "pp_off_enforce_off"
                ? "border-primary bg-accent"
                : "hover:bg-accent",
            ].join(" ")}
          >
            Enforce disabled ({stats.ppOffEnforceOff})
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by account, AE, SA, DSA, or sub-vertical…"
          className="pl-9 h-11"
        />
      </div>

      {/* Results */}
      <div className="text-xs text-muted-foreground">
        {results.length} account{results.length === 1 ? "" : "s"}
        {filter === "genie" && " running Genie"}
        {filter === "whitespace" && " with no Genie use case yet"}
        {filter === "pp_off" && " with Partner-Powered AI off (Genie blocked)"}
        {filter === "pp_off_enforce_off" &&
          " with PP off + enforce disabled (a workspace can still enable it)"}
      </div>
      <div className="grid gap-2">
        {results.slice(0, 100).map((a) => (
          <Link key={a.id} to="/accounts/$accountId" params={{ accountId: a.id }}>
            <Card className="hover:border-primary/50 transition-colors">
              <CardContent className="py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {a.sub_vertical || "—"}
                    {a.ae_owner && <> · AE {a.ae_owner}</>}
                  </div>
                </div>
                {a.pp_status === "off" && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-destructive/50 text-destructive"
                  >
                    <ShieldAlert className="h-3 w-3" />
                    PP Off
                  </Badge>
                )}
                {(a.open_issues ?? 0) > 0 && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-amber-600/50 text-amber-700 dark:text-amber-400"
                  >
                    <Bug className="h-3 w-3" />
                    {a.open_issues}
                  </Badge>
                )}
                {(a.open_blockers ?? 0) > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {a.open_blockers}
                  </Badge>
                )}
                {(a.use_case_count ?? 0) > 0 ? (
                  <>
                    {(a.monthly_dbus ?? 0) > 0 && (
                      <span className="text-xs text-emerald-700 dark:text-emerald-400 hidden sm:block">
                        {fmtDbus(a.monthly_dbus ?? 0)}/mo
                      </span>
                    )}
                    <Badge variant="secondary" className="gap-1">
                      <Layers className="h-3 w-3" />
                      {a.use_case_count}
                    </Badge>
                  </>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    whitespace
                  </Badge>
                )}
                <span
                  className="text-xs text-muted-foreground w-16 text-right hidden md:inline"
                  title="Account readiness"
                >
                  {a.readiness_pct ?? 0}% ready
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
        {results.length > 100 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Showing first 100 — refine your search to narrow down.
          </p>
        )}
        {results.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No accounts match “{q}”.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatChip({
  label,
  value,
  active,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  active?: boolean;
  tone?: "bad";
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={[
        "text-left rounded-lg border p-3 transition-colors",
        clickable ? "hover:bg-accent cursor-pointer" : "cursor-default",
        active ? "border-primary bg-accent" : "",
      ].join(" ")}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={[
          "text-xl font-bold mt-0.5",
          tone === "bad" ? "text-destructive" : "",
        ].join(" ")}
      >
        {value}
      </div>
    </button>
  );
}

function Fallback() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
