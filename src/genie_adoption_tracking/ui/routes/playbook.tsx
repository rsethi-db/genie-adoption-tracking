import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { useGetPlaybookSuspense, logResourceClick } from "@/lib/api";
import { selector } from "@/lib/selector";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink } from "lucide-react";
import { LANE_LABELS, LANE_ORDER, LANE_DOT } from "@/lib/playbook-ui";

export const Route = createFileRoute("/playbook")({
  component: () => <PlaybookPage />,
});

function PlaybookPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Genie Field Adoption Playbook</h1>
        <p className="text-sm text-muted-foreground">
          The full playbook, encoded from the FINS FE Huddle deck. Version{" "}
          <PlaybookVersion />.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Tabs defaultValue="matrix">
          <TabsList>
            <TabsTrigger value="matrix">Adoption Workflow</TabsTrigger>
            <TabsTrigger value="blockers">Getting Unstuck</TabsTrigger>
            <TabsTrigger value="resources">Assets & Resources</TabsTrigger>
          </TabsList>
          <TabsContent value="matrix" className="mt-4">
            <MatrixView />
          </TabsContent>
          <TabsContent value="blockers" className="mt-4">
            <BlockersView />
          </TabsContent>
          <TabsContent value="resources" className="mt-4">
            <ResourcesView />
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

function MatrixView() {
  const { data } = useGetPlaybookSuspense(selector());
  const ordered = [...data.stages].sort((a, b) => a.order - b.order);
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {ordered.map((stage) => {
        const items = data.checklist.filter((c) => c.stage === stage.key);
        const byLane: Record<string, typeof items> = {};
        for (const it of items) (byLane[it.lane] ||= []).push(it);
        return (
          <Card key={stage.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">
                  {stage.code}
                </Badge>
                {stage.name}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{stage.summary}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {LANE_ORDER.filter((l) => byLane[l]?.length).map((lane) => (
                <div key={lane}>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1">
                    <span className={`h-2 w-2 rounded-full ${LANE_DOT[lane]}`} />
                    {LANE_LABELS[lane]}
                  </div>
                  <ul className="space-y-1">
                    {byLane[lane].map((it) => (
                      <li key={it.key} className="text-sm flex gap-1.5">
                        <span className="text-muted-foreground">·</span>
                        {it.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
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
