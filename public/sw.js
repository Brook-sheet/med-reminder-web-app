/*
 * Only public offline assets are cached.
 * Medical pages and APIs stay network-only.
 */

const CACHE = "rxbox-public-v1";
const OFFLINE = "/pwa/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          OFFLINE,
          "/pwa/icon-192.png",
        ])
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith(
                  "rxbox-public-"
                ) && key !== CACHE
            )
            .map((key) =>
              caches.delete(key)
            )
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    event.request.mode !== "navigate"
  ) {
    return;
  }

  if (
    new URL(event.request.url).origin !==
    self.location.origin
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE)
    )
  );
});

function internalUrl(value) {
  try {
    const url = new URL(
      typeof value === "string"
        ? value
        : "/",
      self.location.origin
    );

    return url.origin ===
      self.location.origin
      ? url.href
      : self.location.origin + "/";
  } catch {
    return self.location.origin + "/";
  }
}

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data
      ? event.data.json()
      : {};
  } catch {
    payload = {
      body: event.data.text(),
    };
  }

  if (
    !payload ||
    typeof payload !== "object"
  ) {
    payload = {};
  }

  const data = {
    ...(payload.data || {}),
    ...payload,
  };

  const identity =
    data.messageId ||
    data.alertId ||
    data.eventId ||
    data.logId;

  const tag = identity
    ? `rxbox-${data.type || "notice"}-${identity}`
    : undefined;

  event.waitUntil(
    self.registration.showNotification(
      payload.title || "Rx Box",
      {
        body:
          payload.body ||
          "You have a new notification. Open Rx Box to view it.",

        icon: "/pwa/icon-192.png",

        ...(tag ? { tag } : {}),

        requireInteraction:
          data.type === "due_alarm" ||
          data.severity === "CRITICAL",

        data: {
          url: internalUrl(data.url),
          type: data.type,
        },

        actions: [
          {
            action: "view",
            title: "Open Rx Box",
          },
          {
            action: "dismiss",
            title: "Dismiss",
          },
        ],
      }
    )
  );
});

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    if (event.action === "dismiss") {
      return;
    }

    const url = internalUrl(
      event.notification.data?.url
    );

    event.waitUntil(
      (async () => {
        const windows =
          await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
          });

        for (const client of windows) {
          if (
            new URL(client.url).origin !==
            self.location.origin
          ) {
            continue;
          }

          try {
            const navigated =
              await client.navigate(url);

            if (navigated) {
              return await navigated.focus();
            }
          } catch {
            // Try another window or open a new one.
          }
        }

        return self.clients.openWindow(url);
      })()
    );
  }
);

/*
 * Renew using the existing application server key.
 * Permission is never requested from this worker.
 */
self.addEventListener(
  "pushsubscriptionchange",
  (event) => {
    event.waitUntil(
      (async () => {
        const key =
          event.oldSubscription?.options
            .applicationServerKey;

        if (!key) return;

        const subscription =
          event.newSubscription ||
          (await self.registration.pushManager.subscribe(
            {
              userVisibleOnly: true,
              applicationServerKey: key,
            }
          ));

        const response = await fetch(
          "/api/push/subscribe",
          {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              ...subscription.toJSON(),
              action: "renew",
            }),
          }
        );

        if (!response.ok) {
          await subscription.unsubscribe();
        }
      })()
    );
  }
);