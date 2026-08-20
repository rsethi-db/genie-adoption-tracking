import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { useListFeedbackSuspense, submitFeedback, listFeedbackKey } from "@/lib/api";
import { selector } from "@/lib/selector";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Mail, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/feedback")({
  component: () => <FeedbackPage />,
});

const OWNERS: { name: string; email: string }[] = [
  { name: "Anindita Mahapatra", email: "anindita.mahapatra@databricks.com" },
  { name: "Richa Sethi", email: "richa.sethi@databricks.com" },
  { name: "Amee Vora", email: "amee.vora@databricks.com" },
];

const CATEGORIES: { key: string; label: string; cls: string }[] = [
  { key: "good", label: "👍 Good", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  { key: "bad", label: "👎 Bad", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  { key: "ugly", label: "🙈 Ugly", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  { key: "bug", label: "🐛 Bug", cls: "bg-muted text-foreground border-border" },
  { key: "data_gap", label: "📊 Data gap", cls: "bg-muted text-foreground border-border" },
  { key: "idea", label: "💡 Idea", cls: "bg-primary/10 text-primary border-primary/30" },
];

function FeedbackPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Feedback</h1>
        <p className="text-sm text-muted-foreground">
          Help shape the Navigator — tell us what's working and what isn't.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <ReachOut />
          <LeaveComment />
        </div>
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <RecentFeedback />
        </Suspense>
      </div>
    </AppShell>
  );
}

function ReachOut() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" /> Reach out
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Feedback on this Navigator — a data gap, a bug, or an idea? Slack / Email{" "}
          {OWNERS.map((o, i) => (
            <span key={o.email}>
              <span className="text-foreground font-medium">{o.name}</span>
              {i < OWNERS.length - 2 ? ", " : i === OWNERS.length - 2 ? ", and " : ""}
            </span>
          ))}
          .
        </p>
      </CardContent>
    </Card>
  );
}

function LeaveComment() {
  const qc = useQueryClient();
  const [category, setCategory] = useState("idea");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!message.trim()) {
      toast.error("Add a comment first");
      return;
    }
    setSaving(true);
    try {
      await submitFeedback({ category, message: message.trim() });
      toast.success("Thanks — feedback submitted");
      setMessage("");
      setCategory("idea");
      qc.invalidateQueries({ queryKey: listFeedbackKey() });
    } catch {
      toast.error("Could not submit feedback");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquarePlus className="h-4 w-4" /> Leave a comment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1.5">
            What kind of feedback?
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  category === c.key ? c.cls : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="The good, the bad, the ugly — areas to improve, missing data, confusing UI, a feature you wish existed…"
          className="min-h-[120px]"
        />
        <div className="flex justify-end">
          <Button onClick={submit} disabled={saving || !message.trim()}>
            {saving ? "Submitting…" : "Submit feedback"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const CAT_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.label]),
);

function RecentFeedback() {
  const { data } = useListFeedbackSuspense(selector());
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recent feedback</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No feedback yet — be the first to leave a comment.
          </p>
        ) : (
          <div className="space-y-3 max-h-[32rem] overflow-y-auto">
            {data.map((f) => (
              <div key={f.id} className="border-b last:border-0 pb-3 last:pb-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-0.5">
                  <span className="font-medium text-foreground">
                    {CAT_LABEL[f.category] ?? f.category}
                  </span>
                  <span>·</span>
                  <span>{f.submitted_by || "someone"}</span>
                  <span>·</span>
                  <span>
                    {new Date(f.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{f.message}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
