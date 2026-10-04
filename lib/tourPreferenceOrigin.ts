import type { NextRequest } from "next/server";
import { getAppOrigin } from "./appUrl";

/**
 * Use the same public URL resolution as authentication
 * when the application runs behind a proxy.
 */
export function isTourPreferenceOriginAllowed(
  request: NextRequest,
): boolean {
  const origin = request.headers.get("origin");

  if (
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return false;
  }

  // Preserve authenticated non-browser clients that do not send Origin.
  if (!origin) return true;

  try {
    const parsed = new URL(origin);

    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.origin !== origin
    ) {
      return false;
    }

    if (origin === request.nextUrl.origin) {
      return true;
    }

    return origin === getAppOrigin(request);
  } catch {
    return false;
  }
}