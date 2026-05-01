import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Compose Tailwind class strings while resolving conflicting utilities
 * (e.g. `border-red-500` + `border-blue-500` → keeps the last winner).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
