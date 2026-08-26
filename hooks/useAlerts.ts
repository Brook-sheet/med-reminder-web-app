'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { AlertData } from '@/lib/interfaces/data/Alert';

export function useAlerts(
  limit = 50,
) {
  const [
    alerts,
    setAlerts,
  ] =
    useState<AlertData[]>([]);

  const [
    unreadCount,
    setUnreadCount,
  ] =
    useState(0);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    connected,
    setConnected,
  ] =
    useState(false);

  const sourceRef =
    useRef<EventSource | null>(
      null,
    );

  const fetchAlerts =
    useCallback(
      async (): Promise<
        AlertData[]
      > => {
        const response =
          await fetch(
            `/api/alerts?limit=${limit}`,
            {
              cache:
                'no-store',
            },
          );

        const json =
          await response.json();

        if (
          !response.ok ||
          !json.success
        ) {
          throw new Error(
            json.error ||
              'Failed to load alerts.',
          );
        }

        const nextAlerts =
          json.data
            .alerts as AlertData[];

        setAlerts(
          nextAlerts,
        );

        setUnreadCount(
          json.data
            .unreadCount as number,
        );

        setError(
          null,
        );

        return nextAlerts;
      },
      [
        limit,
      ],
    );

  useEffect(() => {
    let cancelled =
      false;

    let refreshTimer:
      ReturnType<typeof setInterval> | null =
        null;

    const refresh =
      async () => {
        try {
          await fetchAlerts();
        } catch (refreshError) {
          if (!cancelled) {
            setError(
              refreshError instanceof Error
                ? refreshError.message
                : 'Failed to refresh alerts.',
            );
          }
        }
      };

    const refreshWhenVisible =
      () => {
        if (
          document.visibilityState ===
          'visible'
        ) {
          void refresh();
        }
      };

    const start =
      async () => {
        try {
          const initial =
            await fetchAlerts();

          if (cancelled) {
            return;
          }

          const after =
            initial[0]
              ? new Date(
                  new Date(
                    initial[0].createdAt,
                  ).getTime() - 1,
                ).toISOString()
              : new Date(
                  Date.now() -
                    1_000,
                ).toISOString();

          const source =
            new EventSource(
              `/api/alerts/stream?after=${encodeURIComponent(
                after,
              )}`,
            );

          sourceRef.current =
            source;

          source.addEventListener(
            'connected',
            () => {
              if (!cancelled) {
                setConnected(
                  true,
                );
              }
            },
          );

          source.addEventListener(
            'alert',
            (event) => {
              if (cancelled) {
                return;
              }

              const incoming =
                JSON.parse(
                  (
                    event as MessageEvent
                  ).data,
                ) as AlertData;

              setAlerts(
                (previous) => {
                  /*
                   * Existing alerts are updated by the
                   * periodic REST refresh. SSE is used
                   * for newly created medication alerts.
                   */
                  if (
                    previous.some(
                      (item) =>
                        item._id ===
                        incoming._id,
                    )
                  ) {
                    return previous;
                  }

                  return [
                    incoming,
                    ...previous,
                  ].slice(
                    0,
                    limit,
                  );
                },
              );

              setUnreadCount(
                (count) =>
                  count +
                  (incoming.isRead
                    ? 0
                    : 1),
              );

              window.dispatchEvent(
                new CustomEvent(
                  'medicationAlertReceived',
                  {
                    detail:
                      incoming,
                  },
                ),
              );
            },
          );

          source.addEventListener(
            'unread',
            (event) => {
              if (cancelled) {
                return;
              }

              const value =
                JSON.parse(
                  (
                    event as MessageEvent
                  ).data,
                ) as {
                  unreadCount:
                    number;
                };

              setUnreadCount(
                value.unreadCount,
              );
            },
          );

          source.onerror =
            () => {
              if (!cancelled) {
                setConnected(
                  false,
                );
              }

              /*
               * EventSource automatically reconnects.
               * Persisted alerts remain available.
               */
            };

          /*
           * Patient notes can be added after an alert was
           * delivered. Refresh visible alerts every 30
           * seconds so those annotations appear without
           * creating or resending an alert.
           */
          refreshTimer =
            setInterval(
              () => {
                if (
                  document.visibilityState ===
                  'visible'
                ) {
                  void refresh();
                }
              },
              30_000,
            );

          window.addEventListener(
            'focus',
            refresh,
          );

          document.addEventListener(
            'visibilitychange',
            refreshWhenVisible,
          );
        } catch (startError) {
          if (!cancelled) {
            setError(
              startError instanceof Error
                ? startError.message
                : 'Failed to load alerts.',
            );
          }
        } finally {
          if (!cancelled) {
            setLoading(
              false,
            );
          }
        }
      };

    queueMicrotask(
      () =>
        void start(),
    );

    return () => {
      cancelled =
        true;

      sourceRef.current?.close();
      sourceRef.current =
        null;

      if (refreshTimer) {
        clearInterval(
          refreshTimer,
        );
      }

      window.removeEventListener(
        'focus',
        refresh,
      );

      document.removeEventListener(
        'visibilitychange',
        refreshWhenVisible,
      );
    };
  }, [
    fetchAlerts,
    limit,
  ]);

  const updateAlert =
    useCallback(
      async (
        alertId: string,
        action:
          | 'read'
          | 'acknowledge',
      ) => {
        const wasUnread =
          alerts.some(
            (item) =>
              item._id ===
                alertId &&
              !item.isRead,
          );

        const response =
          await fetch(
            `/api/alerts/${alertId}`,
            {
              method:
                'PATCH',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  action,
                }),
            },
          );

        const json =
          await response.json();

        if (
          !response.ok ||
          !json.success
        ) {
          throw new Error(
            json.error ||
              'Failed to update alert.',
          );
        }

        const updated =
          json.data as AlertData;

        setAlerts(
          (previous) =>
            previous.map(
              (item) =>
                item._id ===
                updated._id
                  ? updated
                  : item,
            ),
        );

        if (wasUnread) {
          setUnreadCount(
            (count) =>
              Math.max(
                0,
                count - 1,
              ),
          );
        }

        return updated;
      },
      [
        alerts,
      ],
    );

  const markAllRead =
    useCallback(
      async () => {
        const response =
          await fetch(
            '/api/alerts',
            {
              method:
                'PATCH',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  action:
                    'markAllRead',
                }),
            },
          );

        const json =
          await response.json();

        if (
          !response.ok ||
          !json.success
        ) {
          throw new Error(
            json.error ||
              'Failed to update alerts.',
          );
        }

        const now =
          new Date().toISOString();

        setAlerts(
          (previous) =>
            previous.map(
              (item) =>
                item.isRead
                  ? item
                  : {
                      ...item,

                      status:
                        'READ',

                      isRead:
                        true,

                      readAt:
                        now,
                    },
            ),
        );

        setUnreadCount(
          0,
        );
      },
      [],
    );

  return {
    alerts,
    unreadCount,
    loading,
    error,
    connected,

    refetch:
      fetchAlerts,

    markRead:
      (alertId: string) =>
        updateAlert(
          alertId,
          'read',
        ),

    acknowledge:
      (alertId: string) =>
        updateAlert(
          alertId,
          'acknowledge',
        ),

    markAllRead,
  };
}