import { AlertTriangle, RotateCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { DashboardErrorProps } from '../../types/dashboard';

/**
 * Inline error block. Layout is preserved (the surrounding chrome stays
 * visible) and the message is announced via aria-live so a sighted user
 * sees and a screen-reader user hears the same content.
 */
export function DashboardError({ message, onRetry, className }: DashboardErrorProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'flex flex-col items-start gap-4 rounded-2xl border-2 border-red-200 bg-red-50 p-6 shadow-md',
        'sm:flex-row sm:items-center sm:justify-between',
        'dark:border-red-900/50 dark:bg-red-950/30',
        className,
      )}
      data-testid="dashboard-error"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300"
        >
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-red-900 dark:text-red-100">
            We hit a snag loading your dashboard
          </h2>
          <p className="mt-1 text-sm text-red-800 dark:text-red-200" data-testid="error-message">
            {message}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRetry}
        aria-label="Retry loading the dashboard"
        className={cn(
          'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm',
          'transition-colors hover:bg-red-700 active:bg-red-800',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2',
          'dark:bg-red-500 dark:hover:bg-red-400 dark:focus-visible:ring-offset-gray-900',
        )}
        data-testid="dashboard-retry"
      >
        <RotateCw className="h-4 w-4" aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}
