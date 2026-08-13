import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { useGetPlaybookSuspense, logResourceClick } from "@/lib/api";
import { selector } from "@/lib/selector";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ExternalLink,
  Sparkles,
  PlayCircle,
  Rocket,
  GraduationCap,
  BarChart3,
  BookOpen,
  MessageSquare,
  Users,
  LifeBuoy,
  Calculator,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { openGenieChat } from "@/components/genie-chat";

export const Route = createFileRoute("/playbook")({
  component: () => <PlaybookPage />,
});

function PlaybookPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Getting Help</h1>
        <p className="text-sm text-muted-foreground">
          Ask Genie, browse the resources, or find who to contact.
        </p>
      </div>

      {/* Ask Genie is the primary "how do I…" surface — the chat reads this playbook
          plus the docs and answers tailored to the account you're on. */}
      <div className="mb-8 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 ring-1 ring-primary/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <div className="text-base font-semibold">Ask Genie</div>
            <div className="text-sm text-muted-foreground max-w-xl">
              What demo to show, how to handle an objection, hackathon prereqs — ask in
              plain English. Genie reads this playbook and answers for the account
              you're on.
            </div>
          </div>
        </div>
        <Button size="lg" className="gap-2 shrink-0" onClick={() => openGenieChat()}>
          <Sparkles className="h-4 w-4" /> Ask Genie
        </Button>
      </div>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Tabs defaultValue="resources">
          <TabsList>
            <TabsTrigger value="resources">Assets & Resources</TabsTrigger>
            <TabsTrigger value="contacts">Still stuck?</TabsTrigger>
          </TabsList>
          <TabsContent value="resources" className="mt-4">
            <ResourcesView />
          </TabsContent>
          <TabsContent value="contacts" className="mt-4">
            <ContactsView />
          </TabsContent>
        </Tabs>
      </Suspense>
    </AppShell>
  );
}

// Escalation paths when the field is still stuck after the playbook + Ask Genie.
// Update these links/handles as the support model evolves.
const CONTACTS: {
  title: string;
  desc: string;
  action: string;
  url: string;
  action2?: string;
  url2?: string;
  icon: LucideIcon;
  accent: string;
}[] = [
  {
    title: "General Genie Questions",
    desc: "Broad Genie & AI/BI questions, community help, and product discussion. For pricing / pay-go questions, use #genie-paygo.",
    action: "Post in #apa-genie-aibi",
    url: "https://databricks.enterprise.slack.com/archives/C077N5FSZDL",
    action2: "Pricing questions — #genie-paygo",
    url2: "https://docs.google.com/document/d/15VSQ95Kejw0bPzz24g7OKoAFmM6vYkYpkNJT4pXV52E/edit?tab=t.0#heading=h.g8pdpmh1xa4i",
    icon: MessageSquare,
    accent: "text-sky-600 bg-sky-500/10 ring-sky-500/20",
  },
  {
    title: "SSA — Specialist Solutions Architects (raise an ASQ)",
    desc: "Advanced, deeply technical expertise in a specific specialization to help customers accelerate Genie adoption — especially 300+/400+ level use cases, evaluations, architecture, tuning, and production guidance.",
    action: "Raise an ASQ",
    url: "https://databricks.lightning.force.com/lightning/page/home",
    icon: Users,
    accent: "text-emerald-600 bg-emerald-500/10 ring-emerald-500/20",
  },
  {
    title: "Product / Brickroad (PM help)",
    desc: "Product gaps, roadmap questions, or a blocker that needs PM/engineering attention.",
    action: "File on Brickroad",
    url: "https://go/brickroad",
    icon: LifeBuoy,
    accent: "text-orange-600 bg-orange-500/10 ring-orange-500/20",
  },
];

const FEEDBACK_SUBJECT = "?subject=Genie%20Adoption%20Navigator%20feedback";
const ANINDITA_MAILTO = `mailto:anindita.mahapatra@databricks.com${FEEDBACK_SUBJECT}`;
const RICHA_MAILTO = `mailto:richa.sethi@databricks.com${FEEDBACK_SUBJECT}`;
const AMEE_MAILTO = `mailto:amee.vora@databricks.com${FEEDBACK_SUBJECT}`;

function ContactsView() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Worked the playbook and asked Genie, but still stuck? Here's who to reach —
        pick the path that fits.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        {CONTACTS.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.title} className="flex flex-col hover:border-primary/40 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-2.5">
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center ring-1 shrink-0", c.accent)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-sm leading-snug pt-1">{c.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5 flex-1 flex flex-col">
                <p className="text-sm text-muted-foreground flex-1">{c.desc}</p>
                <div className="space-y-1.5">
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {c.action}
                  </a>
                  {c.action2 && c.url2 && (
                    <a
                      href={c.url2}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {c.action2}
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Feedback on this Navigator — a data gap, a bug, or an idea? Email{" "}
        <a href={ANINDITA_MAILTO} className="text-primary font-medium hover:underline">
          Anindita Mahapatra
        </a>
        ,{" "}
        <a href={RICHA_MAILTO} className="text-primary font-medium hover:underline">
          Richa Sethi
        </a>
        , or{" "}
        <a href={AMEE_MAILTO} className="text-primary font-medium hover:underline">
          Amee Vora
        </a>
        .
      </div>
    </div>
  );
}


// Per-bucket icon + accent color so each resource group has a visual identity.
const BUCKET_META: Record<string, { icon: LucideIcon; accent: string }> = {
  "Product & Reference": { icon: BookOpen, accent: "text-sky-600 bg-sky-500/10 ring-sky-500/20" },
  "Demo Assets": { icon: PlayCircle, accent: "text-violet-600 bg-violet-500/10 ring-violet-500/20" },
  "Plays": { icon: Rocket, accent: "text-orange-600 bg-orange-500/10 ring-orange-500/20" },
  "Workshops and Training": { icon: GraduationCap, accent: "text-emerald-600 bg-emerald-500/10 ring-emerald-500/20" },
  "Proof & Dashboards": { icon: BarChart3, accent: "text-indigo-600 bg-indigo-500/10 ring-indigo-500/20" },
};
const DEFAULT_BUCKET_META = { icon: BookOpen, accent: "text-muted-foreground bg-muted ring-border" };

function ResourcesView() {
  const { data } = useGetPlaybookSuspense(selector());
  const buckets = Array.from(new Set(data.resources.map((r) => r.bucket)));
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {buckets.map((bucket) => {
        const meta = BUCKET_META[bucket] ?? DEFAULT_BUCKET_META;
        const Icon = meta.icon;
        const items = data.resources.filter((r) => r.bucket === bucket);
        return (
          <Card key={bucket} className="flex flex-col overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center ring-1 shrink-0", meta.accent)}>
                  <Icon className="h-4 w-4" />
                </div>
                <CardTitle className="text-sm">{bucket}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-0.5 flex-1">
              {items.map((r) => (
                <a
                  key={r.key}
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() =>
                    logResourceClick({ resource_key: r.key }).catch(() => {})
                  }
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors group"
                >
                  <span className="flex-1 min-w-0 truncate">{r.label}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* Upcoming asset — not yet live, shown as a disabled "coming soon" tile. */}
      <Card className="flex flex-col overflow-hidden border-dashed opacity-90">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center ring-1 shrink-0 text-amber-600 bg-amber-500/10 ring-amber-500/20">
              <Calculator className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm">Genie Calculator</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center py-6">
          <span className="text-lg font-semibold text-amber-700 dark:text-amber-400">
            Coming soon
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
