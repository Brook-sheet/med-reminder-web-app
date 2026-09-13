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

const getToday = () =>
  new Date()
    .toISOString()
    .split("T")[0];

const MedicineModal: React.FC<
  MedicineModalProps
> = ({
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
    getToday()
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

  const [
    mounted,
    setMounted,
  ] = useState(false);

  /*
   * Portals need a DOM target, which does not exist during SSR.
   */
  useEffect(() => {
    setMounted(true);

    return () => {
      setMounted(false);
    };
  }, []);

  /*
   * Prevent the page behind the modal from scrolling.
   */
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

  /*
   * Close the modal with Escape.
   */
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

  const today = getToday();

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
      /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(
        timeStr.trim()
      );

    if (!match) {
      return {
        hour12: 8,
        minute: 0,
        ampm: "AM" as const,
      };
    }

    const hour12 =
      Number(match[1]);

    const minute =
      Number(match[2]);

    const ampm =
      match[3].toUpperCase() as
        | "AM"
        | "PM";

    /*
     * Protect against invalid hours/minutes.
     */
    if (
      hour12 < 1 ||
      hour12 > 12 ||
      minute < 0 ||
      minute > 59
    ) {
      return {
        hour12: 8,
        minute: 0,
        ampm: "AM" as const,
      };
    }

    return {
      hour12,
      minute,
      ampm,
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
      ((minutes % 1440) +
        1440) %
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

    return `${hour12}:${minute
      .toString()
      .padStart(
        2,
        "0"
      )} ${ampm}`;
  };

  const normalizeTimes = (
    times: string[]
  ) => {
    const seen =
      new Set<number>();

    return times
      .map((time) =>
        time.trim()
      )
      .filter(
        (time) =>
          time.length > 0
      )
      .map((time) => ({
        original: time,
        minutes:
          timeStringToMinutes(
            time
          ),
      }))
      .filter(
        ({
          minutes,
        }) =>
          Number.isFinite(
            minutes
          )
      )
      .filter(
        ({
          minutes,
        }) => {
          if (
            seen.has(minutes)
          ) {
            return false;
          }

          seen.add(minutes);

          return true;
        }
      )
      .sort(
        (a, b) =>
          a.minutes -
          b.minutes
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

    const count =
      24 / intervalHours;

    const times: string[] =
      [];

    for (
      let i = 0;
      i < count;
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

  const getScheduledTimesForFrequency =
    (
      selectedFrequency: string,
      currentTimes: string[]
    ) => {
      const normalized =
        normalizeTimes(
          currentTimes
        );

      /*
       * Fixed schedules:
       * Once daily       -> 1 time
       * Twice daily      -> 2 times
       * Three times      -> 3 times
       */
      const fixedCount =
        FIXED_SCHEDULE_COUNTS[
          selectedFrequency
        ];

      if (fixedCount) {
        const result =
          normalized.slice(
            0,
            fixedCount
          );

        while (
          result.length <
          fixedCount
        ) {
          const defaults =
            DEFAULT_FIXED_TIMES[
              fixedCount
            ];

          const nextDefault =
            defaults[
              result.length
            ];

          if (nextDefault) {
            result.push(
              nextDefault
            );
          } else {
            result.push(
              getNextAvailableTime(
                result
              )
            );
          }
        }

        return result;
      }

      /*
       * Interval schedules:
       * Every 4 hours -> 6 times
       * Every 6 hours -> 4 times
       * Every 8 hours -> 3 times
       */
      const intervalHours =
        INTERVAL_SCHEDULE_HOURS[
          selectedFrequency
        ];

      if (intervalHours) {
        const seed =
          normalized.length >
          0
            ? normalized[0]
            : "8:00 AM";

        return buildIntervalTimes(
          seed,
          intervalHours
        );
      }

      /*
       * Weekly / As needed.
       */
      if (
        normalized.length >
        0
      ) {
        return normalized;
      }

      return ["8:00 AM"];
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

        return `Select ${count} time${
          count === 1
            ? ""
            : "s"
        } for this schedule.`;
      }

      if (
        isIntervalFrequency(
          frequency
        )
      ) {
        return `Choose the first time and reminders will be generated every ${
          INTERVAL_SCHEDULE_HOURS[
            frequency
          ]
        } hours.`;
      }

      if (
        frequency ===
        "As needed"
      ) {
        return "Add as many times as needed for this medicine.";
      }

      return "Choose one or more reminder times for this medicine.";
    })();

  /*
   * Load edit data / reset add form.
   */
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
          initialData.dosage ??
            ""
        )
      );

      setFrequency(
        initialData.frequency ??
          "Once daily"
      );

      setScheduledTimes(
        initialData
          .scheduledTimes
          ?.length > 0
          ? initialData.scheduledTimes
          : ["8:00 AM"]
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

  /*
   * Rebuild scheduled times when frequency changes.
   */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setScheduledTimes(
      (previous) =>
        getScheduledTimesForFrequency(
          frequency,
          previous
        )
    );
  }, [
    frequency,
    isOpen,
  ]);

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

    /*
     * Prefer times between 8 AM and midnight.
     */
    for (
      let minutes = 8 * 60;
      minutes < 24 * 60;
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

    /*
     * Then search midnight through 8 AM.
     */
    for (
      let minutes = 0;
      minutes < 8 * 60;
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
          (_, index) =>
            index !==
            indexToRemove
        )
    );
  };

  const updateTime = (
    indexToUpdate: number,
    value: string
  ) => {
    /*
     * For interval frequencies only the first
     * time is editable. The remaining times
     * are generated automatically.
     */
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
        const updated =
          previous.map(
            (
              time,
              index
            ) =>
              index ===
              indexToUpdate
                ? value
                : time
          );

        const nextTimes =
          normalizeTimes(
            updated
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
      event: React.FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      setError("");

      const trimmedName =
        name.trim();

      const trimmedDosage =
        dosage.trim();

      /*
       * Medicine name validation.
       */
      if (!trimmedName) {
        setError(
          "Medicine name is required."
        );

        return;
      }

      /*
       * Dosage validation.
       */
      if (
        !trimmedDosage ||
        !/^\d+$/.test(
          trimmedDosage
        ) ||
        Number(trimmedDosage) < 1
      ) {
        setError(
          "Dosage is required and must be a number greater than 0."
        );

        return;
      }

      /*
       * Start date validation.
       */
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

      /*
       * End date validation.
       */
      if (
        endDate &&
        endDate < startDate
      ) {
        setError(
          "End date cannot be before start date."
        );

        return;
      }

      /*
       * Scheduled times validation.
       */
      const normalizedScheduledTimes =
        normalizeTimes(
          scheduledTimes
        );

      if (
        normalizedScheduledTimes.length ===
        0
      ) {
        setError(
          "At least one scheduled time is required."
        );

        return;
      }

      /*
       * Make sure fixed schedules contain
       * exactly the required number of times.
       */
      const requiredCount =
        FIXED_SCHEDULE_COUNTS[
          frequency
        ];

      if (
        requiredCount &&
        normalizedScheduledTimes.length !==
          requiredCount
      ) {
        setError(
          `This frequency requires exactly ${requiredCount} scheduled time${
            requiredCount === 1
              ? ""
              : "s"
          }.`
        );

        return;
      }

      /*
       * Pills per dose validation.
       */
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
          name: trimmedName,

          dosage: `${trimmedDosage}mg`,

          frequency,

          scheduledTimes:
            normalizedScheduledTimes,

          startDate,

          endDate:
            endDate || undefined,

          notes: notes.trim(),

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

  if (
    !isOpen ||
    !mounted
  ) {
    return null;
  }

  /*
   * Render into <body> so the modal is above
   * page-level stacking contexts and fixed
   * navigation/brand bars.
   */
  return createPortal(
    <div
      className="rx-modal fixed inset-0 z-[120] flex items-center justify-center overflow-hidden p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="medicine-modal-title"
    >
      {/*
       * Fixed backdrop prevents mobile browser
       * viewport changes from leaving an exposed strip.
       */}
      <div
        className="rx-overlay-in fixed inset-0 h-[100lvh] w-full bg-black/50 backdrop-blur-sm"
        onClick={() => {
          if (!saving) {
            onClose();
          }
        }}
        aria-hidden="true"
      />

      {/*
       * Modal card.
       *
       * svh keeps the card inside the currently
       * visible mobile viewport.
       *
       * max-height prevents the card from becoming
       * unnecessarily tall on large displays.
       */}
      <div className="rx-modal-panel rx-dialog-in relative z-[121] flex max-h-[min(44rem,calc(100svh-2rem))] w-full min-w-0 max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800 sm:max-h-[min(46rem,calc(100svh-3rem))]">
        {/* Header */}
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
            className="rx-press shrink-0 rounded-lg p-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-700"
            aria-label="Close medicine form"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Scrollable form content */}
        <form
          id="medicine-form"
          onSubmit={
            handleSubmit
          }
          className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6"
        >
          {error && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Medicine name */}
          <div>
            <label
              htmlFor="medicine-name"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
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
              onChange={(
                event
              ) =>
                setName(
                  event.target
                    .value
                )
              }
              placeholder="e.g. Aspirin"
              disabled={saving}
              autoComplete="off"
              className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Dosage */}
          <div>
            <label
              htmlFor="medicine-dosage"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
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
                disabled={saving}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 pr-14 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />

              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                mg
              </span>
            </div>
          </div>

          {/* Start date */}
          <div>
            <label
              htmlFor="medicine-start-date"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
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
              onChange={(
                event
              ) =>
                setStartDate(
                  event.target
                    .value
                )
              }
              min={today}
              disabled={saving}
              className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Reminders will
              begin from this
              date.
            </p>
          </div>

          {/* End date */}
          <div>
            <label
              htmlFor="medicine-end-date"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
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
              disabled={saving}
              className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Leave blank if
              the medicine has
              no end date.
            </p>
          </div>

          {/* Frequency */}
          <div>
            <label
              htmlFor="medicine-frequency"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Frequency
            </label>

            <select
              id="medicine-frequency"
              value={frequency}
              onChange={(
                event
              ) =>
                setFrequency(
                  event.target
                    .value
                )
              }
              disabled={saving}
              className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              {FREQUENCY_OPTIONS.map(
                (option) => (
                  <option
                    key={option}
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

          {/* Pills per dose */}
          <div>
            <label
              htmlFor="medicine-pills-per-dose"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Pills per
              scheduled dose{" "}
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
              onChange={(
                event
              ) => {
                const value =
                  event.target
                    .value;

                setPillsPerDose(
                  value === ""
                    ? 0
                    : Number(
                        value
                      )
                );
              }}
              disabled={saving}
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

          {/* Scheduled times */}
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
                    key={`${time}-${index}`}
                    className="flex min-w-0 items-center gap-2"
                  >
                    <TimePicker
                      value={time}
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
                        (isIntervalFrequency(
                          frequency
                        ) &&
                          index !==
                            0)
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
                          className="rx-press shrink-0 rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-900/20"
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
                onClick={addTime}
                disabled={saving}
                className="mt-2 flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <Plus className="h-4 w-4" />
                Add another
                time
              </button>
            )}
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="medicine-notes"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Notes (optional)
            </label>

            <textarea
              id="medicine-notes"
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
              disabled={saving}
              rows={2}
              className="w-full resize-none rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </form>

        {/*
         * Actions are outside the scroll area so
         * they remain reachable on small screens.
         *
         * form= keeps the submit button connected
         * to the form above.
         */}
        <div className="rx-modal-actions flex shrink-0 flex-col-reverse gap-2.5 border-t border-gray-200 bg-white px-4 py-3.5 dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:gap-3 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rx-press w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 sm:flex-1"
          >
            Cancel
          </button>

          <Button
            type="submit"
            form="medicine-form"
            loading={saving}
            loadingText="Saving…"
            className="w-full sm:flex-1"
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
