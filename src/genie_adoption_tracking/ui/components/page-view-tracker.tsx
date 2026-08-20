import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { logPageView } from "@/lib/api";

// Per-tab session id (stable for the browser tab), used to approximate dwell time
// from consecutive views server-side.
function sessionId(): string {
  const KEY = "gat-session-id";
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

// Normalize a concrete pathname to a route template + human title, so per-page
// aggregation groups (e.g. every account detail → "/accounts/:id").
function normalize(path: string): { path: string; title: string } {
  if (path === "/") return { path: "/", title: "Home" };
  if (path.startsWith("/accounts/") && path !== "/accounts")
    return { path: "/accounts/:id", title: "Account detail" };
  if (path === "/accounts") return { path: "/accounts", title: "Accounts" };
  if (path.startsWith("/use-cases/"))
    return { path: "/use-cases/:id", title: "Use case detail" };
  if (path.startsWith("/campaigns/") && path !== "/campaigns")
    return { path: "/campaigns/:id", title: "Campaign detail" };
  if (path === "/campaigns") return { path: "/campaigns", title: "Campaigns" };
  if (path === "/dashboard") return { path: "/dashboard", title: "Signals" };
  if (path === "/playbook") return { path: "/playbook", title: "Getting Help" };
  if (path === "/insights") return { path: "/insights", title: "App Insights" };
  if (path === "/feedback") return { path: "/feedback", title: "Feedback" };
  if (path.startsWith("/forms/")) return { path: "/forms/:token", title: "Campaign form" };
  return { path, title: path };
}

// Fire-and-forget a page-view log on every route change. Mounted once at the root.
export function PageViewTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const last = useRef<string>("");
  useEffect(() => {
    if (!pathname || pathname === last.current) return;
    last.current = pathname;
    // Don't track the public form (unauthenticated responders).
    if (pathname.startsWith("/forms/")) return;
    const { path, title } = normalize(pathname);
    logPageView({ path, title, session_id: sessionId() }).catch(() => {});
  }, [pathname]);
  return null;
}
