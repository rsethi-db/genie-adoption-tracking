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
      {/* Aggregate metrics live on the Signals page; Accounts is a lookup surface. */}
      {/* Search box */}
      <div className="relative max-w-2xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type an account name, AE, SA, or DSA…"
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

function Fallback() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-11 w-full max-w-2xl" />
    </div>
  );
}
