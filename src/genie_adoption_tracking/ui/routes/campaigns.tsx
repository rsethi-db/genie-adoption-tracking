import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone,
  Send,
  Mail,
  MessageSquare,
  Users,
  CalendarClock,
  Archive,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Campaigns talk to the backend directly via fetch (same pattern as the Genie chat)
// so the page is self-contained and doesn't depend on OpenAPI client regeneration.

interface Segment {
  key: string;
  label: string;
  description: string;
  tpl_title?: string;
  tpl_ask?: string;
  tpl_cta?: string;
}
interface Target {
  account_id: string;
  account_name: string;
  owners: string[];
}
interface Campaign {
  id: string;
  title: string;
  ask: string;
  cta: string;
  segment: string;
  segment_label: string;
  sub_vertical?: string;
  deadline?: string;
  priority: string;
  active: boolean;
  created_at: string;
  created_by?: string;
  target_count: number;
  targets?: Target[];
  mailto_url?: string;
  slack_text?: string;
}

export const Route = createFileRoute("/campaigns")({
  component: () => <CampaignsPage />,
});

function CampaignsPage() {
  return (
    <AppShell>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6" /> Campaigns
          </h1>
          <p className="text-sm text-muted-foreground">
            Send a targeted ask to account teams — a clear call to action and
            deadline, aimed at a segment of accounts.
          </p>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Composer />
        <Feed />
      </div>
    </AppShell>
  );
}

function Composer() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [title, setTitle] = useState("");
  const [ask, setAsk] = useState("");
  const [cta, setCta] = useState("");
  const [segment, setSegment] = useState("all");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState("normal");
  const [count, setCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  // Track whether the user has hand-edited a field, so switching segments only
  // re-fills untouched fields (never clobbers their edits).
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/campaigns/segments")
      .then((r) => r.json())
      .then((segs: Segment[]) => {
        setSegments(segs);
        // Seed the form from the initial segment's template.
        const s = segs.find((x) => x.key === segment);
        if (s) {
          setTitle(s.tpl_title ?? "");
          setAsk(s.tpl_ask ?? "");
          setCta(s.tpl_cta ?? "");
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the segment changes, pre-fill title/ask/cta from its template — but only
  // fields the user hasn't manually edited.
  function applyTemplate(segKey: string) {
    const s = segments.find((x) => x.key === segKey);
    if (!s) return;
    if (!touched.title) setTitle(s.tpl_title ?? "");
    if (!touched.ask) setAsk(s.tpl_ask ?? "");
    if (!touched.cta) setCta(s.tpl_cta ?? "");
  }

  // Live target count as the segment changes.
  useEffect(() => {
    const q = new URLSearchParams({ segment });
    fetch(`/api/campaigns/preview?${q}`)
      .then((r) => r.json())
      .then((d) => setCount(d.target_count))
      .catch(() => setCount(null));
  }, [segment]);

  async function create() {
    if (!title.trim() || !ask.trim()) {
      toast.error("Add a title and the ask");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          ask,
          cta,
          segment,
          deadline,
          priority,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Campaign created");
      // Reset to the current segment's template for the next one.
      setTouched({});
      const s = segments.find((x) => x.key === segment);
      setTitle(s?.tpl_title ?? "");
      setAsk(s?.tpl_ask ?? "");
      setCta(s?.tpl_cta ?? "");
      setDeadline("");
      setPriority("normal");
      window.dispatchEvent(new CustomEvent("campaigns-changed"));
    } catch {
      toast.error("Could not create campaign");
    } finally {
      setSaving(false);
    }
  }

  const activeSeg = segments.find((s) => s.key === segment);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">New campaign</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Title</label>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTouched((t) => ({ ...t, title: true }));
            }}
            placeholder="e.g. Turn on Partner-Powered AI before EOQ"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            The ask / context
          </label>
          <Textarea
            value={ask}
            onChange={(e) => {
              setAsk(e.target.value);
              setTouched((t) => ({ ...t, ask: true }));
            }}
            placeholder="What's the situation and why it matters…"
            className="mt-1 min-h-[80px]"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Call to action
          </label>
          <Input
            value={cta}
            onChange={(e) => {
              setCta(e.target.value);
              setTouched((t) => ({ ...t, cta: true }));
            }}
            placeholder="e.g. Enable PP AI + confirm in the account console"
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Deadline
            </label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1 w-full h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Target segment
          </label>
          <select
            value={segment}
            onChange={(e) => {
              setSegment(e.target.value);
              applyTemplate(e.target.value);
            }}
            className="mt-1 w-full h-9 rounded-md border bg-background px-2 text-sm"
          >
            {segments.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          {activeSeg && (
            <p className="text-xs text-muted-foreground mt-1">
              {activeSeg.description}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {count === null ? "…" : `${count} account team(s) targeted`}
          </span>
          <Button onClick={create} disabled={saving} className="gap-2">
            <Send className="h-4 w-4" />
            {saving ? "Creating…" : "Create campaign"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Feed() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((d) => setCampaigns(Array.isArray(d) ? d : []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("campaigns-changed", h);
    return () => window.removeEventListener("campaigns-changed", h);
  }, []);

  if (loading)
    return <div className="text-sm text-muted-foreground">Loading campaigns…</div>;
  if (campaigns.length === 0)
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          No campaigns yet. Compose one on the left to reach account teams.
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-3">
      {campaigns.map((c) => (
        <CampaignCard key={c.id} campaign={c} onChange={load} />
      ))}
    </div>
  );
}

function CampaignCard({
  campaign,
  onChange,
}: {
  campaign: Campaign;
  onChange: () => void;
}) {
  const [detail, setDetail] = useState<Campaign | null>(null);
  const [open, setOpen] = useState(false);

  async function expand() {
    if (!open && !detail) {
      const res = await fetch(`/api/campaigns/${campaign.id}`);
      if (res.ok) setDetail(await res.json());
    }
    setOpen((o) => !o);
  }

  async function archive() {
    await fetch(`/api/campaigns/${campaign.id}/archive`, { method: "POST" });
    toast.success("Campaign archived");
    onChange();
  }

  const d = detail ?? campaign;

  return (
    <Card className={cn(!campaign.active && "opacity-60")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm flex items-center gap-2">
            {campaign.priority === "high" && (
              <Badge variant="destructive" className="text-xs">
                High
              </Badge>
            )}
            {campaign.title}
          </CardTitle>
          {!campaign.active && (
            <Badge variant="outline" className="text-xs">
              Archived
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {campaign.segment_label} · {campaign.target_count} team(s)
          </span>
          {campaign.deadline && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              Due {campaign.deadline}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm whitespace-pre-wrap">{campaign.ask}</p>
        {campaign.cta && (
          <p className="text-sm">
            <span className="font-medium">Action: </span>
            {campaign.cta}
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {d.mailto_url && (
            <a href={d.mailto_url}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email draft
              </Button>
            </a>
          )}
          {d.slack_text && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                navigator.clipboard?.writeText(d.slack_text ?? "");
                toast.success("Slack message copied");
              }}
            >
              <MessageSquare className="h-3.5 w-3.5" /> Copy for Slack
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={expand}>
            {open ? "Hide" : "Show"} targets
          </Button>
          {campaign.active && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground ml-auto"
              onClick={archive}
            >
              <Archive className="h-3.5 w-3.5" /> Archive
            </Button>
          )}
        </div>
        {open && detail && (
          <div className="mt-2 border-t pt-2 max-h-56 overflow-y-auto">
            {detail.targets && detail.targets.length > 0 ? (
              <ul className="space-y-1 text-xs">
                {detail.targets.map((t) => (
                  <li key={t.account_id} className="flex justify-between gap-2">
                    <span className="font-medium truncate">{t.account_name}</span>
                    <span className="text-muted-foreground truncate">
                      {t.owners.join(", ") || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                No accounts currently match this segment.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
