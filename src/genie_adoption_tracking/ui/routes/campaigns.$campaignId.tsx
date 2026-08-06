import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Users,
  CalendarClock,
  MessageSquareText,
  BarChart3,
  Plus,
  Trash2,
  GripVertical,
  Copy,
  Rocket,
  Link as LinkIcon,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

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
  status: string;
  created_at: string;
  created_by?: string;
  account_count: number;
  question_count: number;
  response_count: number;
  accounts?: CampaignAccount[];
}
interface Question {
  id: string;
  position: number;
  prompt: string;
  qtype: string;
  options: string[];
  required: boolean;
}
interface ResponseRow {
  id: string;
  account_id: string;
  account_name: string;
  answers: Record<string, unknown>;
  submitted_by: string;
  submitted_at: string;
}

const QTYPES = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "single_choice", label: "Single choice" },
  { value: "multi_choice", label: "Multiple choice" },
  { value: "rating", label: "Rating (1–5)" },
];

export const Route = createFileRoute("/campaigns/$campaignId")({
  component: () => <CampaignDetailPage />,
});

// Format an ISO date/datetime (yyyy-mm-dd or yyyy-mm-ddTHH:MM:SS) as mm/dd/yyyy.
// Parses the date part as a plain string so there's no timezone day-shift.
function fmtDate(d?: string) {
  if (!d || !d.trim()) return "—";
  const m = d.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : d;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    closed: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}

function CampaignDetailPage() {
  const { campaignId } = Route.useParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch(`/api/campaigns/${campaignId}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setCampaign(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  return (
    <AppShell>
      <Link
        to="/campaigns"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> All campaigns
      </Link>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : error || !campaign ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            Campaign not found.
          </CardContent>
        </Card>
      ) : (
        <CampaignDetail campaign={campaign} onChange={load} />
      )}
    </AppShell>
  );
}

function CampaignDetail({
  campaign,
  onChange,
}: {
  campaign: Campaign;
  onChange: () => void;
}) {
  const range =
    campaign.start_date || campaign.end_date
      ? `${fmtDate(campaign.start_date)} → ${fmtDate(campaign.end_date)}`
      : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold">{campaign.title}</h1>
          <span
            className={
              "text-xs font-medium px-2 py-0.5 rounded-full capitalize " +
              statusBadge(campaign.status)
            }
          >
            {campaign.status}
          </span>
        </div>
        <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <span>Created {fmtDate(campaign.created_at)}</span>
          {range && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              {range}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {campaign.account_count} account(s)
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquareText className="h-3.5 w-3.5" />
            {campaign.question_count} question(s)
          </span>
          <span className="inline-flex items-center gap-1">
            <BarChart3 className="h-3.5 w-3.5" />
            {campaign.response_count} response(s)
          </span>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="questionnaire">Questionnaire</TabsTrigger>
          <TabsTrigger value="responses">Responses</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab campaign={campaign} onChange={onChange} />
        </TabsContent>
        <TabsContent value="questionnaire" className="mt-4">
          <QuestionnaireTab campaign={campaign} onChange={onChange} />
        </TabsContent>
        <TabsContent value="responses" className="mt-4">
          <ResponsesTab campaign={campaign} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --------------------------------------------------------------------------------------
// Overview: audience accounts + activation (link + copyable recipients / mailto)
// --------------------------------------------------------------------------------------

function OverviewTab({
  campaign,
  onChange,
}: {
  campaign: Campaign;
  onChange: () => void;
}) {
  const accounts = campaign.accounts ?? [];
  const [busy, setBusy] = useState(false);

  const formLink = campaign.form_token
    ? `${window.location.origin}/forms/${campaign.form_token}`
    : "";

  async function activate() {
    if (campaign.question_count === 0) {
      toast.error("Add at least one question before activating");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: campaign.start_date ?? "",
          end_date: campaign.end_date ?? "",
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Campaign activated");
      onChange();
    } catch {
      toast.error("Could not activate");
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    setBusy(true);
    try {
      await fetch(`/api/campaigns/${campaign.id}/close`, { method: "POST" });
      toast.success("Campaign closed");
      onChange();
    } finally {
      setBusy(false);
    }
  }

  function copyLink() {
    navigator.clipboard?.writeText(formLink);
    toast.success("Form link copied");
  }

  function copyRecipients() {
    const emails = accounts
      .flatMap((a) => a.owners)
      .filter(Boolean);
    navigator.clipboard?.writeText(emails.join(", "));
    toast.success(`${emails.length} owner name(s) copied`);
  }

  function mailtoDraft() {
    const subject = encodeURIComponent(`[Genie Campaign] ${campaign.title}`);
    const body = encodeURIComponent(
      `Hi team,\n\nPlease complete the campaign questionnaire for your account:\n${formLink}\n\n` +
        (campaign.end_date ? `Deadline: ${fmtDate(campaign.end_date)}\n\n` : "") +
        `Thanks!`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <div className="space-y-5">
      {campaign.audience_text && (
        <p className="text-sm text-muted-foreground max-w-3xl whitespace-pre-wrap">
          {campaign.audience_text}
        </p>
      )}

      {/* Activation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Rocket className="h-4 w-4" /> Activation &amp; delivery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {campaign.status === "draft" && (
            <p className="text-sm text-muted-foreground">
              Build the questionnaire, then activate to make the form live and get a
              shareable link for the account teams.
            </p>
          )}
          {campaign.status === "active" && formLink && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Shareable form link
              </label>
              <div className="flex items-center gap-2">
                <Input readOnly value={formLink} className="font-mono text-xs" />
                <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5 shrink-0">
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Databricks Apps can't send email server-side — share the link via your
                own client. Use the buttons below.
              </p>
            </div>
          )}
          {campaign.status === "closed" && (
            <p className="text-sm text-muted-foreground">
              This campaign is closed and no longer accepting responses.
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {campaign.status !== "active" ? (
              <Button onClick={activate} disabled={busy} className="gap-1.5">
                <Rocket className="h-4 w-4" />
                {campaign.status === "closed" ? "Re-activate" : "Activate campaign"}
              </Button>
            ) : (
              <>
                <a href={formLink} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="gap-1.5">
                    <LinkIcon className="h-4 w-4" /> Open form
                  </Button>
                </a>
                <Button variant="outline" onClick={mailtoDraft} className="gap-1.5">
                  <Mail className="h-4 w-4" /> Email draft
                </Button>
                <Button variant="outline" onClick={copyRecipients} className="gap-1.5">
                  <Copy className="h-4 w-4" /> Copy recipients
                </Button>
                <Button
                  variant="ghost"
                  onClick={close}
                  disabled={busy}
                  className="gap-1.5 text-muted-foreground ml-auto"
                >
                  Close campaign
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audience */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Audience accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No accounts were selected for this campaign.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2">Owners</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.account_id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <Link
                          to="/accounts/$accountId"
                          params={{ accountId: a.account_id }}
                          className="text-primary hover:underline"
                        >
                          {a.account_name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {a.owners.length > 0 ? a.owners.join(", ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --------------------------------------------------------------------------------------
// Questionnaire builder (g-form style). Account name is a fixed first field.
// --------------------------------------------------------------------------------------

let _tmpId = 0;
function newQuestion(): Question {
  _tmpId += 1;
  return {
    id: `tmp-${_tmpId}`,
    position: 0,
    prompt: "",
    qtype: "text",
    options: [],
    required: false,
  };
}

function QuestionnaireTab({
  campaign,
  onChange,
}: {
  campaign: Campaign;
  onChange: () => void;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/campaigns/${campaign.id}/questions`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setQuestions(Array.isArray(d) ? d : []))
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
  }, [campaign.id]);

  function update(idx: number, patch: Partial<Question>) {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }
  function add() {
    setQuestions((qs) => [...qs, newQuestion()]);
  }
  function remove(idx: number) {
    setQuestions((qs) => qs.filter((_, i) => i !== idx));
  }
  function move(idx: number, dir: -1 | 1) {
    setQuestions((qs) => {
      const next = [...qs];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return qs;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        questions: questions
          .filter((q) => q.prompt.trim())
          .map((q) => ({
            prompt: q.prompt,
            qtype: q.qtype,
            options: q.options,
            required: q.required,
          })),
      };
      const res = await fetch(`/api/campaigns/${campaign.id}/questions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setQuestions(Array.isArray(d) ? d : []);
      toast.success("Questionnaire saved");
      onChange();
    } catch {
      toast.error("Could not save questionnaire");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return <div className="text-sm text-muted-foreground">Loading questionnaire…</div>;

  return (
    <div className="space-y-3 max-w-2xl">
      {/* Fixed first field */}
      <Card className="border-primary/40">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary">1</Badge>
            <span className="font-medium">Account name</span>
            <Badge variant="outline" className="text-[10px]">
              Fixed · required
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Every form starts by asking which audience account it's for. Automatically
            added — respondents pick from this campaign's accounts.
          </p>
        </CardContent>
      </Card>

      {questions.map((q, idx) => (
        <Card key={q.id}>
          <CardContent className="py-3 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{idx + 2}</Badge>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => move(idx, -1)}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                disabled={idx === 0}
                aria-label="Move up"
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove question"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <Input
              value={q.prompt}
              onChange={(e) => update(idx, { prompt: e.target.value })}
              placeholder="Question prompt…"
            />
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={q.qtype}
                onChange={(e) => update(idx, { qtype: e.target.value })}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                {QTYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <label className="text-sm inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => update(idx, { required: e.target.checked })}
                />
                Required
              </label>
            </div>
            {(q.qtype === "single_choice" || q.qtype === "multi_choice") && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Options (one per line)
                </label>
                <Textarea
                  value={q.options.join("\n")}
                  onChange={(e) =>
                    update(idx, {
                      options: e.target.value.split("\n"),
                    })
                  }
                  placeholder={"Option A\nOption B"}
                  className="mt-1 min-h-[60px]"
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={add} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add question
        </Button>
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving ? "Saving…" : "Save questionnaire"}
        </Button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------------
// Responses + insights dashboard
// --------------------------------------------------------------------------------------

function ResponsesTab({ campaign }: { campaign: Campaign }) {
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/campaigns/${campaign.id}/responses`).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch(`/api/campaigns/${campaign.id}/questions`).then((r) =>
        r.ok ? r.json() : []
      ),
    ])
      .then(([rs, qs]) => {
        setResponses(Array.isArray(rs) ? rs : []);
        setQuestions(Array.isArray(qs) ? qs : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campaign.id]);

  if (loading)
    return <div className="text-sm text-muted-foreground">Loading responses…</div>;

  const rate =
    campaign.account_count > 0
      ? Math.round((responses.length / campaign.account_count) * 100)
      : 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Accounts targeted" value={campaign.account_count} />
        <StatTile label="Responses" value={responses.length} />
        <StatTile label="Response rate" value={`${rate}%`} />
      </div>

      {responses.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No responses yet.
            {campaign.status !== "active" &&
              " Activate the campaign so account teams can submit the form."}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="px-3 py-2">Account</th>
                    {questions.map((q) => (
                      <th key={q.id} className="px-3 py-2 max-w-[16rem]">
                        {q.prompt}
                      </th>
                    ))}
                    <th className="px-3 py-2">Submitted by</th>
                    <th className="px-3 py-2 whitespace-nowrap">When</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 align-top">
                      <td className="px-3 py-2 font-medium">{r.account_name || "—"}</td>
                      {questions.map((q) => (
                        <td key={q.id} className="px-3 py-2">
                          {fmtAnswer(r.answers[q.id])}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.submitted_by || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {fmtDate(r.submitted_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function fmtAnswer(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
