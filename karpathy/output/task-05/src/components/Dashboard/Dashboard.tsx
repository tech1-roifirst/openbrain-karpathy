import { Suspense, lazy } from 'react';
import { useDashboardData } from '../../hooks/useDashboardData';
import { DashboardError } from './DashboardError';
import { DashboardSkeleton } from './DashboardSkeleton';
import { MetricCard } from './MetricCard';
import { RecentSignupsTable } from './RecentSignupsTable';

// Code-split the chart bundle (recharts is ~80kb gzipped).
const SignupChart = lazy(() =>
  import('./SignupChart').then((m) => ({ default: m.SignupChart })),
);

/** Tiny placeholder while the chart bundle streams in. */
function ChartFallback() {
  return (
    <div
      className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-gray-100 dark:bg-gray-800 dark:ring-gray-700"
      role="status"
      aria-label="Loading chart"
    >
      <div className="h-5 w-48 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
      <div className="mt-6 h-64 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

/**
 * Top-level dashboard. Orchestrates the loading / error / success branches
 * and lays out the three sub-sections responsively:
 *
 *   - mobile  (< 640px): single column, everything stacked
 *   - tablet  (>= 640px): 2-column grid, metric card spans both
 *   - desktop (>= 1024px): chart spans 2 cols, table 1 col, metric card full-width
 */
export function Dashboard() {
  const { data, loading, error, retry } = useDashboardData();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Skip link — keyboard users can jump past the page chrome. */}
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600"
      >
        Skip to main content
      </a>

      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Overview of users and activity for the last 30 days.
          </p>
        </div>
      </header>

      <main
        id="dashboard-main"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
        data-testid="dashboard-main"
      >
        {loading ? (
          <DashboardSkeleton />
        ) : error ? (
          <DashboardError message={error.message} onRetry={retry} />
        ) : data ? (
          <div
            className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="dashboard-grid"
          >
            <MetricCard
              label="Total Users"
              value={data.totalUsers}
              hint={`${data.recentSignups.length} new in the last 24 hours`}
              className="sm:col-span-2 lg:col-span-3"
            />

            <Suspense fallback={<ChartFallback />}>
              <SignupChart
                data={data.signupTrend}
                className="sm:col-span-2 lg:col-span-2"
              />
            </Suspense>

            <RecentSignupsTable
              signups={data.recentSignups}
              className="sm:col-span-2 lg:col-span-1"
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default Dashboard;
