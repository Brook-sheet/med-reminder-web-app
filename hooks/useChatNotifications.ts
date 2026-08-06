// hooks/useChatNotifications.ts
'use client';

import { useEffect, useRef, useState } from 'react';

const POLL_MS = 8000;

/**
 * Polls the unread chat message count and, when it increases:
 *  - shows a browser notification (if permission granted and tab is hidden)
 *  - updates the document title with the unread count
 *  - sets the experimental App Badge (navigator.setAppBadge), where supported
 */
export function useChatNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const prevCountRef = useRef(0);
  const originalTitleRef = useRef<string | null>(null);

  // `Notification.permission` is a browser-only API with no server-side
  // equivalent, so its real value can only be read after mount — reading it
  // during render would desync server/client output and break hydration.
  // This effect is a one-time "subscribe to external (browser) state" read,
  // which is the documented exception to the set-state-in-effect rule.
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);
    originalTitleRef.current = document.title;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch('/api/chats/unread-count');
        const json = await res.json();
        if (cancelled || !json.success) return;

        const count: number = json.data.unreadCount;
        setUnreadCount(count);

        // Update tab title
        if (originalTitleRef.current !== null) {
          document.title = count > 0 ? `(${count > 99 ? '99+' : count}) ${originalTitleRef.current}` : originalTitleRef.current;
        }

        // Update experimental app badge if supported
        const nav = navigator as Navigator & {
          setAppBadge?: (n?: number) => Promise<void>;
          clearAppBadge?: () => Promise<void>;
        };
        try {
          if (count > 0 && nav.setAppBadge) {
            void nav.setAppBadge(count);
          } else if (nav.clearAppBadge) {
            void nav.clearAppBadge();
          }
        } catch {
          // App Badge API not available in this browser — safe to ignore
        }

        // Fire a browser notification only when the count went UP and the tab
        // isn't currently focused/visible, so we don't spam an active user.
        if (
          count > prevCountRef.current &&
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted' &&
          document.visibilityState === 'hidden'
        ) {
          try {
            const n = new Notification('New chat message', {
              body: 'You have a new message in Med App Reminder.',
              icon: '/icon.png',
              tag: 'med-app-chat',
            });
            n.onclick = () => {
              window.focus();
              n.close();
            };
          } catch {
            // Notification constructor can throw in some contexts — ignore
          }
        }

        prevCountRef.current = count;
      } catch {
        // Network error while polling unread count — ignore, will retry
      }
    };

    void poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (originalTitleRef.current !== null) document.title = originalTitleRef.current;
    };
  }, []);

  const requestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  return { unreadCount, permission, requestPermission };
}