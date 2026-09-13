"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const ROUTE_START_EVENT = "rx:route-start";

/**
 * Call this right before a programmatic navigation
 * (router.push / router.replace) so the bar starts immediately.
 */
export function startRouteProgress() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ROUTE_START_EVENT));
}

/**
 * A single, app-wide navigation indicator.
 *
 * It is the ONLY thing that appears during a route change — pages never
 * render their own "navigating…" spinner. Combined with the route-level
 * loading.tsx skeletons, every navigation feels identical.
 */
export default function RouteProgress() {
  const pathname = usePathname();

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const tickRef = useRef<number | null>(null);
  const hideRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }

    if (hideRef.current !== null) {
      window.clearTimeout(hideRef.current);
      hideRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (activeRef.current) return;

    activeRef.current = true;
    clearTimers();
    setVisible(true);
    setProgress(8);

    // Ease towards 90% — never completes on its own.
    tickRef.current = window.setInterval(() => {
      setProgress((current) =>
        current >= 90 ? current : current + Math.max(0.8, (92 - current) * 0.08)
      );
    }, 90);
  }, [clearTimers]);

  const done = useCallback(() => {
    if (!activeRef.current) return;

    activeRef.current = false;
    clearTimers();
    setProgress(100);

    hideRef.current = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 280);
  }, [clearTimers]);

  // Any same-origin link click kicks the bar off.
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const node = event.target as Element | null;
      const anchor = node?.closest?.("a");

      if (!anchor) return;

      const href = anchor.getAttribute("href");

      if (
        !href ||
        anchor.hasAttribute("download") ||
        anchor.getAttribute("target") === "_blank" ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }

      let url: URL;

      try {
        url = new URL((anchor as HTMLAnchorElement).href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;

      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      start();
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener(ROUTE_START_EVENT, start);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener(ROUTE_START_EVENT, start);
    };
  }, [start]);

  // The new pathname landing means the navigation finished.
  useEffect(() => {
    done();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => clearTimers, [clearTimers]);

  return (
    <div className="rx-route-progress" aria-hidden="true">
      <div
        className="rx-route-progress__bar"
        style={{
          transform: `scaleX(${progress / 100})`,
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}