import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { useGetPlaybookSuspense, logResourceClick } from "@/lib/api";
import { selector } from "@/lib/selector";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
            <TabsTrigger value="blockers">Getting Unstuck</TabsTrigger>
          </TabsList>
          <TabsContent value="resources" className="mt-4">
            <ResourcesView />
          </TabsContent>
          <TabsContent value="blockers" className="mt-4">
            <BlockersView />
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


function BlockersView() {
  const { data } = useGetPlaybookSuspense(selector());
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {data.blockers.map((b) => (
        <Card key={b.key}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{b.name}</CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {b.gate}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Checks
              </span>
              <ul className="mt-1 space-y-0.5">
                {b.checks.map((c, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-muted-foreground">·</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-muted-foreground italic">{b.concern}</p>
            <div>
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Recommended action
              </span>
              <p>{b.action}</p>
            </div>
          </CardContent>
        </Card>
      ))}
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
