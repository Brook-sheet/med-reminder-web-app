import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

export const PUSH_COOKIE =
  "rxbox_push_device";

export function deviceBinding(
  endpoint: string
) {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is required."
    );
  }

  return createHmac(
    "sha256",
    process.env.JWT_SECRET
  )
    .update(endpoint)
    .digest("hex");
}

export function bindingMatches(
  endpoint: string,
  binding: string | undefined
) {
  if (!binding) return false;

  const expected = Buffer.from(
    deviceBinding(endpoint)
  );

  const supplied =
    Buffer.from(binding);

  return (
    expected.length === supplied.length &&
    timingSafeEqual(expected, supplied)
  );
}

export function validSubscription(
  value: unknown
): value is {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
} {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const sub = value as {
    endpoint?: unknown;
    keys?: {
      p256dh?: unknown;
      auth?: unknown;
    };
  };

  if (
    typeof sub.endpoint !== "string" ||
    sub.endpoint.length > 2048
  ) {
    return false;
  }

  try {
    const url =
      new URL(sub.endpoint);

    const hosts = [
      "fcm.googleapis.com",
      "updates.push.services.mozilla.com",
    ];

    const allowedHost =
      hosts.includes(url.hostname) ||
      url.hostname.endsWith(
        ".push.apple.com"
      ) ||
      url.hostname.endsWith(
        ".notify.windows.com"
      );

    if (
      url.protocol !== "https:" ||
      url.port ||
      url.username ||
      url.password ||
      !allowedHost
    ) {
      return false;
    }

    return (
      typeof sub.keys?.p256dh ===
        "string" &&
      typeof sub.keys?.auth ===
        "string" &&
      /^[A-Za-z0-9_-]+$/.test(
        sub.keys.p256dh
      ) &&
      /^[A-Za-z0-9_-]+$/.test(
        sub.keys.auth
      ) &&
      Buffer.from(
        sub.keys.p256dh,
        "base64url"
      ).length === 65 &&
      Buffer.from(
        sub.keys.auth,
        "base64url"
      ).length === 16
    );
  } catch {
    return false;
  }
}