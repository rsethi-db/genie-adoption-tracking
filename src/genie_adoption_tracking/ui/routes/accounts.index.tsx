import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, ArrowRight, Loader2, X } from "lucide-react";

interface AccountsSearch {
  tier?: string;
  pp?: string;
  provisioning?: string;
  stage?: string;
  whitespace?: boolean;
  open_issues?: boolean;
}

export const Route = createFileRoute("/accounts/")({
  validateSearch: (s: Record<string, unknown>): AccountsSearch => ({
    tier: typeof s.tier === "string" ? s.tier : undefined,
    pp: typeof s.pp === "string" ? s.pp : undefined,
    provisioning: typeof s.provisioning === "string" ? s.provisioning : undefined,
    stage: typeof s.stage === "string" ? s.stage : undefined,
    whitespace: s.whitespace === true || s.whitespace === "true" || undefined,
    open_issues: s.open_issues === true || s.open_issues === "true" || undefined,
  }),
  component: () => <AccountsPage />,
});

interface AccountResult {
  id: string;
  name: string;
  sub_vertical?: string;
  vertical?: string;
  ae_owner?: string;
  sa_owner?: string;
  dsa_owner?: string;
}

// AMER verticals (sales_subregion_level_1) across both AMER business units —
// AMER Industries (FINS/MFG/PS/HLS) + AMER Enterprise & Emerging (EE & Startup/LATAM/
// CAN/DNB/CMEG/RCT). "All" clears the filter.
const VERTICALS = [
  "All",
  "FINS",
  "MFG",
  "PS",
  "HLS",
  "EE & Startup",
  "LATAM",
  "CAN",
  "DNB",
  "CMEG",
  "RCT",
] as const;

// Human label for an active drill-down filter (from Signals).
function filterLabel(s: AccountsSearch): string | null {
  if (s.tier) return `Genie-Ready tier: ${s.tier}`;
  if (s.pp === "off") return "Partner-Powered AI off";
  if (s.pp === "on") return "Partner-Powered AI on";
  if (s.provisioning) return `User provisioning: ${s.provisioning}`;
  if (s.stage) return `Use case at stage ${s.stage.toUpperCase()}`;
  if (s.whitespace) return "Whitespace (no Genie use cases)";
  if (s.open_issues) return "Open Genie issues";
  return null;
}

function AccountsPage() {
  const search = Route.useSearch();
  const label = filterLabel(search);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Accounts</h1>
      </div>

      {label ? (
        <FilteredList search={search} label={label} />
      ) : (
        <AccountLookup />
      )}
    </AppShell>
  );
}

function AccountRow({ a }: { a: AccountResult }) {
  return (
    <Link to="/accounts/$accountId" params={{ accountId: a.id }}>
      <Card className="hover:border-primary/50 transition-colors">
        <CardContent className="py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">
              {a.name}
              {a.vertical && (
                <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground align-middle">
                  {a.vertical}
                </span>
              )}
            </div>
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
  );
}

// Arrived from a Signals drill-down: show the whole matching segment.
function FilteredList({ search, label }: { search: AccountsSearch; label: string }) {
  const [results, setResults] = useState<AccountResult[] | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.tier) params.set("tier", search.tier);
    if (search.pp) params.set("pp", search.pp);
    if (search.provisioning) params.set("provisioning", search.provisioning);
    if (search.stage) params.set("stage", search.stage);
    if (search.whitespace) params.set("whitespace", "true");
    if (search.open_issues) params.set("open_issues", "true");
    fetch(`/api/accounts?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setResults(Array.isArray(d) ? d : []))
      .catch(() => setResults([]));
  }, [search]);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium">Filtered:</span>
        <span className="inline-flex items-center gap-1 rounded-full border bg-accent px-2.5 py-0.5 text-sm">
          {label}
          {results !== null && (
            <span className="text-muted-foreground">· {results.length}</span>
          )}
        </span>
        <Link
          to="/accounts"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </Link>
      </div>
      {results === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground">No accounts match this filter.</p>
      ) : (
        <div className="grid gap-2">
          {results.map((a) => (
            <AccountRow key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}

// Shows all accounts, filterable by AMER Industries vertical and by a text search.
// The full set is fetched once per vertical (server returns every match); the text
// box narrows it client-side so typing stays instant.
function AccountLookup() {
  const [q, setQ] = useState("");
  const [vertical, setVertical] = useState<string>("All");
  const [all, setAll] = useState<AccountResult[]>([]);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  // (Re)fetch the full account set whenever the vertical filter changes.
  useEffect(() => {
    setLoading(true);
    const mine = ++seq.current;
    const params = new URLSearchParams({ all: "true" });
    if (vertical !== "All") params.set("vertical", vertical);
    fetch(`/api/accounts?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (mine === seq.current) {
          setAll(Array.isArray(d) ? d : []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mine === seq.current) {
          setAll([]);
          setLoading(false);
        }
      });
  }, [vertical]);

  const needle = q.trim().toLowerCase();
  const results = needle
    ? all.filter(
        (a) =>
          a.name.toLowerCase().includes(needle) ||
          (a.ae_owner || "").toLowerCase().includes(needle) ||
          (a.sa_owner || "").toLowerCase().includes(needle) ||
          (a.dsa_owner || "").toLowerCase().includes(needle) ||
          (a.sub_vertical || "").toLowerCase().includes(needle),
      )
    : all;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap max-w-3xl">
        <div className="relative flex-1 min-w-[16rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by account name, AE, SA, or DSA…"
            className="pl-9 h-11"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-wrap gap-1 rounded-md border p-0.5">
          {VERTICALS.map((v) => (
            <button
              key={v}
              onClick={() => setVertical(v)}
              className={
                "px-3 h-9 rounded text-sm font-medium transition-colors whitespace-nowrap " +
                (vertical === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="text-sm text-muted-foreground px-1">
        {loading
          ? "Loading accounts…"
          : `${results.length.toLocaleString()} account${results.length === 1 ? "" : "s"}` +
            (vertical !== "All" ? ` in ${vertical}` : "")}
      </div>

      {!loading && results.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1">
          {needle ? `No account matches “${q}”.` : "No accounts."}
        </p>
      ) : (
        <div className="max-w-2xl max-h-[calc(100vh-16rem)] overflow-y-auto rounded-md border p-2">
          <div className="grid gap-2">
            {results.map((a) => (
              <AccountRow key={a.id} a={a} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
