import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route for /use-cases and /use-cases/$id. It renders only the matched
// child (the list index or a use-case detail) via <Outlet/>.
export const Route = createFileRoute("/use-cases")({
  component: () => <Outlet />,
});
