import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, useMemo, useState } from "react";
import { useListAccountsSuspense } from "@/lib/api";
import { selector } from "@/lib/selector";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, ArrowRight } from "lucide-react";

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
          Look up a FINS account to pull up its Genie adoption workflow.
        </p>
      </div>
      <Suspense fallback={<Fallback />}>
        <AccountLookup />
      </Suspense>
    </AppShell>
  );
}

// Metrics up top, then a search box. Nothing is listed until you search; picking a
// match pulls up that account's detail page.
function AccountLookup() {
  const { data: accounts } = useListAccountsSuspense(selector());
  const [q, setQ] = useState("");

  const stats = useMemo(() => {
    const genie = accounts.filter((a) => (a.use_case_count ?? 0) > 0).length;
    const ppOff = accounts.filter((a) => a.pp_status === "off").length;
    const pipeline = accounts.reduce((s, a) => s + (a.monthly_dbus ?? 0), 0);
    return {
      total: accounts.length,
      genie,
      whitespace: accounts.length - genie,
      ppOff,
      pipeline,
    };
  }, [accounts]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return accounts
      .filter(
        (a) =>
          a.name.toLowerCase().includes(needle) ||
          (a.ae_owner ?? "").toLowerCase().includes(needle) ||
          (a.sa_owner ?? "").toLowerCase().includes(needle) ||
          (a.dsa_owner ?? "").toLowerCase().includes(needle) ||
          (a.sub_vertical ?? "").toLowerCase().includes(needle)
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 25);
  }, [accounts, q]);

  return (
    <div className="space-y-5">
      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatChip label="FINS accounts" value={String(stats.total)} />
        <StatChip label="Running Genie" value={String(stats.genie)} />
        <StatChip label="Whitespace" value={String(stats.whitespace)} />
        <StatChip
          label="PP AI Off"
          value={String(stats.ppOff)}
          tone={stats.ppOff > 0 ? "bad" : undefined}
        />
        <StatChip label="Est. pipeline" value={`${fmtDbus(stats.pipeline)}/mo`} />
      </div>

      {/* Search box */}
      <div className="relative max-w-2xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type an account name, AE, SA, DSA, or sub-vertical…"
          className="pl-9 h-11"
        />
      </div>

      {/* Results (only when searching) */}
      {q.trim() === "" ? (
        <p className="text-sm text-muted-foreground px-1">
          Start typing to look up an account.
        </p>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1">
          No account matches “{q}”.
        </p>
      ) : (
        <div className="grid gap-2 max-w-2xl">
          {results.map((a) => (
            <Link
              key={a.id}
              to="/accounts/$accountId"
              params={{ accountId: a.id }}
            >
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{a.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {a.sub_vertical || "—"}
                      {a.ae_owner && <> · AE {a.ae_owner}</>}
                      {a.sa_owner && <> · SA {a.sa_owner}</>}
                      {a.dsa_owner && <> · DSA {a.dsa_owner}</>}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "bad";
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={[
          "text-xl font-bold mt-0.5",
          tone === "bad" ? "text-destructive" : "",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function Fallback() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
      <Skeleton className="h-11 w-full max-w-2xl" />
    </div>
  );
}
