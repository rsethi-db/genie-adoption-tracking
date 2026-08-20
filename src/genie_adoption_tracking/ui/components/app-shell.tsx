import { ReactNode, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { ModeToggle } from "@/components/apx/mode-toggle";
import { cn } from "@/lib/utils";

// Renders the Genie brand logo on a white rounded square (matching the official
// Genie lockup, and giving the transparent icon contrast on the dark theme).
// Falls back to a sparkle mark if the asset is missing.
function BrandMark() {
  const [ok, setOk] = useState(true);
  return (
    <div className="h-11 w-11 rounded-xl bg-white flex items-center justify-center shadow-sm ring-1 ring-black/5">
      {ok ? (
        <img
          src="/logo.svg"
          alt="Genie Adoption"
          className="h-8 w-8 object-contain"
          onError={() => setOk(false)}
        />
      ) : (
        <Sparkles className="h-6 w-6 text-primary" />
      )}
    </div>
  );
}

function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors [&.active]:text-foreground [&.active]:bg-accent"
      activeOptions={{ exact: to === "/" }}
    >
      {label}
    </Link>
  );
}

export function AppShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="h-16 flex items-center gap-2 px-4 max-w-7xl mx-auto w-full">
          <Link to="/" className="flex items-center gap-2.5 mr-4">
            <BrandMark />
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-bold">Genie Adoption</span>
              <span className="text-xs text-muted-foreground -mt-0.5">
                Navigator
              </span>
            </div>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/accounts" label="Accounts" />
            <NavLink to="/dashboard" label="Signals" />
            <NavLink to="/campaigns" label="Campaigns" />
            <NavLink to="/playbook" label="Getting Help" />
            <NavLink to="/insights" label="App Insights" />
            <NavLink to="/feedback" label="Feedback" />
          </nav>
          <div className="flex-1" />
          <ModeToggle />
        </div>
      </header>
      <main className={cn("flex-1 w-full max-w-7xl mx-auto px-4 py-6", className)}>
        {children}
      </main>
    </div>
  );
}

export default AppShell;
