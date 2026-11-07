"use client";

import {
  useSyncExternalStore,
} from "react";

export interface InstallEvent extends Event {
  prompt(): Promise<void>;

  userChoice: Promise<{
    outcome:
      | "accepted"
      | "dismissed";
  }>;
}

declare global {
  interface Window {
    rxBoxInstallPrompt?: InstallEvent;
  }
}

interface InstallState {
  ready: boolean;
  installed: boolean;
  ios: boolean;
  busy: boolean;
  prompt: InstallEvent | null;
}

const serverState: InstallState = {
  ready: false,
  installed: false,
  ios: false,
  busy: false,
  prompt: null,
};

let state = serverState;

const subscribers =
  new Set<() => void>();

function publish(
  next: Partial<InstallState>
) {
  state = {
    ...state,
    ...next,
  };

  subscribers.forEach(
    (listener) => listener()
  );
}

function subscribe(
  listener: () => void
) {
  subscribers.add(listener);

  return () => {
    subscribers.delete(listener);
  };
}

export function initializePwaInstall() {
  const standalone =
    window.matchMedia(
      "(display-mode: standalone)"
    );

  let installedHere = false;

  const update = () => {
    const appleStandalone = (
      navigator as Navigator & {
        standalone?: boolean;
      }
    ).standalone;

    publish({
      ready:
        window.isSecureContext &&
        "serviceWorker" in navigator,

      installed:
        installedHere ||
        standalone.matches ||
        Boolean(appleStandalone),

      ios:
        /iPad|iPhone|iPod/.test(
          navigator.userAgent
        ) ||
        (
          navigator.platform ===
            "MacIntel" &&
          navigator.maxTouchPoints > 1
        ),

      prompt:
        window.rxBoxInstallPrompt ||
        null,
    });
  };

  const capture = (
    event: Event
  ) => {
    event.preventDefault();

    window.rxBoxInstallPrompt =
      event as InstallEvent;

    publish({
      prompt:
        event as InstallEvent,
    });
  };

  const installed = () => {
    installedHere = true;

    delete window.rxBoxInstallPrompt;

    publish({
      installed: true,
      prompt: null,
      busy: false,
    });
  };

  window.addEventListener(
    "beforeinstallprompt",
    capture
  );

  window.addEventListener(
    "appinstalled",
    installed
  );

  window.addEventListener(
    "focus",
    update
  );

  standalone.addEventListener(
    "change",
    update
  );

  update();

  return () => {
    window.removeEventListener(
      "beforeinstallprompt",
      capture
    );

    window.removeEventListener(
      "appinstalled",
      installed
    );

    window.removeEventListener(
      "focus",
      update
    );

    standalone.removeEventListener(
      "change",
      update
    );
  };
}

export async function requestPwaInstall(): Promise<
  | "accepted"
  | "dismissed"
  | "instructions"
> {
  const prompt = state.prompt;

  if (!prompt || state.ios) {
    return "instructions";
  }

  if (state.busy) {
    return "dismissed";
  }

  publish({
    busy: true,
  });

  // A native install prompt can only be used once.
  delete window.rxBoxInstallPrompt;

  publish({
    prompt: null,
  });

  try {
    await prompt.prompt();

    const choice =
      await prompt.userChoice;

    return choice.outcome;
  } finally {
    publish({
      busy: false,
    });
  }
}

export function usePwaInstall() {
  const snapshot =
    useSyncExternalStore(
      subscribe,
      () => state,
      () => serverState
    );

  return {
    ...snapshot,
    install:
      requestPwaInstall,
  };
}