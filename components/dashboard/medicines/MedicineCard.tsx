// components/dashboard/medicines/MedicineCard.tsx
import React from "react";

import {
  Calendar,
  Clock,
  Edit2,
  Trash2,
} from "lucide-react";

interface MedicineCardProps {
  name: string;
  dosage: string;
  frequency: string;
  scheduledTimes: string[];
  pillsPerDose: number;
  startDate?: string;
  endDate?: string;
  notes?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

const MedicineCard:
  React.FC<MedicineCardProps> = ({
    name,
    dosage,
    frequency,
    scheduledTimes,
    pillsPerDose,
    startDate,
    endDate,
    notes,
    onEdit,
    onDelete,
    isDeleting = false,
  }) => {
    const getAvatarColor = (
      letter: string
    ) => {
      const colors:
        Record<string, string> = {
          A: "bg-blue-500",
          B: "bg-purple-500",
          C: "bg-pink-500",
          D: "bg-green-500",
          E: "bg-orange-500",
          F: "bg-red-500",
          G: "bg-indigo-500",
          H: "bg-teal-500",
          I: "bg-cyan-500",
          J: "bg-lime-500",
          K: "bg-rose-500",
          L: "bg-amber-500",
          M: "bg-violet-500",
          N: "bg-fuchsia-500",
          O: "bg-emerald-500",
          P: "bg-sky-500",
          Q: "bg-blue-400",
          R: "bg-purple-400",
          S: "bg-pink-400",
          T: "bg-green-400",
          U: "bg-orange-400",
          V: "bg-red-400",
          W: "bg-indigo-400",
          X: "bg-teal-400",
          Y: "bg-cyan-400",
          Z: "bg-lime-400",
        };

      return (
        colors[
          letter.toUpperCase()
        ] ||
        "bg-gray-400"
      );
    };

    const formatDate = (
      dateString: string
    ) => {
      const date =
        new Date(
          `${dateString}T00:00:00`
        );

      return date.toLocaleDateString(
        "en-US",
        {
          month:
            "short",

          day:
            "numeric",

          year:
            "numeric",
        }
      );
    };

    const firstLetter =
      name
        .charAt(0)
        .toUpperCase();

    const avatarColor =
      getAvatarColor(
        firstLetter
      );

    return (
      <div
        className={`w-full rounded-[20px] border border-border/70 bg-card p-4 shadow-lg shadow-slate-900/5 transition-all duration-200 sm:p-6 ${
          isDeleting
            ? "pointer-events-none opacity-50"
            : ""
        }`}
      >
        <div className="mb-3 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base font-bold text-white sm:h-12 sm:w-12 sm:text-lg ${avatarColor}`}
            >
              {firstLetter}
            </div>

            <div className="min-w-0 space-y-0.5">
              <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-white sm:text-xl">
                {name}
              </h3>

              <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                {dosage}
              </p>
            </div>
          </div>

          <div className="ml-0 flex shrink-0 gap-2 sm:ml-4">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label={`Edit ${name}`}
            >
              <Edit2 className="h-5 w-5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white" />
            </button>

            <button
              type="button"
              onClick={onDelete}
              disabled={
                isDeleting
              }
              className="rounded-lg p-2 transition-colors hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
              aria-label={`Delete ${name}`}
            >
              <Trash2 className="h-5 w-5 text-gray-600 hover:text-red-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="mb-3 h-px bg-gray-100 dark:bg-gray-700" />

        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Frequency
            </p>

            <p className="text-sm text-gray-700 dark:text-gray-300">
              {frequency}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Scheduled Times
            </p>

            <div className="flex flex-wrap gap-2">
              {scheduledTimes.map(
                (time) => (
                  <div
                    key={time}
                    className="flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-sm font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {time}
                  </div>
                )
              )}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Pills per
              Scheduled Dose
            </p>

            <p className="text-sm text-gray-700 dark:text-gray-300">
              {pillsPerDose}{" "}
              {pillsPerDose ===
              1
                ? "pill"
                : "pills"}
            </p>
          </div>

          {notes && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Notes
              </p>

              <p className="whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">
                {notes}
              </p>
            </div>
          )}

          {(startDate ||
            endDate) && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Duration
              </p>

              <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                <Calendar className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />

                <span>
                  {startDate
                    ? formatDate(
                        startDate
                      )
                    : "—"}{" "}

                  {endDate
                    ? `→ ${formatDate(
                        endDate
                      )}`
                    : "(no end date)"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

export default MedicineCard;