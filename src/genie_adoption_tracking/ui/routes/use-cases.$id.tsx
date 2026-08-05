import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, useMemo, useState } from "react";
import {
  useGetUseCaseSuspense,
  useGetPlaybookSuspense,
  useToggleChecklistItem,
  useFlagBlocker,
  useResolveBlocker,
  logResourceClick,
  getUseCaseKey,
  listUseCasesKey,
  type UseCaseDetailOut,
  type PlaybookOut,
  type BlockerDefOut,
} from "@/lib/api";
import { selector } from "@/lib/selector";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  AlertTriangle,
  ExternalLink,
  LifeBuoy,
  Check,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  LANE_LABELS,
  LANE_ORDER,
  LANE_ACCENT,
  LANE_DOT,
  progressTone,
} from "@/lib/playbook-ui";

export const Route = createFileRoute("/use-cases/$id")({
  component: () => <UseCaseDetailPage />,
});

function UseCaseDetailPage() {
  const { id } = Route.useParams();
  return (
    <AppShell>
      <Suspense fallback={<DetailSkeleton />}>
        <Runner id={id} />
      </Suspense>
    </AppShell>
  );
}

function Runner({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data: uc } = useGetUseCaseSuspense({
    params: { use_case_id: id },
    ...selector(),
  });
  const { data: playbook } = useGetPlaybookSuspense(selector());

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getUseCaseKey({ use_case_id: id }) });
    qc.invalidateQueries({ queryKey: listUseCasesKey() });
  };

  const currentStage = playbook.stages.find((s) => s.key === uc.stage);
  const owners = [
    uc.ae_owner && `AE ${uc.ae_owner}`,
    uc.sa_owner && `SA ${uc.sa_owner}`,
    uc.dsa_owner && `DSA ${uc.dsa_owner}`,
  ].filter(Boolean);

  return (
    <div>
      <Link
        to="/accounts/$accountId"
        params={{ accountId: uc.account_id }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> {uc.account_name}
      </Link>
      <StageStepper playbook={playbook} currentKey={uc.stage} />

      {uc.pp_status === "off" && (
        <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-destructive">
              Partner-Powered AI is off for {uc.account_name}.
            </span>{" "}
            Genie can't consume until it's enabled — start with an AI Security
            Review (see the Pre-requisites blocker and the account page).
          </div>
        </div>
      )}

      <div className="mt-6 grid lg:grid-cols-3 gap-6">
        {/* Main column: stage summary + checklist */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono">
                {currentStage?.code}
              </Badge>
              <h1 className="text-2xl font-bold">{uc.title}</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {uc.account_name} · {currentStage?.name}
              {owners.length > 0 && <> · {owners.join(" · ")}</>}
            </p>
            {currentStage?.summary && (
              <p className="text-sm mt-3 rounded-md bg-accent/50 p-3">
                {currentStage.summary}
              </p>
            )}
          </div>

          <StageChecklist uc={uc} onToggle={invalidate} />
        </div>

        {/* Sidebar: unstuck, blockers, resources */}
        <div className="space-y-6">
          <GetUnstuck
            uc={uc}
            playbook={playbook}
            onChange={invalidate}
          />
          <ContextResources uc={uc} playbook={playbook} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage stepper (horizontal)
// ---------------------------------------------------------------------------

function StageStepper({
  playbook,
  currentKey,
}: {
  playbook: PlaybookOut;
  currentKey: string;
}) {
  // Read-only: the stage mirrors the UCO stage in Salesforce. This app is
  // advisory — it never changes the UCO stage or writes to SFDC. It shows the
  // account team what to do at whatever stage the use case is already in.
  const ordered = [...playbook.stages].sort((a, b) => a.order - b.order);
  const currentOrder =
    playbook.stages.find((s) => s.key === currentKey)?.order ?? 0;

  return (
    <div>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {ordered.map((s, i) => {
          const done = s.order < currentOrder;
          const active = s.key === currentKey;
          return (
            <div key={s.key} className="flex items-center shrink-0">
              <div
                title={s.name}
                className={[
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm",
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <span className="font-mono text-xs">{s.code}</span>
                )}
                <span className="hidden md:inline whitespace-nowrap">
                  {s.name}
                </span>
              </div>
              {i < ordered.length - 1 && <div className="h-px w-4 bg-border" />}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">
        Stage mirrors the UCO in Salesforce — this app is advisory and never
        changes it.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checklist grouped by lane for the current stage
// ---------------------------------------------------------------------------

function StageChecklist({
  uc,
  onToggle,
}: {
  uc: UseCaseDetailOut;
  onToggle: () => void;
}) {
  const toggle = useToggleChecklistItem({
    mutation: {
      onSuccess: onToggle,
      onError: () => toast.error("Could not update checklist"),
    },
  });

  const itemsForStage = uc.checklist.filter((c) => c.stage === uc.stage);
  const byLane = useMemo(() => {
    const m: Record<string, typeof itemsForStage> = {};
    for (const item of itemsForStage) {
      (m[item.lane] ||= []).push(item);
    }
    return m;
  }, [itemsForStage]);

  const doneCount = itemsForStage.filter((c) => c.done).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Actions for this stage</h2>
        <span className={`text-sm ${progressTone(uc.progress_pct)}`}>
          {doneCount}/{itemsForStage.length} done · {uc.progress_pct}%
        </span>
      </div>
      <Progress value={uc.progress_pct} />

      {LANE_ORDER.filter((lane) => byLane[lane]?.length).map((lane) => (
        <Card key={lane} className={`border-l-4 ${LANE_ACCENT[lane]}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${LANE_DOT[lane]}`} />
              {LANE_LABELS[lane]}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byLane[lane].map((item) => (
              <label
                key={item.item_key}
                className="flex items-start gap-3 cursor-pointer py-1"
              >
                <Checkbox
                  checked={item.done}
                  onCheckedChange={(v) =>
                    toggle.mutate({
                      params: { use_case_id: uc.id },
                      data: { item_key: item.item_key, done: Boolean(v) },
                    })
                  }
                  className="mt-0.5"
                />
                <span
                  className={
                    item.done
                      ? "text-sm line-through text-muted-foreground"
                      : "text-sm"
                  }
                >
                  {item.label}
                </span>
              </label>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Get Unstuck — blocker flow (slide 62)
// ---------------------------------------------------------------------------

function GetUnstuck({
  uc,
  playbook,
  onChange,
}: {
  uc: UseCaseDetailOut;
  playbook: PlaybookOut;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<BlockerDefOut | null>(null);
  const [note, setNote] = useState("");

  const flag = useFlagBlocker({
    mutation: {
      onSuccess: () => {
        onChange();
        toast.success("Blocker flagged");
        setOpen(false);
        setSelected(null);
        setNote("");
      },
      onError: () => toast.error("Could not flag blocker"),
    },
  });
  const resolve = useResolveBlocker({
    mutation: {
      onSuccess: () => {
        onChange();
        toast.success("Blocker resolved");
      },
      onError: () => toast.error("Could not resolve blocker"),
    },
  });

  const openBlockers = uc.blockers.filter((b) => !b.resolved);
  const resourceFor = (key: string) =>
    playbook.resources.find((r) => r.key === key);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <LifeBuoy className="h-4 w-4" /> Getting Unstuck
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {openBlockers.length > 0 && (
          <div className="space-y-2">
            {openBlockers.map((b) => (
              <div
                key={b.id}
                className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    {b.category_name}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => resolve.mutate({ params: { blocker_id: b.id } })}
                  >
                    Resolve
                  </Button>
                </div>
                {b.note && (
                  <p className="text-xs text-muted-foreground mt-1">{b.note}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <Button
            variant="outline"
            className="w-full gap-1"
            onClick={() => setOpen(true)}
          >
            <LifeBuoy className="h-4 w-4" /> I'm stuck
          </Button>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>What's blocking you?</DialogTitle>
              <DialogDescription>
                Pick a category — you'll get the recommended counter-action and the
                resource to pull. This is captured as signal.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {playbook.blockers.map((blk) => {
                const isSel = selected?.key === blk.key;
                return (
                  <button
                    key={blk.key}
                    onClick={() => setSelected(blk)}
                    className={[
                      "w-full text-left rounded-md border p-3 transition-colors",
                      isSel
                        ? "border-primary bg-accent"
                        : "hover:bg-accent/50",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{blk.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {blk.gate}
                      </Badge>
                    </div>
                    {isSel && (
                      <div className="mt-2 space-y-2 text-sm">
                        <p className="text-muted-foreground">{blk.concern}</p>
                        <Separator />
                        <div>
                          <span className="text-xs font-semibold uppercase text-muted-foreground">
                            Recommended action
                          </span>
                          <p>{blk.action}</p>
                        </div>
                        {resourceFor(blk.resource_key) && (
                          <a
                            href={resourceFor(blk.resource_key)!.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => {
                              e.stopPropagation();
                              logResourceClick({
                                resource_key: blk.resource_key,
                                use_case_id: uc.id,
                                stage: uc.stage,
                              }).catch(() => {});
                            }}
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {resourceFor(blk.resource_key)!.label}
                          </a>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-1.5">
              <Textarea
                placeholder="Add context (optional)…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button
                disabled={!selected || flag.isPending}
                onClick={() =>
                  selected &&
                  flag.mutate({
                    params: { use_case_id: uc.id },
                    data: { category_key: selected.key, note },
                  })
                }
              >
                Flag this blocker
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Contextual resources for the current stage (slide 63)
// ---------------------------------------------------------------------------

function ContextResources({
  uc,
  playbook,
}: {
  uc: UseCaseDetailOut;
  playbook: PlaybookOut;
}) {
  const relevant = playbook.resources.filter((r) =>
    r.stages.includes(uc.stage),
  );
  if (relevant.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Resources for this stage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {relevant.map((r) => (
          <a
            key={r.key}
            href={r.url}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              logResourceClick({
                resource_key: r.key,
                use_case_id: uc.id,
                stage: uc.stage,
              }).catch(() => {});
            }}
            className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors group"
          >
            <span>
              <span className="text-xs uppercase text-muted-foreground mr-2">
                {r.bucket}
              </span>
              {r.label}
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
          </a>
        ))}
      </CardContent>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-full" />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
