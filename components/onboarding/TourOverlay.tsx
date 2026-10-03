"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/Spinner";
import {
  findTourTarget,
  type TourStep,
} from "./tour-config";

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

interface Props {
  phase: "welcome" | "starting" | "tour" | "complete";
  title: string;
  description: string;
  step?: TourStep;
  index: number;
  count: number;
  finishLabel: string;
  onStart: () => void;
  onSkip: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onFinish: () => void;
  onMissing: () => void;
}

export function TourOverlay(props: Props) {
  const { step, phase, onMissing } = props;

  const [box, setBox] = useState<Box | null>(null);

  const [viewport, setViewport] = useState({
    width: 0,
    height: 0,
  });

  const [cardHeight, setCardHeight] = useState(280);

  const content = useRef<HTMLDivElement>(null);

  const previousFocus =
    useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current =
      document.activeElement as HTMLElement | null;

    const shell =
      document.querySelector<HTMLElement>(".rx-shell");

    const wasInert = shell?.inert ?? false;

    if (shell) shell.inert = true;

    return () => {
      if (shell) shell.inert = wasInert;

      const target = previousFocus.current;

      if (target?.isConnected) {
        target.focus({
          preventScroll: true,
        });
      }
    };
  }, []);

  useEffect(() => {
    const node = content.current;

    if (!node) return;

    const observer = new ResizeObserver(() => {
      setCardHeight(node.offsetHeight);
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let target: HTMLElement | null = null;
    let missingSince = Date.now();
    let closed = false;
    let openedAccount = false;

    const update = () => {
      if (closed) return;

      const measuredHeight =
        content.current?.offsetHeight ?? 280;

      setCardHeight(measuredHeight);

      const width =
        document.documentElement.clientWidth;

      const height =
        window.visualViewport?.height ??
        window.innerHeight;

      setViewport((old) =>
        old.width === width &&
        old.height === height
          ? old
          : { width, height },
      );

      if (phase !== "tour" || !step) {
        setBox(null);
        return;
      }

      const route =
        window.location.pathname +
        window.location.search;

      // Open the existing mobile drawer only when a step
      // needs the real Account section.
      if (
        route === step.route &&
        step.openAccount &&
        width < 768
      ) {
        const toggle =
          document.querySelector<HTMLButtonElement>(
            '[aria-label="Toggle navigation menu"]',
          );

        if (
          toggle?.getAttribute("aria-expanded") ===
          "false"
        ) {
          toggle.click();
          openedAccount = true;
        }
      }

      const found =
        route === step.route
          ? findTourTarget(step)
          : null;

      if (!found) {
        setBox(null);
        target = null;

        const pageReady =
          route === step.route &&
          document.querySelector(".rx-main h1") &&
          !document.querySelector(
            '.rx-main .animate-pulse, .rx-main [aria-busy="true"], .rx-main [role="status"]',
          );

        // Conditional sections can be absent for empty accounts.
        // Required sections receive a bounded loading window.
        if (
          (step.optional && pageReady) ||
          Date.now() - missingSince > 10_000
        ) {
          closed = true;
          onMissing();
        }

        return;
      }

      missingSince = Date.now();

      if (target !== found) {
        target = found;

        const rect = found.getBoundingClientRect();

        if (
          !found.closest(
            ".rx-drawer, .rx-mobile-topbar, .rx-notification-controls",
          )
        ) {
          const top = width < 768 ? 100 : 24;

          if (
            rect.top < top ||
            rect.bottom >
              height - measuredHeight - 24
          ) {
            found.scrollIntoView({
              block: "start",
              behavior: "instant",
            });

            window.scrollBy({
              top: -top,
              behavior: "instant",
            });
          }
        }
      }

      const rect = found.getBoundingClientRect();

      const x = Math.max(8, rect.left - 6);
      const y = Math.max(8, rect.top - 6);

      const bottom = Math.min(
        height - 8,
        rect.bottom + 6,
      );

      const next = {
        x,
        y,
        width: Math.max(
          0,
          Math.min(width - 8, rect.right + 6) - x,
        ),
        height: Math.max(0, bottom - y),
      };

      setBox((old) =>
        old &&
        Object.keys(next).every(
          (key) =>
            old[key as keyof Box] ===
            next[key as keyof Box],
        )
          ? old
          : next,
      );
    };

    update();

    // Observe rendered content instead of relying on a
    // fixed delay to decide when a target is ready.
    const interval = window.setInterval(update, 200);
    const observer = new MutationObserver(update);

    const shell = document.querySelector(".rx-shell");

    if (shell) {
      observer.observe(shell, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    }

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    window.visualViewport?.addEventListener(
      "resize",
      update,
    );

    return () => {
      closed = true;

      clearInterval(interval);
      observer.disconnect();

      // Restore a mobile drawer opened by this step.
      if (openedAccount) {
        const toggle =
          document.querySelector<HTMLButtonElement>(
            '[aria-label="Toggle navigation menu"]',
          );

        if (
          toggle?.getAttribute("aria-expanded") ===
          "true"
        ) {
          toggle.click();
        }
      }

      window.removeEventListener("resize", update);
      window.removeEventListener(
        "scroll",
        update,
        true,
      );

      window.visualViewport?.removeEventListener(
        "resize",
        update,
      );
    };
  }, [step, phase, onMissing]);

  useEffect(() => {
    content.current?.focus({
      preventScroll: true,
    });
  }, [step, phase]);

  const width = Math.min(
    384,
    Math.max(240, viewport.width - 24),
  );

  let left = Math.max(
    12,
    (viewport.width - width) / 2,
  );

  let top = Math.max(
    12,
    (viewport.height - cardHeight) / 2,
  );

  if (phase === "tour" && box) {
    left = Math.min(
      Math.max(12, box.x),
      Math.max(
        12,
        viewport.width - width - 12,
      ),
    );

    if (
      box.x + box.width + width + 28 <
      viewport.width
    ) {
      left = box.x + box.width + 16;
      top = box.y;
    } else if (
      box.y + box.height + cardHeight + 28 <
      viewport.height
    ) {
      top = box.y + box.height + 16;
    } else if (box.y > cardHeight + 28) {
      top = box.y - cardHeight - 16;
    } else {
      top = viewport.height - cardHeight - 12;
    }
  }

  top = Math.max(
    12,
    Math.min(
      top,
      viewport.height - cardHeight - 12,
    ),
  );

  const spotlight =
    box && phase === "tour"
      ? {
          ...box,
          height:
            left < box.x + box.width &&
            left + width > box.x &&
            top > box.y
              ? Math.min(
                  box.height,
                  Math.max(
                    0,
                    top - box.y - 12,
                  ),
                )
              : box.height,
        }
      : null;

  const waiting =
    phase === "starting" ||
    (phase === "tour" && !box);

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) props.onSkip();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1000] overflow-hidden">
          <svg
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <path
              fill="rgba(2,6,23,0.62)"
              fillRule="evenodd"
              d={
                `M0 0H${viewport.width}V${viewport.height}H0Z` +
                (spotlight
                  ? ` M${spotlight.x} ${spotlight.y}h${spotlight.width}v${spotlight.height}h-${spotlight.width}Z`
                  : "")
              }
            />

            {spotlight && (
              <rect
                x={spotlight.x}
                y={spotlight.y}
                width={spotlight.width}
                height={spotlight.height}
                rx="12"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="3"
              />
            )}
          </svg>
        </Dialog.Overlay>

        <Dialog.Content
          ref={content}
          tabIndex={-1}
          onPointerDownOutside={(event) =>
            event.preventDefault()
          }
          onInteractOutside={(event) =>
            event.preventDefault()
          }
          onCloseAutoFocus={(event) =>
            event.preventDefault()
          }
          style={{
            left,
            top,
            width,
            maxWidth: "calc(100vw - 24px)",
            maxHeight: "calc(100dvh - 24px)",
          }}
          className="fixed z-[1001] overflow-y-auto rounded-[28px] border border-border bg-card p-5 text-foreground shadow-2xl outline-none sm:p-6"
        >
          <div
            aria-live="polite"
            aria-atomic="true"
          >
            {phase === "tour" && (
              <p className="mb-2 text-xs font-semibold text-primary">
                Step {props.index + 1} of{" "}
                {props.count}
              </p>
            )}

            <Dialog.Title className="text-xl font-semibold leading-tight">
              {props.title}
            </Dialog.Title>

            <Dialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">
              {props.description}
            </Dialog.Description>
          </div>

          {waiting && (
            <div
              role="status"
              className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Spinner size="sm" />
              Loading this section…
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            {phase !== "complete" && (
              <Button
                variant="ghost"
                className="mr-auto min-h-11"
                onClick={props.onSkip}
              >
                {phase === "welcome"
                  ? "Skip for Now"
                  : "Skip Tour"}
              </Button>
            )}

            {phase === "welcome" && (
              <Button
                className="min-h-11 px-4"
                onClick={props.onStart}
              >
                Start Tour
              </Button>
            )}

            {phase === "tour" && (
              <>
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={props.index === 0}
                  onClick={props.onPrevious}
                >
                  Previous
                </Button>

                <Button
                  className="min-h-11 px-4"
                  disabled={waiting}
                  onClick={props.onNext}
                >
                  {props.index === props.count - 1
                    ? "Complete Tour"
                    : "Next"}
                </Button>
              </>
            )}

            {phase === "complete" && (
              <Button
                className="min-h-11 max-w-full whitespace-normal px-4"
                onClick={props.onFinish}
              >
                {props.finishLabel}
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}