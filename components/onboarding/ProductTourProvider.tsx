"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/Toast";
import NotificationManager from "@/components/notifications/NotificationManager";
import { TourOverlay } from "./TourOverlay";
import {
  availableTours,
  buildTour,
  homeFor,
  welcomeFor,
  type TourId,
  type TourRole,
  type TourStatus,
  type TourStep,
} from "./tour-config";

type Phase =
  | "closed"
  | "welcome"
  | "starting"
  | "tour"
  | "complete";

type Outcome = "skipped" | "completed";

interface Preference {
  userId: string;
  role: TourRole;
  ready: boolean;
  status: TourStatus;
}

const TourContext = createContext<{
  launch: (id: TourId) => void;
  role: TourRole;
  preferencePending: boolean;
  retryPreference: () => void;
} | null>(null);

const TourActiveContext = createContext(false);

const API = "/api/onboarding";

async function preferences(
  signal?: AbortSignal,
): Promise<Preference> {
  const response = await fetch(API, {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(String(response.status));
  }

  return response.json();
}

export function ProductTourProvider({
  userId,
  role,
  children,
}: {
  userId: string;
  role: TourRole;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [phase, setPhase] = useState<Phase>("closed");
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [preferencePending, setPreferencePending] = useState(false);

  const selectedTour = useRef<TourId>("general");
  const checked = useRef(false);
  const session = useRef(0);
  const mounted = useRef(true);
  const pending = useRef<Outcome | null>(null);
  const syncing = useRef(false);

  const expectedRoute = useRef<string | null>(null);
  const arrivingFrom = useRef<string | null>(null);

  const home = homeFor(role);
  const storageKey = `rx-product-tour-pending:${userId}:${role}`;

  const sync = useCallback(async () => {
    const outcome = pending.current;

    if (!outcome || syncing.current) return;

    syncing.current = true;

    try {
      const response = await fetch(API, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          role,
          status: outcome,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (
        response.status === 401 ||
        response.status === 409
      ) {
        return;
      }

      if (!response.ok) {
        throw new Error("save");
      }

      if (pending.current === outcome) {
        pending.current = null;

        if (mounted.current) {
          setPreferencePending(false);
        }

        try {
          localStorage.removeItem(storageKey);
        } catch {
          // Storage may be disabled.
        }
      }
    } catch {
      // Keep the account-scoped retry queue. Background saves must not
      // display a new error toast on every login or page refresh.
      // Settings shows the pending state without interrupting app usage.
    } finally {
      syncing.current = false;
    }
  }, [userId, role, storageKey]);

  const record = useCallback(
    (outcome: Outcome) => {
      checked.current = true;
      setPreferencePending(true);

      pending.current =
        pending.current === "completed"
          ? "completed"
          : outcome;

      try {
        localStorage.setItem(storageKey, pending.current);
      } catch {
        // Server persistence remains primary.
      }

      void sync();
    },
    [storageKey, sync],
  );

  const close = useCallback(
    (
      outcome: Outcome = "skipped",
      returnHome = false,
    ) => {
      session.current += 1;
      expectedRoute.current = null;

      document.cookie =
        "rx_product_tour=; Path=/api; Max-Age=0; SameSite=Lax";

      setPhase("closed");

      // Detailed page tours never change general onboarding.
      if (selectedTour.current === "general") {
        record(outcome);
      }

      if (
        returnHome &&
        selectedTour.current === "general"
      ) {
        router.replace(home);
      }
    },
    [home, record, router],
  );

  useEffect(() => {
    mounted.current = true;

    try {
      const saved = localStorage.getItem(storageKey);

      if (
        saved === "skipped" ||
        saved === "completed"
      ) {
        pending.current = saved;
        setPreferencePending(true);
        checked.current = true;
      }
    } catch {
      // Private browsing may disallow storage.
    }

    void sync();

    const interval = setInterval(
      () => void sync(),
      30_000,
    );

    const online = () => void sync();

    window.addEventListener("online", online);

    return () => {
      mounted.current = false;
      session.current += 1;

      clearInterval(interval);
      window.removeEventListener("online", online);
    };
  }, [storageKey, sync]);

  // Preserve the existing automatic onboarding behavior.
  // It only starts on the user's landing page.
  useEffect(() => {
    if (
      pathname !== home ||
      phase !== "closed" ||
      checked.current
    ) {
      return;
    }

    const controller = new AbortController();

    void preferences(controller.signal)
      .then((data) => {
        if (
          controller.signal.aborted ||
          data.userId !== userId ||
          data.role !== role ||
          !data.ready
        ) {
          return;
        }

        checked.current = true;

        if (
          data.status === "not_started" &&
          !pending.current
        ) {
          setPhase("welcome");
        }
      })
      .catch(() => {
        // Preference errors must not block the application.
      });

    return () => controller.abort();
  }, [pathname, home, phase, userId, role]);

  const start = useCallback(
    async (tour: TourId = "general") => {
      if (
        !availableTours(role).some(
          (item) => item.id === tour,
        )
      ) {
        return;
      }

      selectedTour.current = tour;

      const token = ++session.current;

      checked.current = true;

      document.cookie =
        `rx_product_tour=${userId}; Path=/api; Max-Age=90; SameSite=Lax`;

      setPhase("starting");

      try {
        const current = await preferences(
          AbortSignal.timeout(8000),
        );

        if (
          !mounted.current ||
          session.current !== token
        ) {
          return;
        }

        if (
          current.userId !== userId ||
          current.role !== role ||
          !current.ready
        ) {
          setPhase("closed");

          toast.error(
            "Finish your profile setup and sign in with the current account before replaying the tour.",
          );

          return;
        }

        let patientId: string | undefined;

        if (role === "family") {
          try {
            const response = await fetch(
              "/api/patient/monitor",
              {
                cache: "no-store",
                signal: AbortSignal.timeout(8000),
              },
            );

            if (response.ok) {
              const result = await response.json();

              const requests: Array<{
                status: string;
                patient?: {
                  patientId?: string;
                };
              }> = result.data?.requests ?? [];

              patientId = requests.find(
                (request) =>
                  request.status === "approved" &&
                  request.patient?.patientId,
              )?.patient?.patientId;
            }
          } catch {
            // Connection-dependent sections are optional.
          }
        }

        if (
          !mounted.current ||
          session.current !== token
        ) {
          return;
        }

        const planned = buildTour(
          role,
          patientId,
          tour,
        );

        if (!planned.length) {
          setPhase("closed");

          toast.info(
            "An approved patient connection is needed for the patient report tour.",
          );

          return;
        }

        setSteps(planned);
        setIndex(0);
        setPhase("tour");
      } catch {
        if (
          mounted.current &&
          session.current === token
        ) {
          setPhase("closed");

          toast.error(
            "Unable to start the tour. Please try Take a Tour Again in Settings.",
          );
        }
      }
    },
    [userId, role],
  );

  const active = phase !== "closed";

  // Preserve the previous tour's temporary read-only hint.
  useEffect(() => {
    if (!active) return;

    const refresh = () => {
      document.cookie =
        `rx_product_tour=${userId}; Path=/api; Max-Age=90; SameSite=Lax`;
    };

    const clear = () => {
      document.cookie =
        "rx_product_tour=; Path=/api; Max-Age=0; SameSite=Lax";
    };

    refresh();

    const timer = setInterval(refresh, 30_000);

    window.addEventListener("pagehide", clear);

    return () => {
      clearInterval(timer);
      clear();
      window.removeEventListener("pagehide", clear);
    };
  }, [active, userId]);

  const step = steps[index];

  useEffect(() => {
    if (phase !== "tour" || !step) return;

    arrivingFrom.current =
      window.location.pathname +
      window.location.search;

    expectedRoute.current = step.route;

    if (arrivingFrom.current !== step.route) {
      router.replace(step.route, {
        scroll: false,
      });
    }
  }, [phase, step, router]);

  // Browser Back/Forward ends the current tour.
  useEffect(() => {
    if (phase === "closed") return;

    const leave = () => close();

    window.addEventListener("popstate", leave);

    return () => {
      window.removeEventListener("popstate", leave);
    };
  }, [phase, close]);

  useEffect(() => {
    if (
      phase === "welcome" &&
      pathname !== home
    ) {
      close();
      return;
    }

    if (
      phase !== "tour" ||
      !expectedRoute.current
    ) {
      return;
    }

    const route =
      window.location.pathname +
      window.location.search;

    if (route === expectedRoute.current) {
      arrivingFrom.current = null;
    } else if (route !== arrivingFrom.current) {
      close();
    }
  }, [pathname, home, phase, close]);

  // Detect session expiry, cross-tab logout, and account changes.
  useEffect(() => {
    if (phase === "closed") return;

    const controller = new AbortController();

    const verify = async () => {
      try {
        const current = await preferences(
          controller.signal,
        );

        if (
          !controller.signal.aborted &&
          (
            current.userId !== userId ||
            current.role !== role
          )
        ) {
          session.current += 1;
          setPhase("closed");
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "401"
        ) {
          session.current += 1;
          setPhase("closed");
        }
      }
    };

    const interval = setInterval(
      () => void verify(),
      30_000,
    );

    const focus = () => void verify();

    window.addEventListener("focus", focus);

    return () => {
      controller.abort();
      clearInterval(interval);
      window.removeEventListener("focus", focus);
    };
  }, [phase, userId, role]);

  const next = useCallback(() => {
    if (index + 1 >= steps.length) {
      setPhase("complete");
    } else {
      setIndex((value) => value + 1);
    }
  }, [index, steps.length]);

  const missing = useCallback(() => {
    toast.info(
      "This section is unavailable right now. Continuing the tour.",
    );

    setSteps((current) =>
      current.filter(
        (_, position) => position !== index,
      ),
    );

    if (index >= steps.length - 1) {
      setPhase("complete");
    }
  }, [index, steps.length]);

  const replay = useCallback(() => {
    void start("general");
  }, [start]);

  const launch = useCallback(
    (id: TourId) => {
      void start(id);
    },
    [start],
  );

  const title =
    phase === "welcome" || phase === "starting"
      ? selectedTour.current === "general"
        ? "Welcome to Smart Pillbox"
        : "Preparing Your Page Tour"
      : phase === "complete"
        ? "You're All Set"
        : step?.title ?? "Product Tour";

  const description =
    phase === "welcome" || phase === "starting"
      ? selectedTour.current === "general"
        ? welcomeFor(role)
        : "We are finding the sections available to your account."
      : phase === "complete"
        ? selectedTour.current !== "general"
          ? "This page walkthrough is complete. Explore other page tours anytime from Help / Onboarding in Settings."
          : role === "patient"
            ? "You now know where to find the main features of Smart Pillbox. You can replay this tour anytime from Settings."
            : "You now know the main monitoring and communication features available to you. You can replay this tour anytime from Settings."
        : step?.description ?? "";

  return (
    <TourContext.Provider
      value={{
        launch,
        role,
        preferencePending,
        retryPreference: () => void sync(),
      }}
    >
      <TourActiveContext.Provider value={active}>
        {children}

        {phase !== "closed" && (
          <TourOverlay
            phase={phase}
            title={title}
            description={description}
            step={step}
            index={index}
            count={steps.length}
            finishLabel={
              selectedTour.current === "general" &&
              role === "patient"
                ? "Start Using Smart Pillbox"
                : "Finish"
            }
            onStart={replay}
            onSkip={() => close()}
            onNext={next}
            onPrevious={() =>
              setIndex((value) =>
                Math.max(0, value - 1),
              )
            }
            onFinish={() =>
              close("completed", true)
            }
            onMissing={missing}
          />
        )}
      </TourActiveContext.Provider>
    </TourContext.Provider>
  );
}

export function ReplayProductTour() {
  const tour = useContext(TourContext);

  const [selection, setSelection] =
    useState<TourId>("profile");

  return (
    <section
      data-tour="help"
      className="rounded-[28px] border border-border/80 bg-card p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-foreground">
        Help / Onboarding
      </h2>

      <p className="mt-2 text-sm text-muted-foreground">
        Start with the general introduction or choose a
        detailed page walkthrough. Page tours do not
        reset your onboarding status.
      </p>

      <Button
        variant="outline"
        className="mt-4 min-h-11 px-4"
        onClick={() => tour?.launch("general")}
        disabled={!tour}
      >
        Take a Tour Again
      </Button>

      {tour?.preferencePending && (
        <div
          className="mt-4 text-sm text-muted-foreground"
          role="status"
        >
          <p>
            Your tour preference is waiting to sync. We will retry automatically.
            Until it syncs, the introduction may still appear on another device.
          </p>

          <Button
            variant="outline"
            className="mt-2 min-h-11 px-4"
            onClick={tour.retryPreference}
          >
            Retry Saving Preference
          </Button>
        </div>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <label
          htmlFor="page-tour"
          className="block text-sm font-medium"
        >
          Detailed page walkthrough
        </label>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <select
            id="page-tour"
            value={selection}
            onChange={(event) =>
              setSelection(
                event.target.value as TourId,
              )
            }
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tour &&
              availableTours(tour.role)
                .filter(
                  (item) => item.id !== "general",
                )
                .map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.label}
                  </option>
                ))}
          </select>

          <Button
            className="min-h-11 px-4"
            onClick={() => tour?.launch(selection)}
            disabled={!tour}
          >
            Start Page Tour
          </Button>
        </div>

        {tour?.role === "family" && (
          <p className="mt-2 text-xs text-muted-foreground">
            Patient Reports uses an approved patient
            connection. If several are approved, the
            first available connection is used.
          </p>
        )}
      </div>
    </section>
  );
}

// Existing behavior from the previous implementation:
// pause client reminder popups while the tour is active.
// Server scheduling, device events, and SMS remain independent.
export function TourNotificationManager() {
  const active = useContext(TourActiveContext);

  return active ? null : <NotificationManager />;
}