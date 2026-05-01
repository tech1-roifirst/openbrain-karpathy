import { memo, useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { cn, formatAxisDate, formatDate, formatNumber } from '../../lib/utils';
import type { SignupChartProps, SignupTrendPoint } from '../../types/dashboard';

const HEADING_ID = 'signup-chart-heading';
const DESC_ID = 'signup-chart-description';

/** Recharts ticks every Nth point so labels stay readable on narrow screens. */
function pickAxisTicks(data: SignupTrendPoint[]): string[] {
  if (data.length === 0) return [];
  const stride = Math.max(1, Math.floor(data.length / 5)); // ~5-7 labels
  const ticks: string[] = [];
  for (let i = 0; i < data.length; i += stride) {
    ticks.push(data[i].date);
  }
  // Always include the most recent point.
  const last = data[data.length - 1].date;
  if (ticks[ticks.length - 1] !== last) ticks.push(last);
  return ticks;
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload as SignupTrendPoint;
  return (
    <div
      role="status"
      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(point.date)}</p>
      <p className="text-gray-600 dark:text-gray-300">
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {formatNumber(point.count)}
        </span>{' '}
        signups
      </p>
    </div>
  );
}

function SignupChartInner({ data, className }: SignupChartProps) {
  const ticks = useMemo(() => pickAxisTicks(data), [data]);
  const totalThirtyDays = useMemo(
    () => data.reduce((sum, p) => sum + p.count, 0),
    [data],
  );

  return (
    <section
      aria-labelledby={HEADING_ID}
      aria-describedby={DESC_ID}
      className={cn(
        'flex min-h-0 flex-col rounded-2xl bg-white p-4 shadow-md ring-1 ring-gray-100',
        'sm:p-6',
        'dark:bg-gray-800 dark:ring-gray-700',
        className,
      )}
      data-testid="signup-chart"
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id={HEADING_ID} className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Signups — last 30 days
          </h2>
          <p id={DESC_ID} className="text-sm text-gray-500 dark:text-gray-400">
            Daily new-user signups. Hover any point for the exact count.
          </p>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {formatNumber(totalThirtyDays)}
          </span>{' '}
          total
        </p>
      </header>

      {/* Visually hidden table — screen reader fallback for the SVG chart. */}
      <table className="sr-only" aria-label="Daily signups data">
        <caption>Signups by date for the last 30 days.</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Signups</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.date}>
              <td>{formatDate(p.date)}</td>
              <td>{p.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="h-64 w-full sm:h-72 lg:h-80" data-testid="signup-chart-canvas">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              ticks={ticks}
              tickFormatter={formatAxisDate}
              stroke="#6B7280"
              fontSize={12}
              tickMargin={8}
            />
            <YAxis
              stroke="#6B7280"
              fontSize={12}
              tickFormatter={(v: number) => formatNumber(v)}
              width={40}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#10B981', strokeWidth: 1 }} />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#10B981"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#10B981' }}
              activeDot={{ r: 5 }}
              isAnimationActive
              animationDuration={600}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export const SignupChart = memo(SignupChartInner);
SignupChart.displayName = 'SignupChart';
