import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class strings with conflict resolution.
 *
 * Wraps `clsx` (for conditionals) with `tailwind-merge` (so later
 * utilities win against earlier ones for the same property).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format an ISO timestamp as "Apr 30, 2026".
 *
 * Falls back to the raw string if parsing fails so the UI never
 * shows "Invalid Date".
 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Short axis label, e.g. "Apr 30". */
export function formatAxisDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Format integers with thousands separators — "1,234". */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}
