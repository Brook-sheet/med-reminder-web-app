"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Bell,
  Download,
} from "lucide-react";

import {
  usePushNotifications,
} from "@/hooks/usePushNotifications";

import type {
  InstallEvent,
} from "@/components/pwa/PwaRegistration";

export default function PushNotificationCard() {
  const push =
    usePushNotifications();

  const [prompt, setPrompt] =
    useState<InstallEvent | null>(
      null
    );

  const [installed, setInstalled] =
    useState(false);

  const [ios, setIos] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [testing, setTesting] =
    useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia(
        "(display-mode: standalone)"
      );

    const update = () => {
      const appleStandalone =
        (
          navigator as Navigator & {
            standalone?: boolean;
          }
        ).standalone;

      setInstalled(
        standalone.matches ||
          Boolean(appleStandalone)
      );
    };

    update();

    setPrompt(
      window.rxBoxInstallPrompt ||
        null
    );

    setIos(
      /iPad|iPhone|iPod/.test(
        navigator.userAgent
      ) ||
        (
          navigator.platform ===
            "MacIntel" &&
          navigator.maxTouchPoints > 1
        )
    );

    const capture = (
      event: Event
    ) => {
      event.preventDefault();

      setPrompt(
        event as InstallEvent
      );
    };

    const done = () => {
      setPrompt(null);
      setInstalled(true);
    };

    window.addEventListener(
      "beforeinstallprompt",
      capture
    );

    window.addEventListener(
      "appinstalled",
      done
    );

    standalone.addEventListener(
      "change",
      update
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        capture
      );

      window.removeEventListener(
        "appinstalled",
        done
      );

      standalone.removeEventListener(
        "change",
        update
      );
    };
  }, []);

  async function install() {
    if (!prompt) return;

    await prompt.prompt();
    await prompt.userChoice;

    delete window.rxBoxInstallPrompt;

    setPrompt(null);
  }

  async function testPush() {
    setTesting(true);
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/push/test",
          {
            method: "POST",
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
            "Test failed."
        );
      }

      setMessage(
        "Test accepted by the push service. Check your device notifications."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Test failed."
      );
    } finally {
      setTesting(false);
    }
  }

  const button =
    "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Download size={20} />
        Install Rx Box
      </h2>

      {installed ? (
        <p className="text-sm">
          Rx Box is running as an
          installed app.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Install Rx Box for quick
            access from your home screen
            or desktop.
          </p>

          {prompt ? (
            <button
              className={button}
              onClick={() =>
                void install()
              }
            >
              Install Rx Box
            </button>
          ) : (
            <p className="text-sm">
              {ios
                ? "Open this website in Safari. Tap Share, then Add to Home Screen. Open Rx Box from its new icon."
                : "Use your browser’s Install app or Add to Home screen option when available."}
            </p>
          )}
        </>
      )}

      <h2 className="flex items-center gap-2 border-t border-border pt-4 text-lg font-semibold">
        <Bell size={20} />
        Device Notifications
      </h2>

      <p className="text-sm text-muted-foreground">
        Receive medication reminders,
        dispensing and intake updates,
        family alerts, chat messages,
        and monitoring requests while
        Rx Box is closed or in the
        background.
      </p>

      {ios && !installed ? (
        <p className="text-sm">
          On iPhone and iPad, add Rx Box
          to your Home Screen and open
          it there before enabling
          notifications. iOS/iPadOS 16.4
          or later is required.
        </p>
      ) : !push.supported ? (
        <p className="text-sm">
          Device notifications require
          HTTPS and a supported browser.
        </p>
      ) : (
        <>
          <p className="text-sm">
            {push.permission ===
            "denied"
              ? "Notifications are blocked. Allow them in your browser or device settings, then return here."
              : push.subscribed
              ? "Notifications are enabled on this device."
              : "Notifications are disabled on this device."}
          </p>

          {push.permission !==
            "denied" && (
            <button
              className={button}
              disabled={push.loading}
              onClick={() =>
                void (
                  push.subscribed
                    ? push.unsubscribe()
                    : push.subscribe()
                )
              }
            >
              {push.loading
                ? "Updating…"
                : push.subscribed
                ? "Disable Device Notifications"
                : "Enable Device Notifications"}
            </button>
          )}

          {push.subscribed && (
            <button
              className="ml-3 rounded-lg border border-border px-4 py-2 text-sm"
              disabled={testing}
              onClick={() =>
                void testPush()
              }
            >
              {testing
                ? "Sending…"
                : "Send Test Notification"}
            </button>
          )}
        </>
      )}

      {(push.error || message) && (
        <p
          role="status"
          className="text-sm"
        >
          {push.error || message}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Delivery and lock screen
        visibility depend on your
        connection, notification
        permissions, device settings,
        and Focus or battery
        restrictions. Message previews
        may show medication information.
      </p>
    </section>
  );
}