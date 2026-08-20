import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { useGetAppInsightsSuspense } from "@/lib/api";
import { selector } from "@/lib/selector";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Eye, Clock, MousePointerClick } from "lucide-react";

export const Route = createFileRoute("/insights")({
  component: () => <InsightsPage />,
});

function fmtNum(n: number): string {
  return (n ?? 0).toLocaleString("en-US");
}

function fmtDuration(seconds: number): string {
  const s = Math.round(seconds ?? 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

// Format an ISO timestamp in UTC, e.g. "Aug 20, 2026, 3:49 PM".
function fmtUTC(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function InsightsPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">App Insights</h1>
        <p className="text-sm text-muted-foreground">
          In-app behavior — who's visiting, which pages get used, time spent, and top
          resources.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <InsightsBody />
      </Suspense>
    </AppShell>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon} {label}
        </div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function InsightsBody() {
  const { data } = useGetAppInsightsSuspense(selector());
  if ((data.total_views ?? 0) === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No usage recorded yet — insights populate as people navigate the app.
        </CardContent>
      </Card>
    );
  }
  const maxDay = Math.max(1, ...(data.by_day ?? []).map((d) => d.views));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          icon={<Users className="h-4 w-4" />}
          label="Visitors"
          value={fmtNum(data.total_visitors ?? 0)}
          sub={`${fmtNum(data.visitors_7d ?? 0)} in the last 7 days`}
        />
        <StatTile
          icon={<Eye className="h-4 w-4" />}
          label="Page views"
          value={fmtNum(data.total_views ?? 0)}
          sub={`${fmtNum(data.views_7d ?? 0)} in the last 7 days`}
        />
        <StatTile
          icon={<Clock className="h-4 w-4" />}
          label="Avg session (approx)"
          value={`${data.avg_session_minutes ?? 0}m`}
          sub="approx, from time between views"
        />
        <StatTile
          icon={<MousePointerClick className="h-4 w-4" />}
          label="Resource clicks"
          value={fmtNum((data.top_resources ?? []).reduce((s, r) => s + r.clicks, 0))}
          sub={`${(data.top_resources ?? []).length} distinct resources`}
        />
      </div>

      {/* Views over time */}
      {(data.by_day ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Views over time (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {(data.by_day ?? []).map((d) => (
              <div key={d.day} className="flex items-center gap-3 text-xs">
                <span className="w-24 shrink-0 text-muted-foreground text-right">
                  {d.day.slice(5)}
                </span>
                <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded"
                    style={{ width: `${(d.views / maxDay) * 100}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 tabular-nums">
                  {d.views} views · {d.visitors} ppl
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Most-viewed pages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Most-viewed pages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 px-2 font-medium">Page</th>
                  <th className="py-2 px-2 font-medium text-right">Views</th>
                  <th className="py-2 px-2 font-medium text-right">Visitors</th>
                  <th className="py-2 px-2 font-medium text-right">Avg time</th>
                </tr>
              </thead>
              <tbody>
                {(data.pages ?? []).map((p) => (
                  <tr key={p.path} className="border-b last:border-0">
                    <td className="py-1.5 px-2">
                      <span className="font-medium">{p.title}</span>{" "}
                      <span className="text-xs text-muted-foreground">{p.path}</span>
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{fmtNum(p.views)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{fmtNum(p.visitors)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">
                      {(p.avg_seconds ?? 0) > 0 ? fmtDuration(p.avg_seconds ?? 0) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Visitors — who has viewed the app (from when in-app tracking started; the
          platform Insights link above has the full history). */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Visitors{" "}
            <span className="font-normal text-muted-foreground text-sm">
              ({(data.visitors ?? []).length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(data.visitors ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No visitors recorded yet in-app.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 px-2 font-medium">Person</th>
                    <th className="py-2 px-2 font-medium text-right">Views</th>
                    <th className="py-2 px-2 font-medium text-right">Approx time</th>
                    <th className="py-2 px-2 font-medium text-right">Last visited (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.visitors ?? []).map((v) => (
                    <tr key={v.user} className="border-b last:border-0">
                      <td className="py-1.5 px-2 font-medium">{v.user}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {fmtNum(v.views)}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">
                        {(v.approx_minutes ?? 0) > 0 ? `${v.approx_minutes}m` : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right text-xs text-muted-foreground">
                        {fmtUTC(v.last_seen)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top resources */}
      {(data.top_resources ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top resources clicked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-1">
              {(data.top_resources ?? []).map((r) => (
                <div
                  key={r.resource_key}
                  className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                >
                  <span>
                    {r.label}
                    {r.bucket && (
                      <span className="text-xs text-muted-foreground"> · {r.bucket}</span>
                    )}
                  </span>
                  <span className="tabular-nums font-medium">{r.clicks}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Time metrics are approximate — measured from the gap between consecutive page
        views in a session (capped at 10 min), so idle or closed tabs aren't counted.
      </p>
    </div>
  );
}
