import { useCallback, useEffect, useRef, useState } from 'react';
import type { DashboardData, DashboardError } from '../types/dashboard';
import { fetchDashboardData } from '../mocks/dashboardApi';

export interface UseDashboardDataResult {
  data: DashboardData | null;
  loading: boolean;
  error: DashboardError | null;
  retry: () => void;
}

/**
 * Owns the dashboard's data lifecycle:
 *   - Fetches on mount via AbortController so unmount/refetch cancels in flight.
 *   - Exposes a stable `retry` callback that bumps an internal nonce.
 *   - Translates raw thrown values into a user-safe `DashboardError` (the
 *     UI layer must never display a stack trace).
 */
export function useDashboardData(): UseDashboardDataResult {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<DashboardError | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [nonce, setNonce] = useState<number>(0);

  // Guard against setState-after-unmount in React 18 strict mode.
  const mountedRef = useRef<boolean>(true);

  const retry = useCallback(() => {
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fetchDashboardData(controller.signal)
      .then((payload) => {
        if (!mountedRef.current) return;
        setData(payload);
        setLoading(false);
      })
      .catch((err: unknown) => {
        // Aborts are not errors — they happen during cleanup or rapid retries.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!mountedRef.current) return;
        setError({
          message:
            'We couldn’t load your dashboard right now. Please check your connection and try again.',
          cause: err,
        });
        setData(null);
        setLoading(false);
      });

    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, [nonce]);

  return { data, loading, error, retry };
}
