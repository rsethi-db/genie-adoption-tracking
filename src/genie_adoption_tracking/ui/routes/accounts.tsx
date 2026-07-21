import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route for /accounts and /accounts/$accountId — renders the matched child.
export const Route = createFileRoute("/accounts")({
  component: () => <Outlet />,
});
