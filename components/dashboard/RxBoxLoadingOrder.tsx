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

import {
  buildChamberRows,
} from "@/lib/rxBoxUi";

interface LoadingItem {
  chamberId: number;
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

  capacity: {
    required: number;
    maximum: number;
    exceeded: boolean;
  };

  loadingPlan:
    LoadingItem[];

  proposedLoadingItems:
    LoadingItem[];

  message: string;
}

export default function RxBoxLoadingOrder() {
  const [
    plan,
    setPlan,
  ] =
    useState<RxBoxPlan | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    assignmentsChanged,
    setAssignmentsChanged,
  ] =
    useState(false);

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
                cache:
                  "no-store",
              }
            );

          const data =
            await response.json();

          /*
           * Capacity overflow uses HTTP 409 but still returns
           * a valid structured plan for the warning UI.
           */
          if (
            !data.success
          ) {
            throw new Error(
              data.error ||
              "Unable to load the Rx Box plan."
            );
          }

          if (
            !response.ok &&
            response.status !==
              409
          ) {
            throw new Error(
              data.error ||
              "Unable to load the Rx Box plan."
            );
          }

          if (
            previousPlanId
              .current &&
            previousPlanId
              .current !==
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

  const displayedItems =
    plan?.capacity.exceeded
      ? plan.proposedLoadingItems
      : plan?.loadingPlan ??
        [];

  /*
   * Normally there are exactly 4 physical chambers, so 4 rows
   * is correct. But when capacity is exceeded, the plan's
   * "required" count is higher than 4 - and every proposed
   * item (including the one(s) that don't fit) needs its own
   * row, or the overflow banner's number won't match what's
   * actually shown in the table below it.
   */
  const rowCount = plan
    ? Math.max(
        plan.capacity.maximum,
        plan.capacity.exceeded
          ? plan.capacity.required
          : 0
      )
    : 4;

  const chamberRows =
    buildChamberRows(
      displayedItems,
      rowCount
    );

  return (
    <section className="mb-6 rounded-[28px] border border-border/80 bg-card p-6 shadow-sm shadow-slate-900/10">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Box className="h-6 w-6 text-blue-600 dark:text-blue-400" />

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Today&apos;s Rx
              Box Loading
              Order
            </h2>
          </div>

          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Refill the Rx Box
            daily using this
            exact order.
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

      {plan?.capacity
        .exceeded && (
        <div className="mb-4 flex gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

          <div>
            <p className="font-semibold">
              Rx Box capacity
              exceeded
            </p>

            <p className="mt-1 text-sm">
              {plan.message}{" "}
              Required:{" "}
              {
                plan.capacity
                  .required
              }
              ; maximum:{" "}
              {
                plan.capacity
                  .maximum
              }
              . No partial
              plan will be
              dispensed.
            </p>
          </div>
        </div>
      )}

      {assignmentsChanged && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          The medicine
          schedule changed
          the chamber
          assignments.
          Reload the
          physical Rx Box
          using the updated
          order below.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border/80">
        {chamberRows.map(
          (
            item,
            index
          ) => {
            const chamberId =
              index + 1;

            const isOverflow =
              !!plan &&
              chamberId >
                plan.capacity
                  .maximum;

            return (
              <div
                key={
                  chamberId
                }
                className={`grid grid-cols-[92px_1fr] gap-3 border-b border-border/70 px-4 py-4 last:border-b-0 sm:grid-cols-[110px_1fr_auto] sm:items-center ${
                  isOverflow
                    ? "bg-red-50 dark:bg-red-950/20"
                    : ""
                }`}
              >
                <span className="font-semibold text-gray-900 dark:text-white">
                  {isOverflow
                    ? "No chamber"
                    : `Chamber ${chamberId}`}
                </span>

                {loading &&
                !plan ? (
                  <div className="h-5 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                ) : item ? (
                  <>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-800 dark:text-gray-100">
                        {
                          item.medicineName
                        }{" "}
                        {
                          item.dosage
                        }
                        {isOverflow && (
                          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/50 dark:text-red-200">
                            Doesn&apos;t fit
                          </span>
                        )}
                      </p>

                      {item.pillsPerDose >
                        1 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Pill{" "}
                          {
                            item.pillUnit
                          }{" "}
                          of{" "}
                          {
                            item.pillsPerDose
                          }{" "}
                          for this
                          scheduled
                          dose
                        </p>
                      )}
                    </div>

                    <span className="col-start-2 text-sm font-medium text-blue-700 sm:col-start-auto dark:text-blue-300">
                      {
                        item.scheduledTime
                      }
                    </span>
                  </>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">
                    Unassigned
                  </span>
                )}
              </div>
            );
          }
        )}
      </div>

      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        If you change a
        medicine, time,
        date, or pills per
        dose, refresh this
        plan and reload the
        carousel before the
        next alarm.
      </p>
    </section>
  );
}