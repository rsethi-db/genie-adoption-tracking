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
        <p className="mt-2 text-base font-medium text-muted-foreground">
          Powered by Genie
        </p>
        <p className="mt-4 text-lg text-muted-foreground">
          Start with an account — capture where it is against the Genie Playbook —
          then ask Genie what to do next: which demo to show, how to handle an
          objection, or what's blocking the customer's readiness.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-8">
        <FeatureCard
          icon={<ClipboardCheck className="h-5 w-5" />}
          title="Accounts"
          desc="Look up an account and work its Genie Playbook across the UCO stages."
          to="/accounts"
          cta="Open Accounts"
        />
        <FeatureCard
          icon={<LineChart className="h-5 w-5" />}
          title="Signals"
          desc="The U1→U6 adoption funnel across all of FINS at a glance."
          to="/dashboard"
          cta="Open Signals"
        />
        <FeatureCard
          icon={<BookOpen className="h-5 w-5" />}
          title="Getting Help"
          desc="Ask Genie, browse the resources, or find who to contact."
          to="/playbook"
          cta="Open Getting Help"
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
