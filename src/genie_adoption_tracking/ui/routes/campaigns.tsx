import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Megaphone } from "lucide-react";

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
      <div className="mb-6 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500/70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
        <span className="font-medium">In progress</span>
        <span className="text-amber-700/80 dark:text-amber-400/80">
          — Campaigns is still being built; features may change.
        </span>
      </div>
    </AppShell>
  );
}
