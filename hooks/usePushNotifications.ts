"use client";

import {
  useState,
  useEffect,
  useCallback,
} from "react";

function applicationKey(
  value: string
): Uint8Array<ArrayBuffer> {
  const raw = atob(
    value
      .replace(/-/g, "+")
      .replace(/_/g, "/") +
      "=".repeat(
        (4 - (value.length % 4)) % 4
      )
  );

  const bytes =
    new Uint8Array(raw.length);

  for (
    let i = 0;
    i < raw.length;
    i++
  ) {
    bytes[i] =
      raw.charCodeAt(i);
  }

  return bytes;
}

async function api(body: object) {
  const response = await fetch(
    "/api/push/subscribe",
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const result =
    await response.json();

  if (
    !response.ok ||
    !result.success
  ) {
    throw new Error(
      result.error ||
        "Unable to update notifications."
    );
  }

  return result;
}

async function registration() {
  await navigator.serviceWorker.register(
    "/sw.js",
    {
      scope: "/",
      updateViaCache: "none",
    }
  );

  return Promise.race([
    navigator.serviceWorker.ready,

    new Promise<never>(
      (_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                "The app is still preparing. Please try again."
              )
            ),
          15000
        );
      }
    ),
  ]);
}

export function usePushNotifications() {
  const [supported, setSupported] =
    useState(false);

  const [subscribed, setSubscribed] =
    useState(false);

  const [permission, setPermission] =
    useState<NotificationPermission>(
      "default"
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const refresh =
    useCallback(async () => {
      if (
        !window.isSecureContext ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        return;
      }

      setSupported(true);

      setPermission(
        Notification.permission
      );

      try {
        const reg =
          await registration();

        const sub =
          await reg.pushManager.getSubscription();

        if (!sub) {
          setSubscribed(false);
          return;
        }

        if (
          Notification.permission ===
          "denied"
        ) {
          await api({
            action: "remove",
            endpoint: sub.endpoint,
          });

          await sub.unsubscribe();

          setSubscribed(false);
          return;
        }

        const result = await api({
          action: "status",
          endpoint: sub.endpoint,
        });

        /*
         * Retire a browser subscription
         * that no longer belongs to the
         * currently signed-in account.
         */
        if (!result.subscribed) {
          await sub.unsubscribe();
        }

        setSubscribed(
          result.subscribed &&
            Notification.permission ===
              "granted"
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to check device notifications."
        );
      }
    }, []);

  useEffect(() => {
    void refresh();

    const onVisible = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void refresh();
      }
    };

    document.addEventListener(
      "visibilitychange",
      onVisible
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        onVisible
      );
    };
  }, [refresh]);

  const subscribe =
    useCallback(async () => {
      if (!supported) return;

      setError(null);
      setLoading(true);

      try {
        /*
         * This must run directly from the
         * user's button click.
         */
        const granted =
          await Notification.requestPermission();

        setPermission(granted);

        if (
          granted !== "granted"
        ) {
          throw new Error(
            granted === "denied"
              ? "Notifications are blocked. Allow them in your browser or device settings."
              : "Permission was not granted. You can try again when ready."
          );
        }

        const reg =
          await registration();

        const keyResponse =
          await fetch(
            "/api/push/vapid-public-key",
            {
              cache: "no-store",
            }
          );

        const { publicKey } =
          await keyResponse.json();

        if (
          !keyResponse.ok ||
          !publicKey
        ) {
          throw new Error(
            "Device notifications are not configured yet."
          );
        }

        const key =
          applicationKey(publicKey);

        let sub =
          await reg.pushManager.getSubscription();

        if (
          sub?.options
            .applicationServerKey
        ) {
          const existing =
            new Uint8Array(
              sub.options
                .applicationServerKey
            );

          const changed =
            existing.length !==
              key.length ||
            existing.some(
              (byte, i) =>
                byte !== key[i]
            );

          if (changed) {
            await api({
              action: "remove",
              endpoint: sub.endpoint,
            });

            await sub.unsubscribe();

            sub = null;
          }
        }

        sub ??=
          await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key,
          });

        await api(sub.toJSON());

        setSubscribed(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to enable notifications."
        );
      } finally {
        setLoading(false);
      }
    }, [supported]);

  const unsubscribe =
    useCallback(async () => {
      setError(null);
      setLoading(true);

      try {
        const reg =
          await navigator.serviceWorker.getRegistration(
            "/"
          );

        const sub =
          await reg?.pushManager.getSubscription();

        if (sub) {
          await api({
            action: "remove",
            endpoint: sub.endpoint,
          });

          const removed =
            await sub.unsubscribe();

          if (!removed) {
            throw new Error(
              "Device delivery was disabled. Please reload to refresh browser status."
            );
          }
        }

        setSubscribed(false);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to disable notifications."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  return {
    supported,
    subscribed,
    permission,
    loading,
    error,
    subscribe,
    unsubscribe,
  };
}