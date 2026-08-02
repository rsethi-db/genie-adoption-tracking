import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, LineChart, BookOpen, ArrowRight, Sparkles } from "lucide-react";
import { openGenieChat } from "@/components/genie-chat";

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
          Run the Genie play, guided by Genie
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Start with an account — capture where it is against the FINS Field
          Adoption Playbook — then ask Genie what to do next: which demo to show,
          how to handle an objection, or what's blocking the customer's readiness.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link to="/accounts">
            <Button size="lg" className="gap-2">
              Open Accounts <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            size="lg"
            variant="outline"
            className="gap-2"
            onClick={() => openGenieChat()}
          >
            <Sparkles className="h-4 w-4" /> Ask Genie
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-8">
        <FeatureCard
          icon={<ClipboardCheck className="h-5 w-5" />}
          title="1 · Accounts"
          desc="Look up an account and capture where it is — work its Adoption Workflow across the UCO stages and track readiness and blockers."
          to="/accounts"
          cta="Open Accounts"
        />
        <ActionCard
          icon={<Sparkles className="h-5 w-5" />}
          title="2 · Ask Genie"
          desc="Get guided from there — chat with the playbook, the docs, and live FINS adoption data, tailored to the account you're on."
          cta="Start chatting"
          onClick={() => openGenieChat()}
        />
        <FeatureCard
          icon={<LineChart className="h-5 w-5" />}
          title="Signals"
          desc="The U1→U6 funnel, blockers by category, PP / provisioning gaps, open Genie issues, and pipeline — adoption across all of FINS at a glance."
          to="/dashboard"
          cta="Open Signals"
        />
      </div>

      <div className="mt-4">
        <FeatureCard
          icon={<BookOpen className="h-5 w-5" />}
          title="Getting Help"
          desc="Ask Genie for anything, browse the go/ assets & resources and the five 'Getting Unstuck' blocker plays, or find who to contact when you're still stuck."
          to="/playbook"
          cta="Open Getting Help"
        />
      </div>
    </AppShell>
  );
}

function ActionCard({
  icon,
  title,
  desc,
  cta,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <Card className="flex flex-col border-primary/40">
      <CardHeader>
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
          {icon}
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">
        <Button
          variant="ghost"
          className="gap-2 px-0 hover:bg-transparent hover:underline text-primary"
          onClick={onClick}
        >
          {cta} <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
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
