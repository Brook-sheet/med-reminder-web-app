
"use client";

import React, {
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import TimePicker from "@/components/ui/TimePicker";

import type {
  Medicine,
  MedicineChamberAssignment,
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

interface ScheduleRow {
  id: string;
  time: string;
  chamberIds: number[];
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

const FIXED_SCHEDULE_COUNTS: Record<
  string,
  number
> = {
  "Once daily": 1,
  "Twice daily": 2,
  "Three times daily": 3,
};

const INTERVAL_SCHEDULE_HOURS: Record<
  string,
  number
> = {
  "Every 4 hours": 4,
  "Every 6 hours": 6,
  "Every 8 hours": 8,
};

const DEFAULT_FIXED_TIMES: Record<
  number,
  string[]
> = {
  1: ["8:00 AM"],
  2: ["8:00 AM", "8:00 PM"],
  3: [
    "8:00 AM",
    "2:00 PM",
    "8:00 PM",
  ],
};

const CHAMBERS = [1, 2, 3, 4];

function getToday(): string {
  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  const get = (type: string) =>
    parts.find(
      (part) => part.type === type
    )?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function parseDosageValue(
  raw: string
): string {
  return raw.replace(/\D/g, "");
}

function timeStringToMinutes(
  value: string
): number {
  const match =
    /^(1[0-2]|[1-9]):([0-5]\d)\s*(AM|PM)$/i.exec(
      value.trim()
    );

  if (!match) {
    return -1;
  }

  const hour12 = Number(match[1]);
  const minute = Number(match[2]);
  const ampm = match[3].toUpperCase();

  let hour24 = hour12 % 12;

  if (ampm === "PM") {
    hour24 += 12;
  }

  return hour24 * 60 + minute;
}

function minutesToTimeString(
  minutes: number
): string {
  const normalized =
    ((minutes % 1440) + 1440) % 1440;

  const hour24 =
    Math.floor(normalized / 60);

  const minute = normalized % 60;

  const ampm =
    hour24 >= 12 ? "PM" : "AM";

  const hour12 =
    hour24 % 12 === 0
      ? 12
      : hour24 % 12;

  return `${hour12}:${String(
    minute
  ).padStart(2, "0")} ${ampm}`;
}

function getNextAvailableTime(
  existing: string[]
): string {
  const used = new Set(
    existing.map(timeStringToMinutes)
  );

  for (
    let minutes = 8 * 60;
    minutes < 1440;
    minutes += 30
  ) {
    if (!used.has(minutes)) {
      return minutesToTimeString(
        minutes
      );
    }
  }

  for (
    let minutes = 0;
    minutes < 8 * 60;
    minutes += 30
  ) {
    if (!used.has(minutes)) {
      return minutesToTimeString(
        minutes
      );
    }
  }

  return "8:00 AM";
}

function buildIntervalTimes(
  startTime: string,
  intervalHours: number
): string[] {
  const start =
    timeStringToMinutes(startTime);

  const base =
    start >= 0 ? start : 480;

  const count =
    24 / intervalHours;

  return Array.from(
    { length: count },
    (_, index) =>
      minutesToTimeString(
        base +
          index *
            intervalHours *
            60
      )
  );
}

function createScheduleRow(
  id: string,
  time: string,
  chamberIds: number[] = []
): ScheduleRow {
  return {
    id,
    time,
    chamberIds: [...chamberIds],
  };
}

function findAssignment(
  assignments:
    | MedicineChamberAssignment[]
    | undefined,
  time: string
): number[] {
  const minutes =
    timeStringToMinutes(time);

  const assignment =
    assignments?.find(
      (item) =>
        timeStringToMinutes(
          item.scheduledTime
        ) === minutes
    );

  return assignment
    ? [...assignment.chamberIds]
    : [];
}

function getRowsForFrequency(
  frequency: string,
  previous: ScheduleRow[],
  nextId: () => string
): ScheduleRow[] {
  const fixedCount =
    FIXED_SCHEDULE_COUNTS[frequency];

  if (fixedCount) {
    const rows = previous
      .slice(0, fixedCount)
      .map((row) => ({
        ...row,
        chamberIds: [
          ...row.chamberIds,
        ],
      }));

    const defaults =
      DEFAULT_FIXED_TIMES[fixedCount];

    while (
      rows.length < fixedCount
    ) {
      const index = rows.length;

      const preferred =
        defaults[index];

      const used = rows.map(
        (row) => row.time
      );

      const time =
        preferred &&
        !used.some(
          (item) =>
            timeStringToMinutes(item) ===
            timeStringToMinutes(
              preferred
            )
        )
          ? preferred
          : getNextAvailableTime(
              used
            );

      rows.push(
        createScheduleRow(
          nextId(),
          time
        )
      );
    }

    return rows;
  }

  const intervalHours =
    INTERVAL_SCHEDULE_HOURS[
      frequency
    ];

  if (intervalHours) {
    const seed =
      previous[0]?.time ??
      "8:00 AM";

    const times =
      buildIntervalTimes(
        seed,
        intervalHours
      );

    return times.map(
      (time, index) => {
        const oldRow =
          previous[index];

        return createScheduleRow(
          oldRow?.id ??
            nextId(),
          time,
          oldRow?.chamberIds ??
            []
        );
      }
    );
  }

  if (previous.length > 0) {
    return previous;
  }

  return [
    createScheduleRow(
      nextId(),
      "8:00 AM"
    ),
  ];
}

const MedicineModal: React.FC<
  MedicineModalProps
> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [name, setName] =
    useState("");

  const [dosage, setDosage] =
    useState("");

  const [
    frequency,
    setFrequency,
  ] = useState(
    "Once daily"
  );

  const [
    scheduleRows,
    setScheduleRows,
  ] = useState<ScheduleRow[]>([
    createScheduleRow(
      "schedule-0",
      "8:00 AM"
    ),
  ]);

  const [
    pillsPerDose,
    setPillsPerDose,
  ] = useState(1);

  const [
    startDate,
    setStartDate,
  ] = useState(getToday());

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

  const [
    mounted,
    setMounted,
  ] = useState(false);

  const [
    nextRowNumber,
    setNextRowNumber,
  ] = useState(1);

  const today = getToday();

  useEffect(() => {
    setMounted(true);

    return () => {
      setMounted(false);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key === "Escape" &&
        !saving
      ) {
        onClose();
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    isOpen,
    onClose,
    saving,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (initialData) {
      setName(
        initialData.name ?? ""
      );

      setDosage(
        parseDosageValue(
          initialData.dosage ?? ""
        )
      );

      setFrequency(
        initialData.frequency ??
          "Once daily"
      );

      const times =
        initialData.scheduledTimes
          ?.length
          ? initialData.scheduledTimes
          : ["8:00 AM"];

      setScheduleRows(
        times.map(
          (time, index) =>
            createScheduleRow(
              `initial-${index}`,
              time,
              findAssignment(
                initialData.chamberAssignments,
                time
              )
            )
        )
      );

      setNextRowNumber(
        times.length
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
        initialData.pillsPerDose ??
          1
      );
    } else {
      setName("");
      setDosage("");

      setFrequency(
        "Once daily"
      );

      setScheduleRows([
        createScheduleRow(
          "new-0",
          "8:00 AM"
        ),
      ]);

      setNextRowNumber(1);

      setStartDate(today);
      setEndDate("");
      setNotes("");
      setPillsPerDose(1);
    }

    setError("");
    setSaving(false);
  }, [
    initialData,
    isOpen,
    today,
  ]);

  const isIntervalFrequency =
    INTERVAL_SCHEDULE_HOURS[
      frequency
    ] !== undefined;

  const canAddTime =
    frequency ===
      "As needed" ||
    frequency ===
      "Weekly";

  const scheduleHelpText =
    FIXED_SCHEDULE_COUNTS[
      frequency
    ]
      ? `Select ${
          FIXED_SCHEDULE_COUNTS[
            frequency
          ]
        } scheduled time(s).`
      : isIntervalFrequency
        ? `Choose the first time. The remaining times follow every ${
            INTERVAL_SCHEDULE_HOURS[
              frequency
            ]
          } hours.`
        : "Choose one or more scheduled times.";

  const changeFrequency = (
    value: string
  ) => {
    setFrequency(value);

    let counter =
      nextRowNumber;

    const generateId = () =>
      `schedule-${counter++}`;

    setScheduleRows(
      (previous) =>
        getRowsForFrequency(
          value,
          previous,
          generateId
        )
    );

    setNextRowNumber(counter);
    setError("");
  };

  const updateTime = (
    rowId: string,
    value: string
  ) => {
    setScheduleRows(
      (previous) => {
        if (
          isIntervalFrequency &&
          previous[0]?.id ===
            rowId
        ) {
          const intervalHours =
            INTERVAL_SCHEDULE_HOURS[
              frequency
            ];

          const times =
            buildIntervalTimes(
              value,
              intervalHours
            );

          return previous.map(
            (row, index) => ({
              ...row,
              time:
                times[index] ??
                row.time,
            })
          );
        }

        return previous.map(
          (row) =>
            row.id === rowId
              ? {
                  ...row,
                  time: value,
                }
              : row
        );
      }
    );

    /*
     * Chamber IDs are intentionally
     * preserved when the time changes.
     */
    setError("");
  };

  const addTime = () => {
    if (!canAddTime) {
      return;
    }

    const id =
      `schedule-${nextRowNumber}`;

    setNextRowNumber(
      (previous) =>
        previous + 1
    );

    setScheduleRows(
      (previous) => [
        ...previous,
        createScheduleRow(
          id,
          getNextAvailableTime(
            previous.map(
              (row) => row.time
            )
          )
        ),
      ]
    );
  };

  const removeTime = (
    rowId: string
  ) => {
    setScheduleRows(
      (previous) =>
        previous.length > 1
          ? previous.filter(
              (row) =>
                row.id !== rowId
            )
          : previous
    );
  };

  const toggleChamber = (
    rowId: string,
    chamberId: number
  ) => {
    setScheduleRows(
      (previous) =>
        previous.map(
          (row) => {
            if (
              row.id !== rowId
            ) {
              return row;
            }

            const selected =
              row.chamberIds.includes(
                chamberId
              );

            return {
              ...row,
              chamberIds: selected
                ? row.chamberIds.filter(
                    (id) =>
                      id !== chamberId
                  )
                : [
                    ...row.chamberIds,
                    chamberId,
                  ].sort(
                    (a, b) =>
                      a - b
                  ),
            };
          }
        )
    );

    setError("");
  };

  const getChamberConflict = (
    rows: ScheduleRow[]
  ): string | null => {
    const chamberTimes =
      new Map<number, number>();

    for (const row of rows) {
      const minutes =
        timeStringToMinutes(
          row.time
        );

      for (
        const chamberId of
        row.chamberIds
      ) {
        const existingTime =
          chamberTimes.get(
            chamberId
          );

        if (
          existingTime !==
            undefined &&
          existingTime !==
            minutes
        ) {
          return (
            `Chamber ${chamberId} is selected ` +
            "for different scheduled times. " +
            "Choose another chamber."
          );
        }

        chamberTimes.set(
          chamberId,
          minutes
        );
      }
    }

    return null;
  };

  const handleSubmit = async (
    event: React.FormEvent<
      HTMLFormElement
    >
  ) => {
    event.preventDefault();
    setError("");

    const trimmedName =
      name.trim();

    const trimmedDosage =
      dosage.trim();

    if (!trimmedName) {
      setError(
        "Medicine name is required."
      );
      return;
    }

    if (
      !trimmedDosage ||
      !/^\d+$/.test(
        trimmedDosage
      ) ||
      Number(
        trimmedDosage
      ) < 1
    ) {
      setError(
        "Dosage must be a number greater than 0."
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
      !initialData &&
      startDate < today
    ) {
      setError(
        "Start date cannot be in the past."
      );
      return;
    }

    if (
      endDate &&
      endDate < startDate
    ) {
      setError(
        "End date cannot be before start date."
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
        "Pills per scheduled dose must be from 1 to 4."
      );
      return;
    }

    if (
      scheduleRows.length ===
      0
    ) {
      setError(
        "At least one scheduled time is required."
      );
      return;
    }

    const usedTimes =
      new Set<number>();

    for (
      const row of
      scheduleRows
    ) {
      const minutes =
        timeStringToMinutes(
          row.time
        );

      if (
        minutes < 0
      ) {
        setError(
          "Please enter valid scheduled times."
        );
        return;
      }

      if (
        usedTimes.has(
          minutes
        )
      ) {
        setError(
          "Duplicate scheduled times are not allowed."
        );
        return;
      }

      usedTimes.add(
        minutes
      );

      if (
        row.chamberIds.length ===
        0
      ) {
        setError(
          `Select at least one chamber for ${row.time}.`
        );
        return;
      }
    }

    const requiredCount =
      FIXED_SCHEDULE_COUNTS[
        frequency
      ];

    if (
      requiredCount &&
      scheduleRows.length !==
        requiredCount
    ) {
      setError(
        `This frequency requires exactly ${requiredCount} scheduled times.`
      );
      return;
    }

    const conflict =
      getChamberConflict(
        scheduleRows
      );

    if (conflict) {
      setError(
        conflict
      );
      return;
    }

    const sortedRows = [
      ...scheduleRows,
    ].sort(
      (a, b) =>
        timeStringToMinutes(
          a.time
        ) -
        timeStringToMinutes(
          b.time
        )
    );

    const scheduledTimes =
      sortedRows.map(
        (row) =>
          minutesToTimeString(
            timeStringToMinutes(
              row.time
            )
          )
      );

    const chamberAssignments:
      MedicineChamberAssignment[] =
        sortedRows.map(
          (row) => ({
            scheduledTime:
              minutesToTimeString(
                timeStringToMinutes(
                  row.time
                )
              ),

            chamberIds: [
              ...row.chamberIds,
            ].sort(
              (a, b) =>
                a - b
            ),
          })
        );

    setSaving(true);

    try {
      await onSave({
        name: trimmedName,

        dosage:
          `${trimmedDosage}mg`,

        frequency,

        scheduledTimes,

        pillsPerDose,

        chamberAssignments,

        startDate,

        endDate:
          endDate ||
          undefined,

        notes:
          notes.trim(),

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

  if (
    !isOpen ||
    !mounted
  ) {
    return null;
  }

  const inputClass =
    "h-11 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-base shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:h-9 sm:text-sm";

  const labelClass =
    "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300";

  return createPortal(
    <div
      className="rx-modal fixed inset-0 z-[120] flex items-center justify-center overflow-hidden p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="medicine-modal-title"
    >
      <div
        className="rx-overlay-in fixed inset-0 h-[100lvh] w-full bg-black/50 backdrop-blur-sm"
        onClick={() => {
          if (!saving) {
            onClose();
          }
        }}
        aria-hidden="true"
      />

      <div className="rx-modal-panel rx-dialog-in relative z-[121] flex max-h-[min(44rem,calc(100svh-2rem))] w-full min-w-0 max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800 sm:max-h-[min(46rem,calc(100svh-3rem))]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3.5 dark:border-gray-700 dark:bg-gray-800 sm:px-6 sm:py-5">
          <h2
            id="medicine-modal-title"
            className="min-w-0 truncate text-lg font-bold text-gray-900 dark:text-white sm:text-xl"
          >
            {initialData
              ? "Edit Medicine"
              : "Add New Medicine"}
          </h2>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rx-press shrink-0 rounded-lg p-2 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700"
            aria-label="Close medicine form"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <form
          id="medicine-form"
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-6 sm:space-y-5 sm:px-6"
        >
          {error && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
              role="alert"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="medicine-name"
              className={labelClass}
            >
              Medicine Name{" "}
              <span className="text-red-500">
                *
              </span>
            </label>

            <input
              id="medicine-name"
              type="text"
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value
                )
              }
              placeholder="e.g. Aspirin"
              disabled={saving}
              autoComplete="off"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="medicine-dosage"
              className={labelClass}
            >
              Dosage{" "}
              <span className="text-red-500">
                *
              </span>
            </label>

            <div className="relative">
              <input
                id="medicine-dosage"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={dosage}
                onChange={(event) =>
                  setDosage(
                    parseDosageValue(
                      event.target.value
                    )
                  )
                }
                placeholder="100"
                disabled={saving}
                className={`${inputClass} pr-14`}
              />

              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                mg
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="medicine-start-date"
              className={labelClass}
            >
              Start Date{" "}
              <span className="text-red-500">
                *
              </span>
            </label>

            <input
              id="medicine-start-date"
              type="date"
              value={startDate}
              onChange={(event) =>
                setStartDate(
                  event.target.value
                )
              }
              min={
                initialData
                  ? undefined
                  : today
              }
              disabled={saving}
              className={inputClass}
            />

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Reminders begin from this date.
            </p>
          </div>

          <div>
            <label
              htmlFor="medicine-end-date"
              className={labelClass}
            >
              End Date{" "}
              <span className="text-xs font-normal text-gray-400">
                (optional)
              </span>
            </label>

            <input
              id="medicine-end-date"
              type="date"
              value={endDate}
              onChange={(event) =>
                setEndDate(
                  event.target.value
                )
              }
              min={startDate}
              disabled={saving}
              className={inputClass}
            />

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Leave blank if there is no end date.
            </p>
          </div>

          <div>
            <label
              htmlFor="medicine-frequency"
              className={labelClass}
            >
              Frequency
            </label>

            <select
              id="medicine-frequency"
              value={frequency}
              onChange={(event) =>
                changeFrequency(
                  event.target.value
                )
              }
              disabled={saving}
              className={inputClass}
            >
              {FREQUENCY_OPTIONS.map(
                (option) => (
                  <option
                    key={option}
                    value={option}
                  >
                    {option}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="medicine-pills-per-dose"
              className={labelClass}
            >
              Pills per scheduled dose{" "}
              <span className="text-red-500">
                *
              </span>
            </label>

            <input
              id="medicine-pills-per-dose"
              type="number"
              min="1"
              max="4"
              step="1"
              value={pillsPerDose}
              onChange={(event) => {
                const value =
                  event.target.value;

                setPillsPerDose(
                  value === ""
                    ? 0
                    : Number(value)
                );
              }}
              disabled={saving}
              className={inputClass}
            />

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Multiple pills may share one chamber
              when they are scheduled together and
              physically fit in the dispenser.
            </p>
          </div>

          <div>
            <label className={labelClass}>
              Scheduled Times and Chambers{" "}
              <span className="text-red-500">
                *
              </span>
            </label>

            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              {scheduleHelpText}
              {" "}
              Select the physical chamber for
              each scheduled dose.
            </p>

            <div className="space-y-3">
              {scheduleRows.map(
                (row, index) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        Dose {index + 1}
                      </span>

                      {canAddTime &&
                        scheduleRows.length >
                          1 && (
                          <button
                            type="button"
                            onClick={() =>
                              removeTime(
                                row.id
                              )
                            }
                            disabled={saving}
                            className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
                            aria-label={`Remove dose ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                    </div>

                    <TimePicker
                      value={row.time}
                      onChange={(value) =>
                        updateTime(
                          row.id,
                          value
                        )
                      }
                      disabled={
                        saving ||
                        (isIntervalFrequency &&
                          index !== 0)
                      }
                    />

                    <p className="mb-2 mt-3 text-xs font-medium text-gray-600 dark:text-gray-400">
                      Select Chamber(s)
                    </p>

                    <div className="grid grid-cols-4 gap-2">
                      {CHAMBERS.map(
                        (chamberId) => {
                          const selected =
                            row.chamberIds.includes(
                              chamberId
                            );

                          return (
                            <button
                              key={chamberId}
                              type="button"
                              onClick={() =>
                                toggleChamber(
                                  row.id,
                                  chamberId
                                )
                              }
                              disabled={saving}
                              aria-pressed={
                                selected
                              }
                              className={`rounded-lg border px-2 py-2.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                                selected
                                  ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500"
                                  : "border-gray-300 bg-white text-gray-700 hover:border-blue-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                              }`}
                            >
                              C{chamberId}
                            </button>
                          );
                        }
                      )}
                    </div>

                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {row.chamberIds.length
                        ? `Selected: ${row.chamberIds
                            .map(
                              (id) =>
                                `Chamber ${id}`
                            )
                            .join(", ")}`
                        : "No chamber selected"}
                    </p>
                  </div>
                )
              )}
            </div>

            {canAddTime && (
              <button
                type="button"
                onClick={addTime}
                disabled={saving}
                className="mt-3 flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 dark:text-blue-400"
              >
                <Plus className="h-4 w-4" />
                Add another time
              </button>
            )}

            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              A chamber may be shared by medicines
              scheduled at the same time. It cannot
              be reused at a different time during
              the same daily loading cycle.
            </p>
          </div>

          <div>
            <label
              htmlFor="medicine-notes"
              className={labelClass}
            >
              Notes (optional)
            </label>

            <textarea
              id="medicine-notes"
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value
                )
              }
              placeholder="e.g. Take with food"
              disabled={saving}
              rows={2}
              className="min-h-24 w-full min-w-0 resize-y rounded-md border border-input bg-transparent px-2.5 py-2.5 text-base shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
            />
          </div>
        </form>

        <div className="rx-modal-actions flex shrink-0 flex-col-reverse gap-2.5 border-t border-gray-200 bg-white px-4 py-3.5 dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:gap-3 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rx-press w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 sm:flex-1"
          >
            Cancel
          </button>

          <Button
            type="submit"
            form="medicine-form"
            loading={saving}
            loadingText="Saving…"
            className="h-11 w-full sm:h-9 sm:flex-1"
          >
            {initialData
              ? "Save Changes"
              : "Add Medicine"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MedicineModal;
