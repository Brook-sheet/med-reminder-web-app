"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import {
  createPortal,
} from "react-dom";

import {
  usePathname,
} from "next/navigation";

import {
  Download,
  Share,
  X,
} from "lucide-react";

import {
  usePwaInstall,
} from "@/hooks/usePwaInstall";

const DISMISSED_KEY =
  "rxbox-install-banner-dismissed";

interface Props {
  variant?:
    | "navigation"
    | "banner"
    | "settings";

  className?: string;

  onAction?: () => void;
}

export default function PwaInstall({
  variant = "navigation",
  className = "",
  onAction,
}: Props) {
  const pwa =
    usePwaInstall();

  const pathname =
    usePathname();

  const [dismissed, setDismissed] =
    useState<boolean | null>(null);

  const [
    instructions,
    setInstructions,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const dialog =
    useRef<HTMLDivElement>(null);

  const heading =
    useId();

  const description =
    useId();

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(
        localStorage.getItem(
          DISMISSED_KEY
        ) === "1"
      );
    } catch {
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    if (
      !instructions ||
      pwa.installed
    ) {
      return;
    }

    const previousFocus =
      document.activeElement as
        HTMLElement | null;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    dialog.current?.focus();

    const keydown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key === "Escape"
      ) {
        setInstructions(false);
        return;
      }

      if (
        event.key !== "Tab"
      ) {
        return;
      }

      const buttons =
        dialog.current?.querySelectorAll<HTMLElement>(
          'button, a[href], [tabindex="0"]'
        );

      if (!buttons?.length) {
        return;
      }

      const first =
        buttons[0];

      const last =
        buttons[
          buttons.length - 1
        ];

      if (
        event.shiftKey &&
        (
          document.activeElement ===
            first ||
          document.activeElement ===
            dialog.current
        )
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (
          document.activeElement ===
            last ||
          document.activeElement ===
            dialog.current
        )
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener(
      "keydown",
      keydown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      document.removeEventListener(
        "keydown",
        keydown
      );

      if (
        previousFocus?.isConnected
      ) {
        previousFocus.focus();
      }
    };
  }, [
    instructions,
    pwa.installed,
  ]);

  async function install() {
    onAction?.();

    setError("");

    try {
      const result =
        await pwa.install();

      if (
        result === "instructions"
      ) {
        setInstructions(true);
      }
    } catch {
      setError(
        "The install prompt could not open. You can use the browser menu below."
      );

      setInstructions(true);
    }
  }

  function dismiss() {
    setDismissed(true);

    try {
      localStorage.setItem(
        DISMISSED_KEY,
        "1"
      );
    } catch {
      // Dismiss for this visit.
    }
  }

  if (
    !pwa.ready ||
    pwa.installed
  ) {
    return null;
  }

  if (
    variant === "banner" &&
    (
      dismissed !== false ||
      ![
        "/",
        "/monitor",
      ].includes(pathname)
    )
  ) {
    return null;
  }

  const buttonClass =
    variant === "navigation"
      ? "group flex w-full items-center gap-3 rounded-3xl border border-blue-200/80 bg-blue-50/80 px-4 py-3 text-left font-semibold text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/50"
      : "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

  const button = (
    <button
      type="button"
      onClick={() =>
        void install()
      }
      disabled={pwa.busy}
      aria-busy={pwa.busy}
      className={`${buttonClass} disabled:opacity-60 ${
        variant !== "banner"
          ? className
          : ""
      }`}
    >
      <Download
        size={
          variant === "navigation"
            ? 22
            : 18
        }
        strokeWidth={1.75}
        aria-hidden="true"
      />

      {pwa.busy
        ? "Opening…"
        : variant === "banner"
        ? "Install App"
        : "Install Rx Box"}
    </button>
  );

  return (
    <>
      {variant === "banner" ? (
        <section
          aria-label="Install Rx Box"
          className={`relative mx-6 mb-2 flex flex-col gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 pr-12 text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100 sm:flex-row sm:items-center sm:justify-between ${className}`}
        >
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-white p-2.5 text-blue-600 dark:bg-blue-900/50 dark:text-blue-200">
              <Download
                size={22}
                aria-hidden="true"
              />
            </span>

            <div>
              <p className="font-semibold">
                Install Rx Box
              </p>

              <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">
                Access your pillbox app
                from your home screen.
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {button}
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install banner"
            className="absolute right-2 top-2 rounded-lg p-2 text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-200 dark:hover:bg-blue-900"
          >
            <X
              size={18}
              aria-hidden="true"
            />
          </button>
        </section>
      ) : (
        button
      )}

      {instructions &&
        createPortal(
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/50 p-4"
            onClick={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setInstructions(
                  false
                );
              }
            }}
          >
            <div
              ref={dialog}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby={
                heading
              }
              aria-describedby={
                description
              }
              className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 text-foreground shadow-2xl outline-none"
            >
              <button
                type="button"
                onClick={() =>
                  setInstructions(
                    false
                  )
                }
                aria-label="Close installation instructions"
                className="absolute right-3 top-3 rounded-lg p-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <X
                  size={20}
                  aria-hidden="true"
                />
              </button>

              <Download
                className="mb-4 text-blue-600"
                size={30}
                aria-hidden="true"
              />

              <h2
                id={heading}
                className="pr-6 text-xl font-bold"
              >
                Install Rx Box
              </h2>

              <div
                id={description}
                className="mt-3 space-y-3 text-sm text-muted-foreground"
              >
                {error && (
                  <p role="status">
                    {error}
                  </p>
                )}

                {pwa.ios ? (
                  <>
                    <p>
                      Open Rx Box in
                      Safari, then:
                    </p>

                    <ol className="list-decimal space-y-2 pl-5">
                      <li>
                        Tap{" "}
                        <Share
                          size={15}
                          className="inline"
                          aria-hidden="true"
                        />{" "}
                        <strong>
                          Share
                        </strong>
                        .
                      </li>

                      <li>
                        Select{" "}
                        <strong>
                          Add to Home Screen
                        </strong>
                        . It may be under{" "}
                        <strong>
                          More
                        </strong>
                        .
                      </li>

                      <li>
                        Tap{" "}
                        <strong>
                          Add
                        </strong>
                        , then open Rx Box
                        from its new icon.
                      </li>
                    </ol>
                  </>
                ) : (
                  <>
                    <p>
                      Open your browser
                      menu and select{" "}
                      <strong>
                        Install Rx Box
                      </strong>
                      ,{" "}
                      <strong>
                        Install app
                      </strong>
                      , or{" "}
                      <strong>
                        Add to Home screen
                      </strong>
                      , when available.
                    </p>

                    <p>
                      On desktop Chrome or
                      Edge, you can also
                      look for an install
                      icon near the
                      address bar. If your
                      browser has no
                      install option, try
                      opening Rx Box in
                      Chrome or Edge.
                    </p>
                  </>
                )}

                <p>
                  After installation,
                  open Settings in Rx Box
                  to enable device
                  notifications.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setInstructions(
                    false
                  )
                }
                className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Got it
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}