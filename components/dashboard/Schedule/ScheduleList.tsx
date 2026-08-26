"use client";

import React, {
  useState,
} from "react";

import {
  Loader2,
  Pill,
} from "lucide-react";

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

interface MarkTakenDialogProps {
  item: ScheduleItemType;
  note: string;
  saving: boolean;
  onNoteChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

function MarkTakenDialog({
  item,
  note,
  saving,
  onNoteChange,
  onCancel,
  onConfirm,
}: MarkTakenDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onClick={
        saving
          ? undefined
          : onCancel
      }
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mark-taken-title"
        className="w-full max-w-md rounded-[28px] border border-border/80 bg-card p-6 shadow-2xl"
        onClick={(
          event,
        ) =>
          event.stopPropagation()
        }
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <Pill className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>

          <div>
            <h2
              id="mark-taken-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              Mark
              {" "}
              {item.name}
              {" "}
              as taken?
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {item.dosage ||
                "No dosage specified"}
              {" · Scheduled "}
              {item.time}
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Confirm only after taking the medication. The existing on-time or late calculation will be preserved.
            </p>
          </div>
        </div>

        <label className="mt-5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Optional patient note

          <textarea
            value={
              note
            }
            onChange={(
              event,
            ) =>
              onNoteChange(
                event.target.value,
              )
            }
            maxLength={
              500
            }
            disabled={
              saving
            }
            rows={
              4
            }
            placeholder="Example: Taken after breakfast."
            className="mt-2 w-full resize-none rounded-2xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
          />
        </label>

        <p className="mt-1 text-right text-xs text-slate-400">
          {note.length}/500
        </p>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={
              onCancel
            }
            disabled={
              saving
            }
            className="flex-1 rounded-2xl border border-border/80 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={
              onConfirm
            }
            disabled={
              saving
            }
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
          >
            {saving && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}

            {saving
              ? "Confirming..."
              : "Confirm as Taken"}
          </button>
        </div>
      </div>
    </div>
  );
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

    const [
      selectedItem,
      setSelectedItem,
    ] =
      useState<ScheduleItemType | null>(
        null,
      );

    const [
      patientNote,
      setPatientNote,
    ] =
      useState("");

    const closeDialog =
      () => {
        if (
          markingId
        ) {
          return;
        }

        setSelectedItem(
          null,
        );

        setPatientNote(
          "",
        );
      };

    const handleMarkTaken =
      async () => {
        if (
          !selectedItem?.logId ||
          markingId
        ) {
          return;
        }

        const logId =
          selectedItem.logId;

        setMarkingId(
          logId,
        );

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

                    note:
                      patientNote.trim(),
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

          setSelectedItem(
            null,
          );

          setPatientNote(
            "",
          );

          onStatusChange?.();

          toast.success(
            data.data
              ?.status ===
            "late"
              ? "Medicine marked as taken late."
              : "Medicine marked as taken.",
          );
        } catch (
          error
        ) {
          console.error(
            "Failed to mark as taken:",
            error,
          );

          toast.error(
            error instanceof
            Error
              ? error.message
              : "Unable to update this dose. Please try again.",
          );
        } finally {
          setMarkingId(
            null,
          );
        }
      };

    if (loading) {
      return (
        <div className="space-y-3">
          {[
            1,
            2,
          ].map(
            (
              item,
            ) => (
              <div
                key={
                  item
                }
                className="h-16 animate-pulse rounded-lg bg-gray-100"
              />
            ),
          )}
        </div>
      );
    }

    if (
      schedule.length ===
      0
    ) {
      return (
        <p className="text-sm text-gray-400">
          No medications scheduled for today.
        </p>
      );
    }

    return (
      <>
        <div className="space-y-4">
          {schedule.map(
            (
              item,
            ) => (
              <div
                key={
                  item.logId ??
                  item.medicineId
                }
                className="group relative"
              >
                <ScheduleItem
                  name={
                    item.name
                  }
                  time={
                    item.time
                  }
                  note={
                    item.notes
                  }
                  status={
                    item.status
                  }
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
                      onClick={() => {
                        setSelectedItem(
                          item,
                        );

                        setPatientNote(
                          "",
                        );
                      }}
                      disabled={
                        Boolean(
                          markingId,
                        )
                      }
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-green-600 px-3 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-green-700 focus:opacity-100 disabled:opacity-50"
                    >
                      Mark Taken
                    </button>
                  )}
              </div>
            ),
          )}
        </div>

        {selectedItem && (
          <MarkTakenDialog
            item={
              selectedItem
            }
            note={
              patientNote
            }
            saving={
              markingId ===
              selectedItem.logId
            }
            onNoteChange={
              setPatientNote
            }
            onCancel={
              closeDialog
            }
            onConfirm={() =>
              void handleMarkTaken()
            }
          />
        )}
      </>
    );
  };

export default ScheduleList;