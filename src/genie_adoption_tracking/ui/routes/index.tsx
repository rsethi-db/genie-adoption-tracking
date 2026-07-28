import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, LineChart, BookOpen, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: () => <Index />,
});

function Index() {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto text-center py-8">
        <div className="mx-auto mb-6 h-20 w-20 rounded-2xl bg-white flex items-center justify-center shadow-md ring-1 ring-black/5">
          <img src="/logo.svg" alt="Genie" className="h-14 w-14 object-contain" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Make the Genie Playbook Actionable
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Run the FINS Genie Field Adoption Playbook against real accounts, get
          unstuck when you hit a blocker, and capture the signal that feeds MBR
          reporting.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link to="/accounts">
            <Button size="lg" className="gap-2">
              Start running the play <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button size="lg" variant="outline">
              View signal dashboard
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-8">
        <FeatureCard
          icon={<ClipboardCheck className="h-5 w-5" />}
          title="Playbook Runner"
          desc="Pick an account, see the checklist for the current UCO stage, and check off Happy-Path, Recommended, and As-Needed actions."
          to="/accounts"
          cta="Open accounts"
        />
        <FeatureCard
          icon={<LineChart className="h-5 w-5" />}
          title="Signals Dashboard"
          desc="The U1→U6 funnel, top blockers by category, stalled accounts, and which resources the field pulls most."
          to="/dashboard"
          cta="Open dashboard"
        />
        <FeatureCard
          icon={<BookOpen className="h-5 w-5" />}
          title="Getting Help"
          desc="The full stage-by-stage matrix, the five 'Getting Unstuck' blocker categories, and every go/ resource link."
          to="/playbook"
          cta="Next Step"
        />
      </div>
    </AppShell>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  to,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  to: string;
  cta: string;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center mb-2">
          {icon}
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">
        <Link to={to}>
          <Button variant="ghost" className="gap-2 px-0 hover:bg-transparent hover:underline">
            {cta} <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
