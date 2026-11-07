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
      .then(() =>
        self.skipWaiting()
      )
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
                ) &&
                key !== CACHE
            )
            .map((key) =>
              caches.delete(key)
            )
        )
      )
      .then(() =>
        self.clients.claim()
      )
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

        icon:
          "/pwa/icon-192.png",

        ...(tag
          ? { tag }
          : {}),

        requireInteraction:
          data.type === "due_alarm" ||
          data.severity === "CRITICAL",

        data: {
          url:
            internalUrl(data.url),

          type:
            data.type,
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

/*
 * Ask a page whether it is running
 * as an installed app.
 *
 * A timeout prevents suspended pages
 * from blocking notification clicks.
 */
function isStandaloneClient(client) {
  return new Promise((resolve) => {
    const channel =
      new MessageChannel();

    let finished = false;

    const finish = (value) => {
      if (finished) return;

      finished = true;

      clearTimeout(timeout);

      channel.port1.close();
      channel.port2.close();

      resolve(value);
    };

    const timeout = setTimeout(
      () => finish(false),
      500
    );

    channel.port1.onmessage = (
      event
    ) => {
      finish(
        event.data?.standalone ===
          true
      );
    };

    try {
      client.postMessage(
        {
          type:
            "RXBOX_GET_WINDOW_MODE",
        },
        [
          channel.port2,
        ]
      );
    } catch {
      finish(false);
    }
  });
}

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    if (
      event.action === "dismiss"
    ) {
      return;
    }

    const url = internalUrl(
      event.notification.data?.url
    );

    event.waitUntil(
      (async () => {
        const windows = (
          await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
          })
        ).filter(
          (client) =>
            new URL(client.url).origin ===
            self.location.origin
        );

        const modes =
          await Promise.all(
            windows.map(
              isStandaloneClient
            )
          );

        /*
         * Prefer an installed app window
         * over a normal browser tab.
         */
        for (
          let index = 0;
          index < windows.length;
          index++
        ) {
          if (!modes[index]) {
            continue;
          }

          const client =
            windows[index];

          try {
            const focused =
              await client.focus();

            if (
              client.url === url
            ) {
              return focused;
            }

            const navigated =
              await client.navigate(
                url
              );

            if (navigated) {
              return await navigated.focus();
            }
          } catch {
            // Try another installed window.
          }
        }

        /*
         * Give the browser a chance to
         * route the URL into its installed
         * PWA instead of selecting a tab.
         */
        try {
          const opened =
            await self.clients.openWindow(
              url
            );

          if (opened) {
            return await opened.focus();
          }

          return;
        } catch {
          /*
           * Browser-tab fallback if
           * opening a window fails.
           */
          for (
            const client of windows
          ) {
            try {
              const navigated =
                await client.navigate(
                  url
                );

              if (navigated) {
                return await navigated.focus();
              }
            } catch {
              // Try the next available window.
            }
          }
        }
      })()
    );
  }
);

/*
 * Renew using the existing server key.
 * Permission is never requested here.
 */
self.addEventListener(
  "pushsubscriptionchange",
  (event) => {
    event.waitUntil(
      (async () => {
        const key =
          event.oldSubscription
            ?.options
            .applicationServerKey;

        if (!key) return;

        const subscription =
          event.newSubscription ||
          (
            await self.registration.pushManager.subscribe(
              {
                userVisibleOnly: true,
                applicationServerKey:
                  key,
              }
            )
          );

        const response =
          await fetch(
            "/api/push/subscribe",
            {
              method: "POST",

              credentials:
                "same-origin",

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