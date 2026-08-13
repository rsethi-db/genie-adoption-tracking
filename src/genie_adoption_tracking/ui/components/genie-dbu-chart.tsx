import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// A daily [date, $DBU] point as stored on the account (["YYYY-MM-DD", 12.3]).
type SeriesPoint = [string, number];

function toData(series: SeriesPoint[] | undefined) {
  return (series ?? []).map(([date, dbu]) => ({ date, dbu }));
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

// Tiny inline sparkline for a table cell — no axes/tooltip, just the shape of the
// last ~90 days of daily Genie $DBU. Renders a flat dash when there's no data.
export function GenieDbuSparkline({ series }: { series?: SeriesPoint[] }) {
  const data = toData(series);
  if (data.length < 2) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="h-8 w-28 ml-auto">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="dbu"
            stroke="var(--chart-3)"
            strokeWidth={1.5}
            fill="url(#sparkFill)"
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Full daily trend chart for the account detail page — axes + tooltip.
export function GenieDbuTrend({ series }: { series?: SeriesPoint[] }) {
  const data = toData(series);
  if (data.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        No Genie Agent (DBSQL $) usage in the last 90 days.
      </p>
    );
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
            tickFormatter={(d: string) => d.slice(5)}
          />
          <YAxis
            width={44}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmtUsd}
          />
          <Tooltip
            formatter={(v) => [fmtUsd(Number(v)), "Genie Agent (DBSQL $)"]}
            labelClassName="text-xs"
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Area
            type="monotone"
            dataKey="dbu"
            stroke="var(--chart-3)"
            strokeWidth={2}
            fill="url(#trendFill)"
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
