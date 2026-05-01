import { cn } from '../../lib/utils';

interface SkeletonBoxProps {
  className?: string;
}

function SkeletonBox({ className }: SkeletonBoxProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-md bg-gray-200 dark:bg-gray-700',
        className,
      )}
    />
  );
}

/**
 * Layout-preserving skeleton. The grid mirrors the real Dashboard so the
 * page does not jump when data resolves. `aria-busy` + a polite live region
 * announce the loading state to assistive tech.
 */
export function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading dashboard"
      className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="dashboard-skeleton"
    >
      {/* Metric card skeleton — spans full width on desktop. */}
      <div
        className="rounded-2xl bg-blue-100 p-6 shadow-md sm:col-span-2 lg:col-span-3 dark:bg-blue-900/40"
        data-testid="skeleton-metric-card"
      >
        <SkeletonBox className="h-4 w-32 bg-blue-200 dark:bg-blue-800" />
        <SkeletonBox className="mt-3 h-10 w-40 bg-blue-200 dark:bg-blue-800" />
      </div>

      {/* Chart skeleton */}
      <div
        className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-gray-100 sm:col-span-2 lg:col-span-2 dark:bg-gray-800 dark:ring-gray-700"
        data-testid="skeleton-chart"
      >
        <SkeletonBox className="h-5 w-48" />
        <SkeletonBox className="mt-2 h-3 w-64" />
        <SkeletonBox className="mt-6 h-64 w-full" />
      </div>

      {/* Table skeleton */}
      <div
        className="rounded-2xl bg-white shadow-md ring-1 ring-gray-100 sm:col-span-2 lg:col-span-1 dark:bg-gray-800 dark:ring-gray-700"
        data-testid="skeleton-table"
      >
        <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <SkeletonBox className="h-5 w-32" />
          <SkeletonBox className="mt-2 h-3 w-44" />
        </div>
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-center justify-between px-6 py-4">
              <div className="flex-1 space-y-2">
                <SkeletonBox className="h-3 w-32" />
                <SkeletonBox className="h-3 w-48" />
              </div>
              <SkeletonBox className="h-3 w-20" />
            </li>
          ))}
        </ul>
      </div>

      <span className="sr-only">Loading dashboard data, please wait.</span>
    </div>
  );
}
