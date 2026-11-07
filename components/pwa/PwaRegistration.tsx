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
      "serviceWorker" in navigator &&
      window.isSecureContext
    ) {
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
    }

    return stopListening;
  }, []);

  return null;
}