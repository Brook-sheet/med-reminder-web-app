"use client";

import React, {
  useState,
} from "react";
import ScheduleItem from "./ScheduleItem";
import type {
  ScheduleItem as ScheduleItemType,
} from "@/lib/interfaces/data/Dashboard";
import {
  toast,
} from "@/components/ui/Toast";

interface ScheduleListProps {
  schedule: ScheduleItemType[];
  loading: boolean;
  onStatusChange?: () => void;
}

const ScheduleList:
  React.FC<ScheduleListProps> = ({
    schedule,
    loading,
    onStatusChange,
  }) => {
    const [
      markingId,
      setMarkingId,
    ] =
      useState<string | null>(
        null,
      );

    const handleMarkTaken =
      async (
        logId: string,
      ) => {
        setMarkingId(logId);

        try {
          const response =
            await fetch(
              "/api/history",
              {
                method:
                  "PATCH",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify({
                    logId,
                    status:
                      "taken",
                  }),
              },
            );

          const data =
            await response.json();

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.error ||
                "Unable to update this dose. Please try again.",
            );
          }

          onStatusChange?.();

          toast.success(
            "Medicine marked as taken.",
          );
        } catch (error) {
          console.error(
            "Failed to mark as taken:",
            error,
          );

          toast.error(
            error instanceof Error
              ? error.message
              : "Unable to update this dose. Please try again.",
          );
        } finally {
          setMarkingId(null);
        }
      };

    if (loading) {
      return (
        <div className="space-y-3">
          {[1, 2].map(
            (item) => (
              <div
                key={item}
                className="h-16 animate-pulse rounded-lg bg-gray-100"
              />
            ),
          )}
        </div>
      );
    }

    if (
      schedule.length === 0
    ) {
      return (
        <p className="text-sm text-gray-400">
          No medications scheduled for today.
        </p>
      );
    }

    return (
      <div className="space-y-4">
        {schedule.map(
          (item) => (
            <div
              key={
                item.logId ??
                item.medicineId
              }
              className="group relative"
            >
              <ScheduleItem
                name={item.name}
                time={item.time}
                note={item.notes}
                status={item.status}
              />

              {[
                "Upcoming",
                "Scheduled",
                "Now",
              ].includes(
                item.status,
              ) &&
                item.logId && (
                  <button
                    type="button"
                    onClick={() =>
                      handleMarkTaken(
                        item.logId!,
                      )
                    }
                    disabled={
                      markingId ===
                      item.logId
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-green-600 px-3 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-green-700 disabled:opacity-50"
                  >
                    {markingId ===
                    item.logId
                      ? "Saving..."
                      : "Mark Taken"}
                  </button>
                )}
            </div>
          ),
        )}
      </div>
    );
  };

export default ScheduleList;