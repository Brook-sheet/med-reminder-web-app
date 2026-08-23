// hooks/useChatNotifications.ts
'use client';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

const POLL_MS = 8000;

/**
 * Polls the unread chat message count and, when it increases:
 * - shows a browser notification when permission is granted
 * - updates the document title with the unread count
 * - sets the experimental App Badge where supported
 */
export function useChatNotifications() {
  const [unreadCount, setUnreadCount] =
    useState(0);

  const [permission, setPermission] =
    useState<
      NotificationPermission | 'unsupported'
    >('default');

  const prevCountRef = useRef(0);

  const originalTitleRef =
    useRef<string | null>(null);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPermission('unsupported');
      return;
    }

    setPermission(
      Notification.permission
    );

    originalTitleRef.current =
      document.title;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(
          '/api/chats/unread-count'
        );

        const result =
          await response.json();

        if (
          cancelled ||
          !result.success
        ) {
          return;
        }

        const count: number =
          result.data.unreadCount;

        setUnreadCount(count);

        if (
          originalTitleRef.current !==
          null
        ) {
          document.title =
            count > 0
              ? `(${
                  count > 99
                    ? '99+'
                    : count
                }) ${
                  originalTitleRef.current
                }`
              : originalTitleRef.current;
        }

        const navigation =
          navigator as Navigator & {
            setAppBadge?: (
              number?: number
            ) => Promise<void>;
            clearAppBadge?: () => Promise<void>;
          };

        try {
          if (
            count > 0 &&
            navigation.setAppBadge
          ) {
            void navigation.setAppBadge(
              count
            );
          } else if (
            navigation.clearAppBadge
          ) {
            void navigation.clearAppBadge();
          }
        } catch {
          // App Badge API is unavailable.
        }

        if (
          count >
            prevCountRef.current &&
          typeof Notification !==
            'undefined' &&
          Notification.permission ===
            'granted' &&
          document.visibilityState ===
            'hidden'
        ) {
          try {
            const notification =
              new Notification(
                'New chat message',
                {
                  body:
                    'You have a new message in Med App Reminder.',
                  icon: '/icon.png',
                  tag: 'med-app-chat',
                }
              );

            notification.onclick = () => {
              window.focus();
              notification.close();
            };
          } catch {
            // Notification can throw in unsupported contexts.
          }
        }

        prevCountRef.current = count;
      } catch {
        // Network error is ignored. Polling will retry.
      }
    };

    void poll();

    const interval = setInterval(
      poll,
      POLL_MS
    );

    const handleRequestsUpdated = () =>
      void poll();

    window.addEventListener(
      'chat-requests-updated',
      handleRequestsUpdated
    );

    return () => {
      cancelled = true;
      clearInterval(interval);

      window.removeEventListener(
        'chat-requests-updated',
        handleRequestsUpdated
      );

      if (
        originalTitleRef.current !==
        null
      ) {
        document.title =
          originalTitleRef.current;
      }
    };
  }, []);

  const requestPermission = async () => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window)
    ) {
      return;
    }

    const result =
      await Notification.requestPermission();

    setPermission(result);
  };

  return {
    unreadCount,
    permission,
    requestPermission,
  };
}