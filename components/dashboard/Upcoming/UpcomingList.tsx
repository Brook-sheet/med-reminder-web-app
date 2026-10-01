"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

import UpcomingItem from "./UpcomingItem";

import {
  addDaysToMedicationDateKey,
  formatMedicationDateLabel,
} from "@/lib/medicationTime";

interface UpcomingItemData {
  medicineId: string;
  medicineName: string;
  dosage: string;
  notes?: string;
  scheduledDate: string;
  scheduledDateFormatted: string;
  scheduledTime: string;
  status: "Upcoming" | "Scheduled";
  logId?: string;
}

interface ScheduleRange {
  today: string;
  earliestDate: string;
  startDate: string;
  endDate: string | null;
  timeZone: string;
}

interface UpcomingResponse {
  success: boolean;
  data?: UpcomingItemData[];
  range?: ScheduleRange;
  error?: string;
}

interface UpcomingData {
  items: UpcomingItemData[];
  range: ScheduleRange;
}

interface RequestState {
  url: string;
  data: UpcomingData | null;
  error: string;
}

const PREVIEW_LIMIT = 4;

const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 " +
  "rounded-xl border border-border px-3 py-2 text-sm " +
  "font-medium text-gray-700 transition-colors " +
  "hover:bg-gray-100 focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-blue-500 " +
  "focus-visible:ring-offset-2 disabled:cursor-not-allowed " +
  "disabled:opacity-50 dark:text-gray-200 " +
  "dark:hover:bg-gray-800";

function useUpcoming(url: string) {
  const [retryVersion, setRetryVersion] = useState(0);

  const [state, setState] = useState<RequestState>({
    url,
    data: null,
    error: "",
  });

  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;

    async function load() {
      controller?.abort();

      const currentController = new AbortController();
      controller = currentController;

      try {
        const response = await fetch(url, {
          cache: "no-store",
          signal: currentController.signal,
        });

        const payload =
          (await response.json()) as UpcomingResponse;

        if (
          !response.ok ||
          !payload.success ||
          !Array.isArray(payload.data) ||
          !payload.range
        ) {
          throw new Error(
            payload.error ||
              "Unable to load upcoming medications.",
          );
        }

        if (
          disposed ||
          currentController.signal.aborted
        ) {
          return;
        }

        setState({
          url,
          data: {
            items: payload.data,
            range: payload.range,
          },
          error: "",
        });
      } catch (error) {
        if (
          disposed ||
          currentController.signal.aborted
        ) {
          return;
        }

        setState((previous) => ({
          url,
          data:
            previous.url === url
              ? previous.data
              : null,
          error:
            error instanceof Error
              ? error.message
              : "Unable to load upcoming medications.",
        }));
      }
    }

    void load();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load();
      }
    }, 60_000);

    const refresh = () => {
      void load();
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };

    window.addEventListener("focus", refresh);

    window.addEventListener(
      "medicineScheduleChanged",
      refresh,
    );

    window.addEventListener(
      "dashboardRefresh",
      refresh,
    );

    document.addEventListener(
      "visibilitychange",
      refreshWhenVisible,
    );

    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(interval);

      window.removeEventListener("focus", refresh);

      window.removeEventListener(
        "medicineScheduleChanged",
        refresh,
      );

      window.removeEventListener(
        "dashboardRefresh",
        refresh,
      );

      document.removeEventListener(
        "visibilitychange",
        refreshWhenVisible,
      );
    };
  }, [url, retryVersion]);

  const matchesCurrentUrl = state.url === url;

  const data = matchesCurrentUrl ? state.data : null;
  const error = matchesCurrentUrl ? state.error : "";

  function retry() {
    setState((previous) => ({
      url,
      data:
        previous.url === url
          ? previous.data
          : null,
      error: "",
    }));

    setRetryVersion((previous) => previous + 1);
  }

  return {
    data,
    error,
    loading: !data && !error,
    retry,
  };
}

function ScheduleSkeleton() {
  return (
    <div role="status" className="space-y-3">
      <span className="sr-only">
        Loading upcoming medications
      </span>

      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          aria-hidden="true"
          className="h-20 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

function ScheduleError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30"
    >
      <p className="text-sm text-red-700 dark:text-red-300">
        {message}
      </p>

      <button
        type="button"
        onClick={onRetry}
        className="mt-2 min-h-11 rounded-lg px-2 text-sm font-semibold text-red-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300"
      >
        Try again
      </button>
    </div>
  );
}

function dateLabel(date: string) {
  return formatMedicationDateLabel(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function itemKey(item: UpcomingItemData) {
  return [
    item.medicineId,
    item.scheduledDate,
    item.scheduledTime,
  ].join(":");
}

function ScheduleDialog({
  initialEarliestDate,
  onClose,
}: {
  initialEarliestDate: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const [requestedStart, setRequestedStart] = useState(
    initialEarliestDate,
  );

  const url =
    "/api/upcoming?excludeToday=1&startDate=" +
    encodeURIComponent(requestedStart);

  const { data, loading, error, retry } =
    useUpcoming(url);

  const earliestDate =
    data?.range.earliestDate ?? initialEarliestDate;

  const startDate =
    data?.range.startDate ?? requestedStart;

  const endDate =
    data?.range.endDate ??
    addDaysToMedicationDateKey(startDate, 6);

  const groups = new Map<string, UpcomingItemData[]>();

  for (const item of data?.items ?? []) {
    const group = groups.get(item.scheduledDate);

    if (group) {
      group.push(item);
    } else {
      groups.set(item.scheduledDate, [item]);
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;

    dialog.showModal();
    document.body.style.overflow = "hidden";

    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;

      if (previousFocus?.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  function showPreviousWeek() {
    const previous = addDaysToMedicationDateKey(
      startDate,
      -7,
    );

    setRequestedStart(
      previous < earliestDate
        ? earliestDate
        : previous,
    );
  }

  function showNextWeek() {
    setRequestedStart(
      addDaysToMedicationDateKey(endDate, 1),
    );
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-auto h-dvh max-h-dvh w-screen max-w-none overflow-hidden border-0 bg-card p-0 text-gray-900 shadow-2xl backdrop:bg-slate-950/50 dark:text-white sm:h-[min(85dvh,800px)] sm:max-h-[85dvh] sm:w-[calc(100%_-_3rem)] sm:max-w-3xl sm:rounded-[28px] sm:border sm:border-border"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-border p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id={titleId}
                className="text-xl font-bold sm:text-2xl"
              >
                Upcoming schedule
              </h2>

              <p
                id={descriptionId}
                className="mt-1 text-sm text-gray-500 dark:text-gray-400"
              >
                Browse doses from tomorrow onward.
                Today&apos;s doses remain in Today&apos;s Schedule.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close upcoming schedule"
              className={`${buttonClass} shrink-0 px-3`}
            >
              <X
                className="h-5 w-5"
                aria-hidden="true"
              />
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div aria-live="polite">
              <p className="text-sm font-semibold">
                {dateLabel(startDate)} – {dateLabel(endDate)}
              </p>

              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {data?.range.timeZone
                  ? `Schedule time zone: ${data.range.timeZone}`
                  : "Loading schedule…"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={showPreviousWeek}
                disabled={
                  loading || startDate <= earliestDate
                }
                aria-label="Previous seven days"
                className={buttonClass}
              >
                <ChevronLeft
                  className="h-4 w-4"
                  aria-hidden="true"
                />
                Previous
              </button>

              <button
                type="button"
                onClick={showNextWeek}
                disabled={loading}
                aria-label="Next seven days"
                className={buttonClass}
              >
                Next
                <ChevronRight
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          {startDate > earliestDate && (
            <button
              type="button"
              onClick={() =>
                setRequestedStart(earliestDate)
              }
              className="mt-2 min-h-11 rounded-lg px-1 text-sm font-medium text-blue-600 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400"
            >
              Back to first 7 days
            </button>
          )}
        </div>

        <div
          key={requestedStart}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6"
          aria-busy={loading}
        >
          {error && (
            <div className="mb-4">
              <ScheduleError
                message={error}
                onRetry={retry}
              />
            </div>
          )}

          {loading ? (
            <ScheduleSkeleton />
          ) : data && data.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
              <CalendarDays
                className="mx-auto h-8 w-8 text-gray-400"
                aria-hidden="true"
              />

              <p className="mt-3 text-sm font-semibold">
                No upcoming doses in this date range.
              </p>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Use Next to browse a later week.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from(groups.entries()).map(
                ([date, items]) => (
                  <section key={date}>
                    <h3 className="mb-3 text-sm font-bold text-gray-700 dark:text-gray-200">
                      {date === earliestDate
                        ? `Tomorrow · ${dateLabel(date)}`
                        : formatMedicationDateLabel(date, {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                    </h3>

                    <div className="space-y-3">
                      {items.map((item) => (
                        <UpcomingItem
                          key={itemKey(item)}
                          name={`${item.medicineName} ${item.dosage}`.trim()}
                          time={item.scheduledTime}
                          date={item.scheduledDateFormatted}
                          note={item.notes}
                          status={item.status}
                        />
                      ))}
                    </div>
                  </section>
                ),
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border bg-card px-4 py-3 sm:px-6">
          <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            Showing the selected date range. Future doses
            follow your current medicine schedules and may
            change when you edit a medicine.
          </p>
        </div>
      </div>
    </dialog>
  );
}

export default function UpcomingList() {
  const { data, loading, error, retry } =
    useUpcoming("/api/upcoming?preview=1");

  const [dialogOpen, setDialogOpen] = useState(false);

  const preview =
    data?.items.slice(0, PREVIEW_LIMIT) ?? [];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Upcoming
        </h2>

        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          disabled={!data}
          aria-haspopup="dialog"
          className={buttonClass}
        >
          <CalendarDays
            className="h-4 w-4"
            aria-hidden="true"
          />
          View schedule
        </button>
      </div>

      {error && (
        <div className="mb-4">
          <ScheduleError
            message={error}
            onRetry={retry}
          />
        </div>
      )}

      {loading ? (
        <ScheduleSkeleton />
      ) : data && preview.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No doses scheduled after today.
          Today&apos;s doses are listed in Today&apos;s Schedule.
        </p>
      ) : (
        <div className="space-y-3">
          {preview.map((item) => (
            <UpcomingItem
              key={itemKey(item)}
              name={`${item.medicineName} ${item.dosage}`.trim()}
              time={item.scheduledTime}
              date={item.scheduledDateFormatted}
              note={item.notes}
              status={item.status}
            />
          ))}
        </div>
      )}

      {preview.length > 0 && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Your next {preview.length} scheduled{" "}
          {preview.length === 1 ? "dose" : "doses"} after
          today. Use View schedule to browse by week.
        </p>
      )}

      {dialogOpen && data && (
        <ScheduleDialog
          initialEarliestDate={data.range.earliestDate}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
}