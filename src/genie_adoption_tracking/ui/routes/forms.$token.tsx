import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface FormAccount {
  account_id: string;
  account_name: string;
  owners: string[];
}
interface FormQuestion {
  id: string;
  position: number;
  prompt: string;
  qtype: string;
  options: string[];
  required: boolean;
}
interface CampaignForm {
  campaign_id: string;
  title: string;
  status: string;
  start_date?: string;
  end_date?: string;
  accounts: FormAccount[];
  questions: FormQuestion[];
}

export const Route = createFileRoute("/forms/$token")({
  component: () => <FormPage />,
});

// Format an ISO date (yyyy-mm-dd) as mm/dd/yyyy without timezone day-shift.
function fmtDate(d?: string) {
  if (!d || !d.trim()) return "";
  const m = d.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : d;
}

function FormPage() {
  const { token } = Route.useParams();
  const [form, setForm] = useState<CampaignForm | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/forms/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setForm(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : error || !form ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              This form was not found.
            </CardContent>
          </Card>
        ) : (
          <FormBody token={token} form={form} />
        )}
      </div>
    </div>
  );
}

function FormBody({ token, form }: { token: string; form: CampaignForm }) {
  const [accountId, setAccountId] = useState("");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const closed = form.status !== "active";

  function setAnswer(qid: string, value: unknown) {
    setAnswers((a) => ({ ...a, [qid]: value }));
  }

  function toggleMulti(qid: string, opt: string) {
    setAnswers((a) => {
      const cur = Array.isArray(a[qid]) ? (a[qid] as string[]) : [];
      return {
        ...a,
        [qid]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt],
      };
    });
  }

  async function submit() {
    if (!accountId) {
      toast.error("Select the account this is for");
      return;
    }
    for (const q of form.questions) {
      if (q.required) {
        const v = answers[q.id];
        const empty =
          v == null || v === "" || (Array.isArray(v) && v.length === 0);
        if (empty) {
          toast.error(`“${q.prompt}” is required`);
          return;
        }
      }
    }
    const acct = form.accounts.find((a) => a.account_id === accountId);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/forms/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          account_name: acct?.account_name ?? "",
          answers,
        }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      toast.error("Could not submit — the campaign may be closed");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
          <div className="text-lg font-semibold">Thanks — response recorded</div>
          <p className="text-sm text-muted-foreground">
            Your answers for this account have been submitted.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{form.title}</CardTitle>
        {form.end_date && (
          <p className="text-sm text-muted-foreground">
            Please respond by {fmtDate(form.end_date)}.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {closed && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
            This campaign is {form.status} and not accepting responses.
          </div>
        )}

        {/* Fixed first field: account name */}
        <div>
          <label className="text-sm font-medium">
            Account name <span className="text-destructive">*</span>
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            disabled={closed}
            className="mt-1 w-full h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">Select an account…</option>
            {form.accounts.map((a) => (
              <option key={a.account_id} value={a.account_id}>
                {a.account_name}
              </option>
            ))}
          </select>
        </div>

        {form.questions.map((q) => (
          <div key={q.id}>
            <label className="text-sm font-medium">
              {q.prompt}
              {q.required && <span className="text-destructive"> *</span>}
            </label>
            <div className="mt-1">
              {q.qtype === "text" && (
                <Input
                  disabled={closed}
                  value={(answers[q.id] as string) ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                />
              )}
              {q.qtype === "textarea" && (
                <Textarea
                  disabled={closed}
                  value={(answers[q.id] as string) ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                />
              )}
              {q.qtype === "rating" && (
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={closed}
                      onClick={() => setAnswer(q.id, n)}
                      className={
                        "h-9 w-9 rounded-md border text-sm " +
                        (answers[q.id] === n
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent")
                      }
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
              {q.qtype === "single_choice" && (
                <div className="space-y-1">
                  {q.options.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={q.id}
                        disabled={closed}
                        checked={answers[q.id] === opt}
                        onChange={() => setAnswer(q.id, opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}
              {q.qtype === "multi_choice" && (
                <div className="space-y-1">
                  {q.options.map((opt) => {
                    const cur = Array.isArray(answers[q.id])
                      ? (answers[q.id] as string[])
                      : [];
                    return (
                      <label key={opt} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          disabled={closed}
                          checked={cur.includes(opt)}
                          onChange={() => toggleMulti(q.id, opt)}
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        <Button onClick={submit} disabled={submitting || closed} className="w-full">
          {submitting ? "Submitting…" : "Submit response"}
        </Button>
      </CardContent>
    </Card>
  );
}
