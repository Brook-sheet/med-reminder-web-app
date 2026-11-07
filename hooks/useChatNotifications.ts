"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  usePushNotifications,
} from "@/hooks/usePushNotifications";

const POLL_MS = 8000;

export function useChatNotifications() {
  const devicePush =
    usePushNotifications();

  const [unreadCount, setUnreadCount] =
    useState(0);

  const [permission, setPermission] =
    useState<
      NotificationPermission |
      "unsupported"
    >("default");

  const originalTitle =
    useRef<string | null>(null);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPermission("unsupported");
      return;
    }

    setPermission(
      Notification.permission
    );

    originalTitle.current =
      document.title;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const response =
          await fetch(
            "/api/chats/unread-count"
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
          originalTitle.current !==
          null
        ) {
          document.title =
            count > 0
              ? `(${count > 99 ? "99+" : count}) ${originalTitle.current}`
              : originalTitle.current;
        }

        const navigation =
          navigator as Navigator & {
            setAppBadge?: (
              number?: number
            ) => Promise<void>;
            clearAppBadge?:
              () => Promise<void>;
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
          // Badging is optional.
        }
      } catch {
        // The next poll retries.
      }
    };

    void poll();

    const interval =
      setInterval(
        poll,
        POLL_MS
      );

    const updated = () =>
      void poll();

    window.addEventListener(
      "chat-requests-updated",
      updated
    );

    return () => {
      cancelled = true;

      clearInterval(interval);

      window.removeEventListener(
        "chat-requests-updated",
        updated
      );

      if (
        originalTitle.current !==
        null
      ) {
        document.title =
          originalTitle.current;
      }
    };
  }, []);

  const requestPermission =
    async () => {
      if (
        typeof window ===
          "undefined" ||
        !("Notification" in window)
      ) {
        return;
      }

      await devicePush.subscribe();

      setPermission(
        Notification.permission
      );
    };

  return {
    unreadCount,
    permission,
    requestPermission,
  };
}