import { memo, useMemo } from 'react';
import { cn, formatDate } from '../../lib/utils';
import type { RecentSignupsTableProps } from '../../types/dashboard';

const HEADING_ID = 'recent-signups-heading';

function RecentSignupsTableInner({ signups, className }: RecentSignupsTableProps) {
  const sorted = useMemo(
    () =>
      [...signups].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [signups],
  );

  return (
    <section
      aria-labelledby={HEADING_ID}
      className={cn(
        'flex min-h-0 flex-col rounded-2xl bg-white shadow-md ring-1 ring-gray-100',
        'dark:bg-gray-800 dark:ring-gray-700',
        className,
      )}
      data-testid="recent-signups"
    >
      <header className="border-b border-gray-100 px-4 py-4 sm:px-6 dark:border-gray-700">
        <h2 id={HEADING_ID} className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Recent signups
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          The 5 newest users to join.
        </p>
      </header>

      {/* Horizontal scroll wrapper for narrow screens. */}
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[28rem] border-collapse text-left text-sm"
          aria-describedby={HEADING_ID}
          data-testid="recent-signups-table"
        >
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600 dark:bg-gray-900/40 dark:text-gray-300">
            <tr>
              <th scope="col" className="px-4 py-3 sm:px-6">
                Name
              </th>
              <th scope="col" className="px-4 py-3 sm:px-6">
                Email
              </th>
              <th scope="col" className="px-4 py-3 sm:px-6">
                Signed up
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-800 dark:divide-gray-700 dark:text-gray-100">
            {sorted.map((row, idx) => (
              <tr
                key={row.id}
                className={cn(
                  'transition-colors',
                  idx % 2 === 1 && 'bg-gray-50/60 dark:bg-gray-900/20',
                  'hover:bg-blue-50/60 focus-within:bg-blue-50/60',
                  'dark:hover:bg-blue-950/30 dark:focus-within:bg-blue-950/30',
                )}
                data-testid="recent-signup-row"
              >
                <td className="whitespace-nowrap px-4 py-3 font-medium sm:px-6">{row.name}</td>
                <td className="whitespace-nowrap px-4 py-3 sm:px-6">
                  <a
                    href={`mailto:${row.email}`}
                    className="rounded text-blue-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:text-blue-300"
                  >
                    {row.email}
                  </a>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600 sm:px-6 dark:text-gray-300">
                  <time dateTime={row.date}>{formatDate(row.date)}</time>
                </td>
              </tr>
            ))}
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-gray-500 sm:px-6 dark:text-gray-400"
                >
                  No recent signups yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export const RecentSignupsTable = memo(RecentSignupsTableInner);
RecentSignupsTable.displayName = 'RecentSignupsTable';
