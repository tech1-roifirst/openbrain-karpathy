/**
 * Dashboard data contract.
 *
 * Shared between the API mock, the data-fetching hook, and every
 * presentational sub-component so the entire feature stays in lock-step.
 */
export interface RecentSignup {
  id: string;
  email: string;
  name: string;
  /** ISO 8601 timestamp */
  date: string;
}

export interface SignupTrendPoint {
  /** ISO 8601 date (YYYY-MM-DD) */
  date: string;
  count: number;
}

export interface DashboardData {
  totalUsers: number;
  recentSignups: RecentSignup[];
  signupTrend: SignupTrendPoint[];
}

/** Discriminated union — easier to reason about than a triplet of booleans. */
export type DashboardState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: DashboardData; error: null }
  | { status: 'error'; data: null; error: DashboardError };

export interface DashboardError {
  message: string;
  /** Internal detail for diagnostics — never shown to end-users. */
  cause?: unknown;
}

/* -------------------------------------------------------------------------- */
/*  Component prop interfaces                                                 */
/* -------------------------------------------------------------------------- */

export interface MetricCardProps {
  label: string;
  value: number;
  /** Optional trailing helper text, e.g. "+12 this week". */
  hint?: string;
  className?: string;
}

export interface SignupChartProps {
  data: SignupTrendPoint[];
  className?: string;
}

export interface RecentSignupsTableProps {
  signups: RecentSignup[];
  className?: string;
}

export interface DashboardErrorProps {
  message: string;
  onRetry: () => void;
  className?: string;
}
