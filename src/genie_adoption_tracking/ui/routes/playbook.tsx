import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { useGetPlaybookSuspense, logResourceClick } from "@/lib/api";
import { selector } from "@/lib/selector";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Sparkles } from "lucide-react";
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
          Ask Genie for anything you need mid-engagement, or browse the playbook's
          blocker plays and go/ resources. Version <PlaybookVersion />.
        </p>
      </div>

      {/* Ask Genie is the primary "how do I…" surface — the chat reads this playbook
          plus the docs and answers tailored to the account you're on. */}
      <Card className="mb-6 border-primary/40">
        <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Ask Genie</div>
              <div className="text-sm text-muted-foreground">
                What demo to show, how to handle an objection, hackathon prereqs — ask
                in plain English.
              </div>
            </div>
          </div>
          <Button className="gap-2 shrink-0" onClick={() => openGenieChat()}>
            <Sparkles className="h-4 w-4" /> Ask Genie
          </Button>
        </CardContent>
      </Card>

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

function PlaybookVersion() {
  const { data } = useGetPlaybookSuspense(selector());
  return <span className="font-mono">{data.version}</span>;
}

// Escalation paths when the field is still stuck after the playbook + Ask Genie.
// Update these links/handles as the support model evolves.
const CONTACTS: {
  title: string;
  desc: string;
  action: string;
  url: string;
}[] = [
  {
    title: "Genie SME / SSA team",
    desc: "Deep technical help on a specific Genie engagement — accuracy, modeling, evaluation, tricky setups.",
    action: "Post in #fins-genie-ssa",
    url: "https://databricks.slack.com/channels/fins-genie-ssa",
  },
  {
    title: "Open an ASQ (Specialist Request)",
    desc: "Formal specialist help routed to the right SME when you need hands-on support on an account.",
    action: "Raise an ASQ",
    url: "https://databricks.lightning.force.com/lightning/page/home",
  },
  {
    title: "Product / Brickroad (PM help)",
    desc: "Product gaps, roadmap questions, or a blocker that needs PM/engineering attention.",
    action: "File on Brickroad",
    url: "https://go/brickroad",
  },
  {
    title: "Security & Trust review",
    desc: "Questions on Partner-Powered AI enablement, the AI Security Review, or trust/compliance.",
    action: "Security Authority Review guide",
    url: "https://docs.databricks.com/aws/en/databricks-ai/databricks-ai-trust",
  },
  {
    title: "App feedback / issues",
    desc: "Something wrong in this Navigator, a data gap, or an idea to make it better? Let us know.",
    action: "Share feedback",
    url: "mailto:?subject=Genie%20Adoption%20Navigator%20feedback",
  },
];

function ContactsView() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Worked the playbook and asked Genie, but still stuck? Here's who to reach —
        pick the path that fits.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        {CONTACTS.map((c) => (
          <Card key={c.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{c.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{c.desc}</p>
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {c.action}
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}


function ResourcesView() {
  const { data } = useGetPlaybookSuspense(selector());
  const buckets = Array.from(new Set(data.resources.map((r) => r.bucket)));
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      {buckets.map((bucket) => (
        <Card key={bucket}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{bucket}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.resources
              .filter((r) => r.bucket === bucket)
              .map((r) => (
                <a
                  key={r.key}
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() =>
                    logResourceClick({ resource_key: r.key }).catch(() => {})
                  }
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors group"
                >
                  {r.label}
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </a>
              ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
