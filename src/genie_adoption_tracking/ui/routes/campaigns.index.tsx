import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Megaphone,
  Plus,
  CalendarClock,
  Trash2,
  Link as LinkIcon,
  Search,
  Loader2,
  Sparkles,
  Code2,
  Play,
} from "lucide-react";
import { toast } from "sonner";

// Campaigns talk to the backend directly via fetch (same pattern as the Genie chat)
// so the page is self-contained and doesn't depend on OpenAPI client regeneration.

interface CampaignAccount {
  account_id: string;
  account_name: string;
  owners: string[];
}
interface Campaign {
  id: string;
  title: string;
  start_date?: string;
  end_date?: string;
  audience_text?: string;
  form_url?: string;
  form_token?: string;
  status?: string;
  created_at: string;
  created_by?: string;
  account_count: number;
  accounts?: CampaignAccount[];
}
interface AccountResult {
  id: string;
  name: string;
  sub_vertical?: string;
  ae_owner?: string;
  sa_owner?: string;
  dsa_owner?: string;
  arr?: number;
  pp_status?: string;
  genie_spend_90d?: number;
}
interface AudienceAccount {
  account_id: string;
  account_name: string;
  ae_owner: string;
  sa_owner: string;
  dsa_owner: string;
  ae_email: string;
  sa_email: string;
  dsa_email: string;
  arr: number;
  pp_status: string;
  genie_spend_90d: number;
}

export const Route = createFileRoute("/campaigns/")({
  component: () => <CampaignsPage />,
});

function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((d) => setCampaigns(Array.isArray(d) ? d : []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <AppShell>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6" /> Campaigns
          </h1>
          <p className="text-sm text-muted-foreground">
            Time-boxed outreach to a chosen set of accounts, with a Form of
            questions to ask that audience.
          </p>
        </div>
        {!showForm && (
          <Button className="gap-2" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> New campaign
          </Button>
        )}
      </div>

      {showForm && (
        <div className="mb-6">
          <NewCampaignForm
            onCreated={() => {
              setShowForm(false);
              load();
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading campaigns…</div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-2.5">Campaign</th>
                  <th className="px-4 py-2.5">Launched</th>
                  <th className="px-4 py-2.5">Window</th>
                  <th className="px-4 py-2.5">Form</th>
                  <th className="px-4 py-2.5 w-0"></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      No campaigns yet. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  campaigns.map((c) => (
                    <CampaignRow key={c.id} campaign={c} onChange={load} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppShell>
  );
}

// Format an ISO date/datetime (yyyy-mm-dd or yyyy-mm-ddTHH:MM:SS) as mm/dd/yyyy.
// Parses the date part as a plain string so there's no timezone day-shift.
function fmtDate(d?: string) {
  if (!d || !d.trim()) return "—";
  const m = d.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : d;
}

// Convert a user-entered mm/dd/yyyy string to ISO yyyy-mm-dd for storage.
// Returns "" for blank, or null if it isn't a valid mm/dd/yyyy calendar date.
function toISO(s: string): string | null {
  const t = s.trim();
  if (!t) return "";
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = +m[1];
  const dd = +m[2];
  const yyyy = +m[3];
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const iso = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  // Reject impossible dates (e.g. 02/30) by round-tripping through Date (UTC).
  const dt = new Date(`${iso}T00:00:00Z`);
  if (dt.getUTCMonth() + 1 !== mm || dt.getUTCDate() !== dd) return null;
  return iso;
}

// A mm/dd/yyyy text field with a calendar icon that opens the browser's native
// date picker. Typing stays free-form (validated on submit via toISO); picking
// from the calendar writes the value back as mm/dd/yyyy.
function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const nativeRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const el = nativeRef.current;
    if (!el) return;
    // showPicker() is the reliable way to pop the native calendar on demand.
    if (typeof el.showPicker === "function") el.showPicker();
    else el.click();
  }

  return (
    <div className="relative mt-1">
      <Input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="mm/dd/yyyy"
        className="pr-9"
      />
      <button
        type="button"
        onClick={openPicker}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label="Open calendar"
      >
        <CalendarClock className="h-4 w-4" />
      </button>
      {/* Hidden native picker; its ISO value is mirrored to/from mm/dd/yyyy text. */}
      <input
        ref={nativeRef}
        type="date"
        value={toISO(value) || ""}
        onChange={(e) => {
          const iso = e.target.value; // yyyy-mm-dd
          const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          onChange(m ? `${m[2]}/${m[3]}/${m[1]}` : "");
        }}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

function CampaignRow({
  campaign,
  onChange,
}: {
  campaign: Campaign;
  onChange: () => void;
}) {
  async function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete campaign “${campaign.title}”?`)) return;
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Campaign deleted");
      onChange();
    } else {
      toast.error("Could not delete campaign");
    }
  }

  const range =
    campaign.start_date || campaign.end_date
      ? `${fmtDate(campaign.start_date)} → ${fmtDate(campaign.end_date)}`
      : "—";

  return (
    <tr className="border-b last:border-0 hover:bg-accent/50">
      <td className="px-4 py-2.5">
        <Link
          to="/campaigns/$campaignId"
          params={{ campaignId: campaign.id }}
          className="font-medium text-primary hover:underline"
        >
          {campaign.title}
        </Link>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
        {fmtDate(campaign.created_at)}
      </td>
      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3 w-3" />
          {range}
        </span>
      </td>
      <td className="px-4 py-2.5">
        {campaign.form_token ? (
          <a
            href={`/forms/${campaign.form_token}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-primary hover:underline"
            title="Responder form link — share this with the account team"
          >
            <LinkIcon className="h-3 w-3" />
            Open form
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={remove}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </td>
    </tr>
  );
}

function fmtArr(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function NewCampaignForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formUrl, setFormUrl] = useState("");

  // Natural-language audience builder state.
  const [nlText, setNlText] = useState("");
  const [interpreted, setInterpreted] = useState("");
  const [querying, setQuerying] = useState(false);
  // The equivalent SQL for the last NL parse — editable, so the user can tweak it and
  // re-run to override the parse.
  const [sql, setSql] = useState("");
  const [showSql, setShowSql] = useState(false);
  const [runningSql, setRunningSql] = useState(false);
  // The reviewed audience — keyed by account_id so deselect + manual-add merge cleanly.
  const [audience, setAudience] = useState<AudienceAccount[]>([]);
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  async function runQuery() {
    // Ignore overlapping clicks — one in-flight resolve at a time.
    if (querying) return;
    if (!nlText.trim()) {
      toast.error("Describe the audience first");
      return;
    }
    setQuerying(true);
    // Client-side timeout so the spinner can never hang forever if the backend
    // (or the LLM behind it) stalls. Aborts the request after 20s.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch("/api/campaigns/audience/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nlText }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setInterpreted(d.interpreted ?? "");
      setSql(d.sql ?? "");
      // Merge results into the audience, keeping any manually-added accounts.
      const byId = new Map(audience.map((a) => [a.account_id, a]));
      for (const a of (d.accounts ?? []) as AudienceAccount[]) {
        byId.set(a.account_id, a);
      }
      setAudience(Array.from(byId.values()));
      setDropped(new Set());
      if ((d.accounts ?? []).length === 0) {
        toast.message("No accounts matched", { description: d.interpreted });
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        toast.error("Timed out resolving the audience — please try again");
      } else {
        toast.error("Could not resolve audience");
      }
    } finally {
      clearTimeout(timer);
      setQuerying(false);
    }
  }

  // Run the (possibly hand-edited) SQL, replacing the resolved audience with its rows.
  // Unlike runQuery this overrides rather than merges — the SQL is the source of truth.
  async function runSql() {
    if (runningSql) return;
    if (!sql.trim()) {
      toast.error("Enter a SQL query");
      return;
    }
    setRunningSql(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch("/api/campaigns/audience/run-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      if (d.error) {
        toast.error("SQL error", { description: d.error });
        return;
      }
      const rows = (d.accounts ?? []) as AudienceAccount[];
      setAudience(rows);
      setDropped(new Set());
      setInterpreted("Custom SQL");
      if (rows.length === 0) {
        toast.message("No accounts matched the SQL");
      } else {
        toast.success(`${rows.length} account(s) from SQL`);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        toast.error("Timed out running the SQL — please try again");
      } else {
        toast.error("Could not run the SQL");
      }
    } finally {
      clearTimeout(timer);
      setRunningSql(false);
    }
  }

  function toggleDrop(id: string) {
    setDropped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addManual(a: AudienceAccount) {
    setAudience((prev) =>
      prev.some((x) => x.account_id === a.account_id) ? prev : [...prev, a]
    );
    setDropped((prev) => {
      const next = new Set(prev);
      next.delete(a.account_id);
      return next;
    });
  }

  const selected = audience.filter((a) => !dropped.has(a.account_id));

  async function create() {
    if (!title.trim()) {
      toast.error("Add a title");
      return;
    }
    // Dates are entered as mm/dd/yyyy; store ISO yyyy-mm-dd for the backend.
    const startISO = toISO(startDate);
    const endISO = toISO(endDate);
    if (startDate.trim() && startISO === null) {
      toast.error("Start date must be mm/dd/yyyy");
      return;
    }
    if (endDate.trim() && endISO === null) {
      toast.error("End date must be mm/dd/yyyy");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          start_date: startISO ?? "",
          end_date: endISO ?? "",
          audience_text: nlText,
          account_ids: selected.map((a) => a.account_id),
          form_url: formUrl,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Campaign created");
      onCreated();
    } catch {
      toast.error("Could not create campaign");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="h-4 w-4" /> New campaign
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Genie readiness outreach"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Start date
              </label>
              <DateField value={startDate} onChange={setStartDate} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                End date
              </label>
              <DateField value={endDate} onChange={setEndDate} />
            </div>
          </div>

          {/* Natural-language audience builder */}
          <div className="rounded-lg border p-3 space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" /> Build audience
            </label>
            <p className="text-xs text-muted-foreground">
              Describe the accounts in plain English — e.g. “all FINS accounts where
              ARR &gt; $250K, partner powered enabled and genie usage &lt; $200”.
            </p>
            <Textarea
              value={nlText}
              onChange={(e) => setNlText(e.target.value)}
              onKeyDown={(e) => {
                // Enter runs the query; Shift+Enter inserts a newline.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  runQuery();
                }
              }}
              placeholder="e.g. banking accounts where genie usage is less than 200 dollars per month  (Enter to search, Shift+Enter for a new line)"
              className="min-h-[60px]"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {interpreted && `Interpreted: ${interpreted}`}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={runQuery}
                disabled={querying}
                className="gap-1.5 shrink-0"
              >
                {querying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                {querying ? "Resolving…" : "Find accounts"}
              </Button>
            </div>

            {/* Editable SQL — the equivalent query for the parse, which the user can
                tweak and re-run to override it. Read-only SELECT over gat_account. */}
            {sql && (
              <div className="rounded-md border">
                <button
                  type="button"
                  onClick={() => setShowSql((s) => !s)}
                  className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <Code2 className="h-3.5 w-3.5" />
                  {showSql ? "Hide SQL" : "Edit SQL"}
                  <span className="ml-auto text-[10px] uppercase tracking-wide opacity-60">
                    override
                  </span>
                </button>
                {showSql && (
                  <div className="border-t p-2.5 space-y-2">
                    <Textarea
                      value={sql}
                      onChange={(e) => setSql(e.target.value)}
                      spellCheck={false}
                      className="min-h-[120px] font-mono text-xs leading-relaxed"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        Read-only SELECT over <code>gat_account</code>. Editing overrides
                        the parsed audience.
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={runSql}
                        disabled={runningSql}
                        className="gap-1.5 shrink-0"
                      >
                        {runningSql ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        {runningSql ? "Running…" : "Run SQL"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {audience.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-2 py-1.5 w-0"></th>
                      <th className="px-2 py-1.5">account_id</th>
                      <th className="px-2 py-1.5">AE email</th>
                      <th className="px-2 py-1.5">SA email</th>
                      <th className="px-2 py-1.5">DSA email</th>
                      <th className="px-2 py-1.5 text-right">ARR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audience.map((a) => {
                      const off = dropped.has(a.account_id);
                      return (
                        <tr
                          key={a.account_id}
                          className={
                            "border-b last:border-0 " + (off ? "opacity-40" : "")
                          }
                        >
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={!off}
                              onChange={() => toggleDrop(a.account_id)}
                              aria-label={`Include ${a.account_name}`}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <span className="font-medium">{a.account_name}</span>
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {a.ae_email || "—"}
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {a.sa_email || "—"}
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {a.dsa_email || "—"}
                          </td>
                          <td className="px-2 py-1.5 text-right whitespace-nowrap">
                            {fmtArr(a.arr)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <ManualAdd
              onAdd={addManual}
              existingIds={new Set(audience.map((a) => a.account_id))}
            />
            <p className="text-xs text-muted-foreground">
              {selected.length} account(s) will be the campaign audience.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Link to Form (questions)
            </label>
            <Input
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://forms.gle/…"
              className="mt-1"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={create} disabled={saving} className="gap-2">
              {saving ? "Creating…" : "Create campaign"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Manually add an account not caught by the NL filter — debounced search over
// /api/accounts. Adds as an AudienceAccount (emails derived client-side to match
// the table columns; the backend re-derives on read anyway).
function ManualAdd({
  onAdd,
  existingIds,
}: {
  onAdd: (a: AudienceAccount) => void;
  existingIds: Set<string>;
}) {
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

  function pick(a: AccountResult) {
    onAdd({
      account_id: a.id,
      account_name: a.name,
      ae_owner: a.ae_owner ?? "",
      sa_owner: a.sa_owner ?? "",
      dsa_owner: a.dsa_owner ?? "",
      ae_email: deriveEmail(a.ae_owner ?? ""),
      sa_email: deriveEmail(a.sa_owner ?? ""),
      dsa_email: deriveEmail(a.dsa_owner ?? ""),
      arr: a.arr ?? 0,
      pp_status: a.pp_status ?? "unknown",
      genie_spend_90d: a.genie_spend_90d ?? 0,
    });
    setQ("");
    setResults([]);
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Manually add an account…"
          className="pl-9 h-8 text-sm"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {results.length > 0 && (
        <div className="max-h-32 overflow-y-auto rounded-md border divide-y">
          {results.map((a) => {
            const already = existingIds.has(a.id);
            return (
              <button
                key={a.id}
                type="button"
                disabled={already}
                onClick={() => pick(a)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-2"
              >
                <span className="truncate">{a.name}</span>
                {already && (
                  <span className="text-xs text-muted-foreground shrink-0">Added</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Mirror of the backend's email derivation, for manually-added accounts.
function deriveEmail(name: string): string {
  const n = name.trim().toLowerCase().replace(/[^a-z\s-]/g, "");
  const parts = n.split(/\s+/).filter(Boolean);
  return parts.length ? `${parts.join(".")}@databricks.com` : "";
}
