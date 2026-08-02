import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, ArrowRight, Loader2, Megaphone } from "lucide-react";

export const Route = createFileRoute("/accounts/")({
  component: () => <AccountsPage />,
});

interface AccountResult {
  id: string;
  name: string;
  sub_vertical?: string;
  ae_owner?: string;
  sa_owner?: string;
  dsa_owner?: string;
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

      {/* Leadership push */}
      <div className="mb-6 rounded-lg border border-primary/40 bg-primary/5 p-4 flex items-start gap-3 max-w-3xl">
        <Megaphone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div>
          <div className="text-sm font-semibold">
            Genie adoption push — action needed
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            As we drive Genie adoption across FINS this quarter, please make sure your
            accounts are moving through the Field Adoption Playbook. Take a few minutes
            to update each account's Adoption Workflow in the Navigator so we have an
            accurate read on where everyone is.
          </p>
          <p className="text-sm mt-2">
            <span className="font-medium">Action:</span> Choose an account below and
            review &amp; update its Adoption Workflow.
          </p>
        </div>
      </div>

      <AccountLookup />
    </AppShell>
  );
}

// Server-side search: nothing loads until you type, so the page opens instantly and
// only the matches (not all ~500 accounts) come over the wire. Queries are debounced.
function AccountLookup() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AccountResult[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const needle = q.trim();
    if (!needle) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const mine = ++seq.current;
    const t = setTimeout(() => {
      fetch(`/api/accounts?q=${encodeURIComponent(needle)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => {
          // Ignore out-of-order responses (only apply the latest query's result).
          if (mine === seq.current) {
            setResults(Array.isArray(d) ? d : []);
            setLoading(false);
          }
        })
        .catch(() => {
          if (mine === seq.current) {
            setResults([]);
            setLoading(false);
          }
        });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-5">
      <div className="relative max-w-2xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type an account name, AE, SA, or DSA…"
          className="pl-9 h-11"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {q.trim() === "" ? null : !loading && results.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1">
          No account matches “{q}”.
        </p>
      ) : (
        <div className="grid gap-2 max-w-2xl">
          {results.map((a) => (
            <Link key={a.id} to="/accounts/$accountId" params={{ accountId: a.id }}>
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
