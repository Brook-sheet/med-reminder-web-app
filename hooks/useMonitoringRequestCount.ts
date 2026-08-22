'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

const POLL_MS = 10_000;

export function useMonitoringRequestCount(
  enabled = true
) {
  const [
    pendingCount,
    setPendingCount,
  ] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setPendingCount(0);
      return;
    }

    try {
      const response = await fetch(
        '/api/patient/monitor?countOnly=1',
        {
          cache: 'no-store',
        }
      );

      const result = await response.json();

      if (
        response.ok &&
        result.success
      ) {
        setPendingCount(
          Number(result.data.pendingCount) || 0
        );
      }
    } catch {
      // Keep the previous valid count.
      // The next poll will try again.
    }
  }, [enabled]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();

    if (!enabled) {
      return;
    }

    const interval = window.setInterval(
      refresh,
      POLL_MS
    );

    const handleUpdate = () => {
      void refresh();
    };

    window.addEventListener(
      'monitoring-requests-updated',
      handleUpdate
    );

    return () => {
      window.clearInterval(interval);

      window.removeEventListener(
        'monitoring-requests-updated',
        handleUpdate
      );
    };
  }, [enabled, refresh]);

  return {
    pendingCount,
    refresh,
  };
}