
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AlertTriangle,
  Box,
  RefreshCw,
} from "lucide-react";

interface LoadingItem {
  chamberId: number;
  medicineId?: string;
  logId?: string;
  medicineName: string;
  dosage: string;
  pillUnit: number;
  pillsPerDose: number;
  scheduledTime: string;
}

interface RxBoxPlan {
  success: true;
  planId: string;
  date: string;
  hardwareDispensingEnabled: boolean;

  capacity: {
    used?: number;
    required: number;
    maximum: number;
    exceeded: boolean;
  };

  loadingPlan: LoadingItem[];
  proposedLoadingItems: LoadingItem[];

  message: string;
}

interface ChamberGroup {
  chamberId: number;
  items: LoadingItem[];
  scheduledTimes: string[];
  totalPills: number;
}

const CHAMBER_IDS = [1, 2, 3, 4];

function getChamberGroups(
  items: LoadingItem[]
): ChamberGroup[] {
  return CHAMBER_IDS.map(
    (chamberId) => {
      const chamberItems =
        items.filter(
          (item) =>
            item.chamberId === chamberId
        );

      const scheduledTimes = [
        ...new Set(
          chamberItems.map(
            (item) =>
              item.scheduledTime
          )
        ),
      ];

      /*
       * Each medicine/log should contribute
       * its pill quantity only once.
       *
       * This prevents counting duplicate
       * loading entries as extra tablets.
       */
      const uniqueDoses =
        new Map<string, LoadingItem>();

      for (const item of chamberItems) {
        const key =
          item.logId ??
          `${item.medicineId ?? item.medicineName}:${item.scheduledTime}`;

        if (!uniqueDoses.has(key)) {
          uniqueDoses.set(
            key,
            item
          );
        }
      }

      const totalPills =
        Array.from(
          uniqueDoses.values()
        ).reduce(
          (sum, item) =>
            sum +
            item.pillsPerDose,
          0
        );

      return {
        chamberId,
        items: chamberItems,
        scheduledTimes,
        totalPills,
      };
    }
  );
}

export default function RxBoxLoadingOrder() {
  const [
    plan,
    setPlan,
  ] = useState<RxBoxPlan | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    assignmentsChanged,
    setAssignmentsChanged,
  ] = useState(false);

  const previousPlanId =
    useRef("");

  const fetchPlan =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              "/api/rx-box/today",
              {
                cache: "no-store",
              }
            );

          const data =
            await response.json();

          if (!data.success) {
            throw new Error(
              data.error ||
                "Unable to load the Rx Box plan."
            );
          }

          /*
           * HTTP 409 may contain a valid
           * structured plan with an invalid
           * chamber configuration.
           */
          if (
            !response.ok &&
            response.status !== 409
          ) {
            throw new Error(
              data.error ||
                "Unable to load the Rx Box plan."
            );
          }

          if (
            previousPlanId.current &&
            previousPlanId.current !==
              data.planId
          ) {
            setAssignmentsChanged(
              true
            );
          }

          previousPlanId.current =
            data.planId;

          setPlan(data);
          setError("");
        } catch (
          fetchError
        ) {
          setError(
            fetchError instanceof
              Error
              ? fetchError.message
              : "Unable to load the Rx Box plan."
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    fetchPlan();

    const handleScheduleChange =
      () => {
        setLoading(true);
        fetchPlan();
      };

    window.addEventListener(
      "medicineScheduleChanged",
      handleScheduleChange
    );

    return () => {
      window.removeEventListener(
        "medicineScheduleChanged",
        handleScheduleChange
      );
    };
  }, [fetchPlan]);

  /*
   * When the plan is invalid, display the
   * proposed assignments for inspection.
   *
   * The hardware will not receive those
   * assignments until they are corrected.
   */
  const displayedItems =
    plan?.capacity.exceeded
      ? plan.proposedLoadingItems
      : plan?.loadingPlan ?? [];

  const chamberGroups =
    getChamberGroups(
      displayedItems
    );

  const hasInvalidPlan =
    !!plan &&
    (
      plan.capacity.exceeded ||
      !plan.hardwareDispensingEnabled
    );

  return (
    <section className="mb-6 rounded-[28px] border border-border/80 bg-card p-6 shadow-sm shadow-slate-900/10">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Box className="h-6 w-6 text-blue-600 dark:text-blue-400" />

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Today&apos;s Rx Box
              Loading Order
            </h2>
          </div>

          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Load the medicines into
            their manually selected
            chambers before the
            scheduled dispensing time.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchPlan();
          }}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading
                ? "animate-spin"
                : ""
            }`}
          />

          Refresh plan
        </button>
      </div>

      {hasInvalidPlan && (
        <div className="mb-4 flex gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

          <div>
            <p className="font-semibold">
              Invalid Rx Box
              chamber configuration
            </p>

            <p className="mt-1 text-sm">
              {plan.message}
            </p>

            <p className="mt-2 text-xs">
              Hardware dispensing
              is disabled until
              the assignments
              are corrected.
            </p>
          </div>
        </div>
      )}

      {assignmentsChanged && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          The Rx Box plan has
          changed. Check the
          selected chambers and
          reload the physical
          dispenser before the
          next scheduled dose.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border/80">
        {chamberGroups.map(
          (group) => {
            const hasMedicines =
              group.items.length >
              0;

            const hasTimeConflict =
              group.scheduledTimes
                .length > 1;

            return (
              <div
                key={
                  group.chamberId
                }
                className="grid grid-cols-1 gap-3 border-b border-border/70 px-4 py-4 last:border-b-0 sm:grid-cols-[110px_1fr_auto] sm:items-start"
              >
                <div>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    Chamber{" "}
                    {
                      group.chamberId
                    }
                  </span>
                </div>

                {loading &&
                !plan ? (
                  <div className="h-5 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                ) : hasMedicines ? (
                  <>
                    <div className="min-w-0 space-y-2">
                      {group.items.map(
                        (
                          item,
                          index
                        ) => (
                          <div
                            key={
                              item.logId ??
                              `${item.medicineId}-${index}`
                            }
                            className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60"
                          >
                            <p className="font-medium text-gray-800 dark:text-gray-100">
                              {
                                item.medicineName
                              }{" "}
                              {
                                item.dosage
                              }
                            </p>

                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {
                                item.pillsPerDose
                              }{" "}
                              {item.pillsPerDose ===
                              1
                                ? "pill"
                                : "pills"}{" "}
                              per
                              scheduled
                              dose
                            </p>
                          </div>
                        )
                      )}

                      {group.items.length >
                        1 && (
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Shared chamber:
                          these medicines
                          are assigned
                          together.
                        </p>
                      )}

                      {hasTimeConflict && (
                        <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                          Conflict:
                          different
                          dispensing times
                          are using this
                          chamber.
                        </p>
                      )}
                    </div>

                    <div className="text-sm font-medium text-blue-700 dark:text-blue-300 sm:text-right">
                      {group.scheduledTimes.map(
                        (time) => (
                          <p
                            key={time}
                          >
                            {time}
                          </p>
                        )
                      )}
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Unassigned
                  </span>
                )}
              </div>
            );
          }
        )}
      </div>

      {plan && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span>
            Chambers used:{" "}
            {
              plan.capacity
                .required
            }{" "}
            /{" "}
            {
              plan.capacity
                .maximum
            }
          </span>

          <span>
            Plan date:{" "}
            {plan.date}
          </span>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        Each physical chamber
        is intended to open
        once during the daily
        refill cycle. Multiple
        pills or medicines may
        share one chamber only
        when they are scheduled
        for the same time and
        can be dispensed safely.
        Confirm that the
        medicines physically
        fit before loading.
      </p>
    </section>
  );
}
