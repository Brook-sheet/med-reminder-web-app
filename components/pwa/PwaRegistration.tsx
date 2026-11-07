"use client";

import {
  useEffect,
} from "react";

import {
  initializePwaInstall,
} from "@/hooks/usePwaInstall";

export type {
  InstallEvent,
} from "@/hooks/usePwaInstall";

export default function PwaRegistration() {
  useEffect(() => {
    const stopListening =
      initializePwaInstall();

    if (
      !("serviceWorker" in navigator) ||
      !window.isSecureContext
    ) {
      return stopListening;
    }

    /*
     * Let the service worker distinguish
     * an installed app window from
     * a regular browser tab.
     */
    const onMessage = (
      event: MessageEvent
    ) => {
      if (
        event.data?.type !==
        "RXBOX_GET_WINDOW_MODE"
      ) {
        return;
      }

      const port =
        event.ports[0];

      if (!port) return;

      const appleStandalone = (
        navigator as Navigator & {
          standalone?: boolean;
        }
      ).standalone;

      const standalone =
        window.matchMedia(
          "(display-mode: standalone)"
        ).matches ||
        window.matchMedia(
          "(display-mode: fullscreen)"
        ).matches ||
        window.matchMedia(
          "(display-mode: minimal-ui)"
        ).matches ||
        Boolean(appleStandalone);

      port.postMessage({
        standalone,
      });

      port.close();
    };

    navigator.serviceWorker.addEventListener(
      "message",
      onMessage
    );

    navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .catch((error) => {
        console.error(
          "[PWA] Registration failed:",
          error
        );
      });

    return () => {
      stopListening();

      navigator.serviceWorker.removeEventListener(
        "message",
        onMessage
      );
    };
  }, []);

  return null;
}