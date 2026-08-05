import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route for /campaigns and /campaigns/$campaignId — renders the matched
// child (the list index or a campaign detail) via <Outlet/>.
export const Route = createFileRoute("/campaigns")({
  component: () => <Outlet />,
});
