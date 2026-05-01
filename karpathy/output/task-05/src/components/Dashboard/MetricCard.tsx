import { memo } from 'react';
import { Users } from 'lucide-react';
import { cn, formatNumber } from '../../lib/utils';
import type { MetricCardProps } from '../../types/dashboard';

/**
 * Headline metric — large number, label, optional hint.
 *
 * Uses semantic <section> with aria-labelledby so screen readers announce
 * "Total Users — region — 1,234". Memoized because parent re-renders on
 * every retry but this card only depends on its three primitive props.
 */
function MetricCardInner({ label, value, hint, className }: MetricCardProps) {
  const headingId = 'metric-card-heading';
  const valueId = 'metric-card-value';

  return (
    <section
      aria-labelledby={headingId}
      aria-describedby={valueId}
      className={cn(
        'relative overflow-hidden rounded-2xl bg-blue-600 p-6 text-white shadow-md',
        'sm:p-8',
        'dark:bg-blue-700',
        className,
      )}
      data-testid="metric-card"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2
            id={headingId}
            className="text-sm font-medium uppercase tracking-wide text-blue-100"
          >
            {label}
          </h2>
          <p
            id={valueId}
            className="mt-2 text-4xl font-bold leading-tight sm:text-5xl"
            data-testid="metric-card-value"
          >
            {formatNumber(value)}
          </p>
          {hint ? (
            <p className="mt-2 text-sm text-blue-100" data-testid="metric-card-hint">
              {hint}
            </p>
          ) : null}
        </div>

        <div
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20"
        >
          <Users className="h-6 w-6" />
        </div>
      </div>
    </section>
  );
}

export const MetricCard = memo(MetricCardInner);
MetricCard.displayName = 'MetricCard';
