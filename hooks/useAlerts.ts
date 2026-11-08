'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  AlertData,
} from '@/lib/interfaces/data/Alert';

function popupEligible(
  alert: AlertData,
) {
  return (
    alert.popupShown === false &&
    !alert.isRead &&
    alert.status === 'UNREAD' &&
    alert.channels.inApp !== false
  );
}

/*
 * Only the bell enables popups.
 * Other consumers can display/read alerts normally.
 */
export function useAlerts(
  limit = 50,
  enablePopups = false,
) {
  const [alerts, setAlerts] =
    useState<AlertData[]>([]);

  const [unreadCount, setUnreadCount] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [connected, setConnected] =
    useState(false);

  const [
    popupCandidates,
    setPopupCandidates,
  ] = useState<AlertData[]>([]);

  const alive = useRef(false);
  const version = useRef(0);
  const unreadCurrent = useRef(0);

  const mergeCandidates = useCallback(
    (incoming: AlertData[]) => {
      if (!enablePopups) {
        return;
      }

      setPopupCandidates(
        (previous) => {
          const byId = new Map(
            previous.map(
              (item) => [
                item._id,
                item,
              ],
            ),
          );

          for (
            const item of incoming
          ) {
            if (
              popupEligible(item)
            ) {
              byId.set(
                item._id,
                item,
              );
            } else {
              byId.delete(
                item._id,
              );
            }
          }

          return [
            ...byId.values(),
          ].sort(
            (first, second) =>
              new Date(
                first.createdAt,
              ).getTime() -
              new Date(
                second.createdAt,
              ).getTime(),
          );
        },
      );
    },
    [enablePopups],
  );

  const fetchAlerts = useCallback(
    async (): Promise<AlertData[]> => {
      const started =
        ++version.current;

      const response = await fetch(
        `/api/alerts?limit=${limit}`,
        { cache: 'no-store' },
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

      const next =
        json.data.alerts as AlertData[];

      if (
        alive.current &&
        started === version.current
      ) {
        setAlerts(next);

        unreadCurrent.current =
          json.data.unreadCount;

        setUnreadCount(
          json.data.unreadCount,
        );

        mergeCandidates(next);
        setError(null);
      }

      return next;
    },
    [limit, mergeCandidates],
  );

  useEffect(() => {
    alive.current = true;

    let disposed = false;

    let source:
      EventSource | null = null;

    const refresh = async () => {
      try {
        await fetchAlerts();
      } catch (cause) {
        if (!disposed) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Failed to refresh alerts.',
          );
        }
      }
    };

    const visible = () => {
      if (
        document.visibilityState ===
        'visible'
      ) {
        void refresh();
      }
    };

    const changed = () => {
      void refresh();
    };

    const start = async () => {
      let initial:
        AlertData[] = [];

      try {
        initial =
          await fetchAlerts();
      } catch (cause) {
        if (!disposed) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Failed to load alerts.',
          );
        }
      }

      if (disposed) {
        return;
      }

      setLoading(false);

      if (
        typeof EventSource ===
        'undefined'
      ) {
        return;
      }

      /*
       * Retain the overlap to avoid missing an alert
       * between the initial fetch and stream setup.
       *
       * Replays are safely merged and never directly
       * trigger a popup or increment the badge.
       */
      const after =
        initial[0]
          ? new Date(
              new Date(
                initial[0].createdAt,
              ).getTime() - 1,
            ).toISOString()
          : new Date(
              Date.now() - 1_000,
            ).toISOString();

      source = new EventSource(
        `/api/alerts/stream?after=${
          encodeURIComponent(after)
        }`,
      );

      source.addEventListener(
        'connected',
        () => {
          if (!disposed) {
            setConnected(true);
          }
        },
      );

      source.addEventListener(
        'alert',
        (event) => {
          if (disposed) {
            return;
          }

          try {
            const incoming =
              JSON.parse(
                (
                  event as MessageEvent
                ).data,
              ) as AlertData;

            version.current += 1;

            setAlerts(
              (previous) =>
                [
                  incoming,

                  ...previous.filter(
                    (item) =>
                      item._id !==
                      incoming._id,
                  ),
                ]
                  .sort(
                    (first, second) =>
                      new Date(
                        second.createdAt,
                      ).getTime() -
                      new Date(
                        first.createdAt,
                      ).getTime(),
                  )
                  .slice(0, limit),
            );

            mergeCandidates([
              incoming,
            ]);

            /*
             * No count increment here.
             * The stream sends the actual database
             * unread count in its unread event.
             */
          } catch {
            void refresh();
          }
        },
      );

      source.addEventListener(
        'unread',
        (event) => {
          if (disposed) {
            return;
          }

          try {
            const count =
              JSON.parse(
                (
                  event as MessageEvent
                ).data,
              ).unreadCount as number;

            const changedCount =
              count !==
              unreadCurrent.current;

            unreadCurrent.current =
              count;

            setUnreadCount(count);

            /*
             * A read in another session should refresh
             * visible read states, not just the badge.
             */
            if (changedCount) {
              void refresh();
            }
          } catch {
            void refresh();
          }
        },
      );

      source.onerror = () => {
        if (!disposed) {
          setConnected(false);
        }
      };
    };

    void start();

    const timer = setInterval(
      visible,
      30_000,
    );

    window.addEventListener(
      'focus',
      changed,
    );

    window.addEventListener(
      'medicationAlertsUpdated',
      changed,
    );

    document.addEventListener(
      'visibilitychange',
      visible,
    );

    return () => {
      disposed = true;
      alive.current = false;
      version.current += 1;

      source?.close();
      clearInterval(timer);

      window.removeEventListener(
        'focus',
        changed,
      );

      window.removeEventListener(
        'medicationAlertsUpdated',
        changed,
      );

      document.removeEventListener(
        'visibilitychange',
        visible,
      );
    };
  }, [
    fetchAlerts,
    limit,
    mergeCandidates,
  ]);

  const claimPopup = useCallback(
    async (
      alertId: string,
    ): Promise<AlertData | null> => {
      try {
        const response = await fetch(
          `/api/alerts/${alertId}`,
          {
            method: 'PATCH',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              action: 'claimPopup',
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
            'Failed to claim alert popup.',
          );
        }

        const updated =
          json.data.alert as
            AlertData | null;

        if (
          alive.current &&
          updated
        ) {
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
        }

        return json.data.claimed
          ? updated
          : null;
      } finally {
        /*
         * A failed claim is not displayed.
         * A later REST refresh can retry if the
         * persisted alert remains eligible.
         */
        if (alive.current) {
          setPopupCandidates(
            (previous) =>
              previous.filter(
                (item) =>
                  item._id !== alertId,
              ),
          );
        }
      }
    },
    [],
  );

  const updateAlert = useCallback(
    async (
      alertId: string,
      action:
        | 'read'
        | 'acknowledge',
    ) => {
      const response = await fetch(
        `/api/alerts/${alertId}`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
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

      version.current += 1;

      if (alive.current) {
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

        setPopupCandidates(
          (previous) =>
            previous.filter(
              (item) =>
                item._id !== alertId,
            ),
        );
      }

      /*
       * Refresh all mounted consumers from the saved
       * database state, including the badge count.
       */
      window.dispatchEvent(
        new Event(
          'medicationAlertsUpdated',
        ),
      );

      return updated;
    },
    [],
  );

  const markAllRead = useCallback(
    async () => {
      const response = await fetch(
        '/api/alerts',
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            action: 'markAllRead',
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

      version.current += 1;

      if (alive.current) {
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
                      status: 'READ',
                      isRead: true,
                      readAt: now,
                    },
            ),
        );

        setPopupCandidates([]);

        unreadCurrent.current = 0;
        setUnreadCount(0);
      }

      window.dispatchEvent(
        new Event(
          'medicationAlertsUpdated',
        ),
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
    popupCandidates,
    claimPopup,

    refetch:
      fetchAlerts,

    markRead:
      (id: string) =>
        updateAlert(id, 'read'),

    acknowledge:
      (id: string) =>
        updateAlert(
          id,
          'acknowledge',
        ),

    markAllRead,
  };
}