import { ThemeProvider } from "@/components/apx/theme-provider";
import { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { GenieChat } from "@/components/genie-chat";
import { PageViewTracker } from "@/components/page-view-tracker";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: () => (
    <ThemeProvider defaultTheme="dark" storageKey="apx-ui-theme">
      <PageViewTracker />
      <Outlet />
      <Toaster richColors />
      <GenieChat />
    </ThemeProvider>
  ),
});
