import type { DashboardData, SignupTrendPoint, RecentSignup } from '../types/dashboard';

/**
 * Deterministic mock API. Returns the same payload every call so e2e tests
 * can assert exact numbers (1234 total users, 5 recent signups, 30 trend
 * points). Toggle `__forceFailure` from tests to exercise the error branch.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function buildSignupTrend(): SignupTrendPoint[] {
  // Anchor on 2026-04-30 so test snapshots remain stable.
  const anchor = new Date('2026-04-30T00:00:00.000Z').getTime();
  const points: SignupTrendPoint[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const date = new Date(anchor - i * MS_PER_DAY).toISOString().slice(0, 10);
    // Pseudo-random but deterministic — keeps the line shape interesting.
    const seed = (i * 9301 + 49297) % 233280;
    const count = 20 + Math.floor((seed / 233280) * 80); // 20-99 signups/day
    points.push({ date, count });
  }
  return points;
}

const RECENT_SIGNUPS: RecentSignup[] = [
  {
    id: 'u_001',
    email: 'alex.morgan@example.com',
    name: 'Alex Morgan',
    date: '2026-04-30T14:22:00.000Z',
  },
  {
    id: 'u_002',
    email: 'priya.shah@example.com',
    name: 'Priya Shah',
    date: '2026-04-30T11:08:00.000Z',
  },
  {
    id: 'u_003',
    email: 'jamie.lee@example.com',
    name: 'Jamie Lee',
    date: '2026-04-29T19:44:00.000Z',
  },
  {
    id: 'u_004',
    email: 'sam.okafor@example.com',
    name: 'Sam Okafor',
    date: '2026-04-29T08:15:00.000Z',
  },
  {
    id: 'u_005',
    email: 'rin.tanaka@example.com',
    name: 'Rin Tanaka',
    date: '2026-04-28T22:03:00.000Z',
  },
];

const PAYLOAD: DashboardData = {
  totalUsers: 1234,
  recentSignups: RECENT_SIGNUPS,
  signupTrend: buildSignupTrend(),
};

/** Test hook — when set, the next fetch resolves with an error. */
export const __testControls: { forceFailure: boolean; latencyMs: number } = {
  forceFailure: false,
  latencyMs: 1500,
};

export function fetchDashboardData(signal?: AbortSignal): Promise<DashboardData> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      if (__testControls.forceFailure) {
        reject(new Error('NETWORK_ERROR'));
        return;
      }
      // Return a deep-ish clone so consumers cannot mutate the source.
      resolve({
        ...PAYLOAD,
        recentSignups: PAYLOAD.recentSignups.map((s) => ({ ...s })),
        signupTrend: PAYLOAD.signupTrend.map((p) => ({ ...p })),
      });
    }, __testControls.latencyMs);

    if (signal) {
      const onAbort = () => {
        window.clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}
