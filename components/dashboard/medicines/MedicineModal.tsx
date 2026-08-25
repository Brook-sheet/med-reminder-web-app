"use client";

import React, {
  useEffect,
  useState,
} from "react";

import {
  Plus,
  Trash2,
  X,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";

import TimePicker from "@/components/ui/TimePicker";

import type {
  Medicine,
} from "@/lib/interfaces/data/Medicine";

interface MedicineModalProps {
  isOpen: boolean;
  onClose: () => void;

  onSave: (
    data: Omit<
      Medicine,
      | "_id"
      | "userId"
      | "createdAt"
      | "updatedAt"
      | "isActive"
    >
  ) => Promise<void>;

  initialData?: Medicine | null;
}

const FREQUENCY_OPTIONS = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Every 4 hours",
  "Every 6 hours",
  "Every 8 hours",
  "Weekly",
  "As needed",
];

const FIXED_SCHEDULE_COUNTS:
  Record<string, number> = {
    "Once daily": 1,
    "Twice daily": 2,
    "Three times daily": 3,
  };

const INTERVAL_SCHEDULE_HOURS:
  Record<string, number> = {
    "Every 4 hours": 4,
    "Every 6 hours": 6,
    "Every 8 hours": 8,
  };

const DEFAULT_FIXED_TIMES:
  Record<number, string[]> = {
    1: [
      "8:00 AM",
    ],

    2: [
      "8:00 AM",
      "8:00 PM",
    ],

    3: [
      "8:00 AM",
      "2:00 PM",
      "8:00 PM",
    ],
  };

const MedicineModal:
  React.FC<MedicineModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialData,
  }) => {
    const [
      name,
      setName,
    ] = useState("");

    const [
      dosage,
      setDosage,
    ] = useState("");

    const [
      frequency,
      setFrequency,
    ] = useState(
      "Once daily"
    );

    const [
      scheduledTimes,
      setScheduledTimes,
    ] = useState<string[]>([
      "8:00 AM",
    ]);

    const [
      pillsPerDose,
      setPillsPerDose,
    ] = useState(1);

    const [
      startDate,
      setStartDate,
    ] = useState(
      new Date()
        .toISOString()
        .split("T")[0]
    );

    const [
      endDate,
      setEndDate,
    ] = useState("");

    const [
      notes,
      setNotes,
    ] = useState("");

    const [
      saving,
      setSaving,
    ] = useState(false);

    const [
      error,
      setError,
    ] = useState("");

    const today =
      new Date()
        .toISOString()
        .split("T")[0];

    const parseDosageValue = (
      raw: string
    ) =>
      raw.replace(
        /\D/g,
        ""
      );

    const parseTime = (
      timeStr: string
    ) => {
      const match =
        /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
          .exec(timeStr);

      if (!match) {
        return {
          hour12: 8,
          minute: 0,
          ampm:
            "AM" as const,
        };
      }

      return {
        hour12:
          Number(match[1]),

        minute:
          Number(match[2]),

        ampm:
          match[3]
            .toUpperCase() as
              | "AM"
              | "PM",
      };
    };

    const timeStringToMinutes = (
      timeStr: string
    ) => {
      const {
        hour12,
        minute,
        ampm,
      } = parseTime(timeStr);

      let hour24 =
        hour12 % 12;

      if (ampm === "PM") {
        hour24 += 12;
      }

      return (
        hour24 * 60 +
        minute
      );
    };

    const minutesToTimeString = (
      minutes: number
    ) => {
      const normalized =
        (
          (
            minutes %
            1440
          ) +
          1440
        ) %
        1440;

      const hour24 =
        Math.floor(
          normalized / 60
        );

      const minute =
        normalized % 60;

      const ampm =
        hour24 >= 12
          ? "PM"
          : "AM";

      const hour12 =
        hour24 % 12 === 0
          ? 12
          : hour24 % 12;

      return (
        `${hour12}:${
          minute
            .toString()
            .padStart(2, "0")
        } ${ampm}`
      );
    };

    const normalizeTimes = (
      times: string[]
    ) => {
      const seen =
        new Set<number>();

      return times
        .map(
          (time) =>
            time.trim()
        )
        .filter(
          (time) =>
            time.length > 0
        )
        .map(
          (time) => ({
            original:
              time,

            minutes:
              timeStringToMinutes(
                time
              ),
          })
        )
        .filter(
          ({
            minutes,
          }) =>
            !Number.isNaN(
              minutes
            )
        )
        .filter(
          ({
            minutes,
          }) => {
            if (
              seen.has(
                minutes
              )
            ) {
              return false;
            }

            seen.add(
              minutes
            );

            return true;
          }
        )
        .map(
          ({
            minutes,
          }) =>
            minutesToTimeString(
              minutes
            )
        );
    };

    const buildIntervalTimes = (
      startTime: string,
      intervalHours: number
    ) => {
      const baseMinutes =
        timeStringToMinutes(
          startTime
        );

      const counts =
        24 / intervalHours;

      const times:
        string[] = [];

      for (
        let i = 0;
        i < counts;
        i += 1
      ) {
        times.push(
          minutesToTimeString(
            baseMinutes +
            i *
              intervalHours *
              60
          )
        );
      }

      return times;
    };

    const getScheduledTimesForFrequency = (
      selectedFrequency: string,
      currentTimes: string[]
    ) => {
      const normalized =
        normalizeTimes(
          currentTimes
        );

      if (
        FIXED_SCHEDULE_COUNTS[
          selectedFrequency
        ]
      ) {
        const required =
          FIXED_SCHEDULE_COUNTS[
            selectedFrequency
          ];

        const result =
          normalized.slice(
            0,
            required
          );

        while (
          result.length <
          required
        ) {
          result.push(
            DEFAULT_FIXED_TIMES[
              required
            ][result.length]
          );
        }

        return result;
      }

      const intervalHours =
        INTERVAL_SCHEDULE_HOURS[
          selectedFrequency
        ];

      if (intervalHours) {
        const seed =
          normalized.length > 0
            ? normalized[0]
            : DEFAULT_FIXED_TIMES[
                1
              ][0];

        return buildIntervalTimes(
          seed,
          intervalHours
        );
      }

      if (
        normalized.length > 0
      ) {
        return normalized;
      }

      return [
        "8:00 AM",
      ];
    };

    const canAddTime = (
      selectedFrequency: string
    ) =>
      selectedFrequency ===
        "As needed" ||
      selectedFrequency ===
        "Weekly";

    const canRemoveTime = (
      selectedFrequency: string
    ) =>
      selectedFrequency ===
        "As needed" ||
      selectedFrequency ===
        "Weekly";

    const isIntervalFrequency = (
      selectedFrequency: string
    ) =>
      INTERVAL_SCHEDULE_HOURS[
        selectedFrequency
      ] !== undefined;

    const isFixedFrequency = (
      selectedFrequency: string
    ) =>
      FIXED_SCHEDULE_COUNTS[
        selectedFrequency
      ] !== undefined;

    const scheduleHelpText =
      (() => {
        if (
          isFixedFrequency(
            frequency
          )
        ) {
          const count =
            FIXED_SCHEDULE_COUNTS[
              frequency
            ];

          return (
            `Select ${count} time${
              count === 1
                ? ""
                : "s"
            } for this schedule.`
          );
        }

        if (
          isIntervalFrequency(
            frequency
          )
        ) {
          return (
            `Choose the first time and reminders will be generated every ${
              INTERVAL_SCHEDULE_HOURS[
                frequency
              ]
            } hours.`
          );
        }

        if (
          frequency ===
          "As needed"
        ) {
          return (
            "Add as many times as needed for this medicine."
          );
        }

        return (
          "Choose one or more reminder times for this medicine."
        );
      })();

    useEffect(() => {
      if (initialData) {
        setName(
          initialData.name
        );

        setDosage(
          parseDosageValue(
            initialData.dosage
          )
        );

        setFrequency(
          initialData.frequency
        );

        setScheduledTimes(
          initialData
            .scheduledTimes
            .length > 0
            ? initialData
                .scheduledTimes
            : [
                "8:00 AM",
              ]
        );

        setStartDate(
          initialData.startDate ||
          today
        );

        setEndDate(
          initialData.endDate ||
          ""
        );

        setNotes(
          initialData.notes ||
          ""
        );

        setPillsPerDose(
          initialData
            .pillsPerDose ??
          1
        );
      } else {
        setName("");
        setDosage("");

        setFrequency(
          "Once daily"
        );

        setScheduledTimes([
          "8:00 AM",
        ]);

        setStartDate(
          today
        );

        setEndDate("");
        setNotes("");

        setPillsPerDose(
          1
        );
      }

      setError("");
    }, [
      initialData,
      isOpen,
      today,
    ]);

    useEffect(() => {
      setScheduledTimes(
        (previous) =>
          getScheduledTimesForFrequency(
            frequency,
            previous
          )
      );
    }, [frequency]);

    const getNextAvailableTime = (
      existing: string[]
    ) => {
      const used =
        new Set(
          existing.map(
            (time) =>
              timeStringToMinutes(
                time
              )
          )
        );

      for (
        let minutes =
          8 * 60;

        minutes <
          24 * 60;

        minutes += 30
      ) {
        if (
          !used.has(minutes)
        ) {
          return minutesToTimeString(
            minutes
          );
        }
      }

      for (
        let minutes = 0;

        minutes <
          8 * 60;

        minutes += 30
      ) {
        if (
          !used.has(minutes)
        ) {
          return minutesToTimeString(
            minutes
          );
        }
      }

      return "8:00 AM";
    };

    const addTime = () => {
      setScheduledTimes(
        (previous) =>
          normalizeTimes([
            ...previous,
            getNextAvailableTime(
              previous
            ),
          ])
      );
    };

    const removeTime = (
      indexToRemove: number
    ) => {
      setScheduledTimes(
        (previous) =>
          previous.filter(
            (
              _,
              index
            ) =>
              index !==
              indexToRemove
          )
      );
    };

    const updateTime = (
      indexToUpdate: number,
      value: string
    ) => {
      if (
        isIntervalFrequency(
          frequency
        ) &&
        indexToUpdate === 0
      ) {
        setScheduledTimes(
          buildIntervalTimes(
            value,
            INTERVAL_SCHEDULE_HOURS[
              frequency
            ]
          )
        );

        return;
      }

      setScheduledTimes(
        (previous) => {
          const nextTimes =
            normalizeTimes(
              previous.map(
                (
                  time,
                  index
                ) =>
                  index ===
                    indexToUpdate
                    ? value
                    : time
              )
            );

          if (
            isFixedFrequency(
              frequency
            )
          ) {
            return getScheduledTimesForFrequency(
              frequency,
              nextTimes
            );
          }

          return nextTimes;
        }
      );
    };

    const handleSubmit =
      async (
        event:
          React.FormEvent<HTMLFormElement>
      ) => {
        event.preventDefault();

        setError("");

        if (!name.trim()) {
          setError(
            "Medicine name is required."
          );

          return;
        }

        if (
          !dosage.trim() ||
          !/^\d+$/.test(
            dosage.trim()
          )
        ) {
          setError(
            "Dosage is required and must be a number."
          );

          return;
        }

        if (!startDate) {
          setError(
            "Start date is required."
          );

          return;
        }

        if (
          startDate < today
        ) {
          setError(
            "Start date cannot be in the past."
          );

          return;
        }

        if (
          endDate &&
          endDate <
            startDate
        ) {
          setError(
            "End date cannot be before start date."
          );

          return;
        }

        if (
          scheduledTimes.length ===
          0
        ) {
          setError(
            "At least one scheduled time is required."
          );

          return;
        }

        if (
          !Number.isInteger(
            pillsPerDose
          ) ||
          pillsPerDose < 1 ||
          pillsPerDose > 4
        ) {
          setError(
            "Pills per scheduled dose must be a whole number from 1 to 4."
          );

          return;
        }

        setSaving(true);

        try {
          await onSave({
            name,

            dosage:
              `${dosage.trim()}mg`,

            frequency,

            scheduledTimes,

            startDate,

            endDate:
              endDate ||
              undefined,

            notes,

            pillsPerDose,

            windowBeforeMinutes:
              initialData
                ?.windowBeforeMinutes ??
              30,

            windowAfterMinutes:
              initialData
                ?.windowAfterMinutes ??
              90,

            lateAfterMinutes:
              initialData
                ?.lateAfterMinutes ??
              30,
          });
        } catch (
          caughtError: unknown
        ) {
          setError(
            caughtError instanceof
              Error
              ? caughtError.message
              : "Failed to save. Please try again."
          );
        } finally {
          setSaving(false);
        }
      };

    if (!isOpen) {
      return null;
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        <div className="relative mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-2xl dark:bg-gray-800">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {initialData
                ? "Edit Medicine"
                : "Add New Medicine"}
            </h2>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Close medicine form"
            >
              <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          <form
            onSubmit={
              handleSubmit
            }
            className="space-y-5 p-6"
          >
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Medicine Name{" "}
                <span className="text-red-500">
                  *
                </span>
              </label>

              <input
                type="text"
                value={name}
                onChange={(
                  event
                ) =>
                  setName(
                    event.target
                      .value
                  )
                }
                placeholder="e.g. Aspirin"
                disabled={
                  saving
                }
                className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Dosage{" "}
                <span className="text-red-500">
                  *
                </span>
              </label>

              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="1"
                  step="1"
                  value={dosage}
                  onChange={(
                    event
                  ) =>
                    setDosage(
                      parseDosageValue(
                        event.target
                          .value
                      )
                    )
                  }
                  placeholder="100"
                  disabled={
                    saving
                  }
                  className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 pr-14 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />

                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                  mg
                </span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Start Date{" "}
                <span className="text-red-500">
                  *
                </span>
              </label>

              <input
                type="date"
                value={
                  startDate
                }
                onChange={(
                  event
                ) =>
                  setStartDate(
                    event.target
                      .value
                  )
                }
                min={today}
                disabled={
                  saving
                }
                className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />

              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Reminders will
                begin from this
                date
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                End Date{" "}
                <span className="text-xs font-normal text-gray-400">
                  (optional)
                </span>
              </label>

              <input
                type="date"
                value={endDate}
                onChange={(
                  event
                ) =>
                  setEndDate(
                    event.target
                      .value
                  )
                }
                min={
                  startDate ||
                  today
                }
                disabled={
                  saving
                }
                className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />

              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Leave blank if
                the medicine has
                no end date
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Frequency
              </label>

              <select
                value={
                  frequency
                }
                onChange={(
                  event
                ) =>
                  setFrequency(
                    event.target
                      .value
                  )
                }
                disabled={
                  saving
                }
                className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                {FREQUENCY_OPTIONS.map(
                  (option) => (
                    <option
                      key={
                        option
                      }
                      value={
                        option
                      }
                    >
                      {option}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Pills per
                scheduled dose{" "}
                <span className="text-red-500">
                  *
                </span>
              </label>

              <input
                type="number"
                min="1"
                max="4"
                step="1"
                value={
                  pillsPerDose
                }
                onChange={(
                  event
                ) =>
                  setPillsPerDose(
                    Number(
                      event.target
                        .value
                    )
                  )
                }
                disabled={
                  saving
                }
                className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />

              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Each pill uses
                one chamber. The
                daily loading
                plan assigns the
                chambers
                automatically.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Scheduled Times{" "}
                <span className="text-red-500">
                  *
                </span>
              </label>

              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                {
                  scheduleHelpText
                }
              </p>

              <div className="space-y-2">
                {scheduledTimes.map(
                  (
                    time,
                    index
                  ) => (
                    <div
                      key={
                        time
                      }
                      className="flex items-center gap-2"
                    >
                      <TimePicker
                        value={
                          time
                        }
                        onChange={(
                          value
                        ) =>
                          updateTime(
                            index,
                            value
                          )
                        }
                        disabled={
                          saving ||
                          (
                            isIntervalFrequency(
                              frequency
                            ) &&
                            index !==
                              0
                          )
                        }
                      />

                      {canRemoveTime(
                        frequency
                      ) &&
                        scheduledTimes.length >
                          1 && (
                          <button
                            type="button"
                            onClick={() =>
                              removeTime(
                                index
                              )
                            }
                            className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            disabled={
                              saving
                            }
                            aria-label={`Remove ${time}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                    </div>
                  )
                )}
              </div>

              {canAddTime(
                frequency
              ) && (
                <button
                  type="button"
                  onClick={
                    addTime
                  }
                  disabled={
                    saving
                  }
                  className="mt-2 flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <Plus className="h-4 w-4" />
                  Add another
                  time
                </button>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Notes (optional)
              </label>

              <textarea
                value={notes}
                onChange={(
                  event
                ) =>
                  setNotes(
                    event.target
                      .value
                  )
                }
                placeholder="e.g. Take with food"
                disabled={
                  saving
                }
                rows={2}
                className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={
                  onClose
                }
                disabled={
                  saving
                }
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>

              <Button
                type="submit"
                disabled={
                  saving
                }
                className="flex-1"
              >
                {saving
                  ? "Saving..."
                  : initialData
                    ? "Save Changes"
                    : "Add Medicine"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  };

export default MedicineModal;