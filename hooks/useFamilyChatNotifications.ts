'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

export interface FamilyChatNotification {
  _id: string;
  conversationId: string;
  messageId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface Snapshot {
  notifications:
    FamilyChatNotification[];

  unreadCount:
    number;
}

export function useFamilyChatNotifications() {
  const [data, setData] =
    useState<Snapshot>({
      notifications: [],
      unreadCount: 0,
    });

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [connected, setConnected] =
    useState(false);

  const alive = useRef(false);
  const connectedRef = useRef(false);
  const version = useRef(0);

  const refresh = useCallback(
    async () => {
      const started =
        ++version.current;

      try {
        const response = await fetch(
          '/api/chats/notifications',
          { cache: 'no-store' },
        );

        const result =
          await response.json();

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.error ||
            'Unable to load chat notifications.',
          );
        }

        /*
         * Ignore old requests if a newer stream
         * snapshot or refresh has already arrived.
         */
        if (
          alive.current &&
          started === version.current
        ) {
          setData(result.data);
          setError(null);
          setLoading(false);
        }
      } catch (cause) {
        if (
          alive.current &&
          started === version.current
        ) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Unable to load chat notifications.',
          );

          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    alive.current = true;

    let source:
      EventSource | null = null;

    let disposed = false;

    const setConnection = (
      value: boolean,
    ) => {
      if (disposed) {
        return;
      }

      connectedRef.current =
        value;

      if (alive.current) {
        setConnected(value);
      }
    };

    if (
      typeof EventSource !==
      'undefined'
    ) {
      source = new EventSource(
        '/api/chats/notifications?stream=1',
      );

      source.addEventListener(
        'connected',
        () =>
          setConnection(true),
      );

      source.addEventListener(
        'snapshot',
        (event) => {
          if (
            disposed ||
            !alive.current
          ) {
            return;
          }

          try {
            const next = JSON.parse(
              (
                event as MessageEvent
              ).data,
            ) as Snapshot;

            version.current += 1;

            /*
             * Replace the snapshot instead of
             * appending items or incrementing
             * counts for repeated events.
             */
            setData(next);
            setError(null);
            setLoading(false);
            setConnection(true);
          } catch {
            void refresh();
          }
        },
      );

      source.addEventListener(
        'server-error',
        () => {
          if (disposed) {
            return;
          }

          setConnection(false);
          void refresh();
        },
      );

      source.onerror = () => {
        if (disposed) {
          return;
        }

        setConnection(false);
        void refresh();

        /*
         * EventSource reconnects automatically.
         * The server sends a fresh snapshot.
         */
      };
    } else {
      void refresh();
    }

    const fallback = setInterval(
      () => {
        if (
          !connectedRef.current &&
          document.visibilityState ===
            'visible'
        ) {
          void refresh();
        }
      },
      10_000,
    );

    const focus = () =>
      void refresh();

    const visible = () => {
      if (
        document.visibilityState ===
        'visible'
      ) {
        void refresh();
      }
    };

    window.addEventListener(
      'focus',
      focus,
    );

    document.addEventListener(
      'visibilitychange',
      visible,
    );

    return () => {
      disposed = true;
      alive.current = false;
      connectedRef.current = false;
      version.current += 1;

      source?.close();

      clearInterval(fallback);

      window.removeEventListener(
        'focus',
        focus,
      );

      document.removeEventListener(
        'visibilitychange',
        visible,
      );
    };
  }, [refresh]);

  const markAllRead = useCallback(
    async () => {
      const response = await fetch(
        '/api/chats/notifications',
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

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
          'Unable to mark chat notifications read.',
        );
      }

      await refresh();
    },
    [refresh],
  );

  return {
    ...data,
    loading,
    error,
    connected,
    markAllRead,
  };
}