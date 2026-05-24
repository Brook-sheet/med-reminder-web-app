"use client";
import React, { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import TimePicker from "@/components/ui/TimePicker";
import type { Medicine } from "@/lib/interfaces/data/Medicine";

interface MedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    data: Omit<Medicine, "_id" | "userId" | "createdAt" | "updatedAt" | "isActive">
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

const FIXED_SCHEDULE_COUNTS: Record<string, number> = {
  "Once daily": 1,
  "Twice daily": 2,
  "Three times daily": 3,
};

const INTERVAL_SCHEDULE_HOURS: Record<string, number> = {
  "Every 4 hours": 4,
  "Every 6 hours": 6,
  "Every 8 hours": 8,
};

const DEFAULT_FIXED_TIMES: Record<number, string[]> = {
  1: ["8:00 AM"],
  2: ["8:00 AM", "8:00 PM"],
  3: ["8:00 AM", "2:00 PM", "8:00 PM"],
};

const MedicineModal: React.FC<MedicineModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("Once daily");
  const [scheduledTimes, setScheduledTimes] = useState<string[]>(["8:00 AM"]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().split("T")[0];

  const parseDosageValue = (raw: string) => raw.replace(/\D/g, "");

  const parseTime = (timeStr: string) => {
    const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(timeStr);
    if (!match) {
      return { hour12: 8, minute: 0, ampm: "AM" as const };
    }
    return {
      hour12: Number(match[1]),
      minute: Number(match[2]),
      ampm: match[3].toUpperCase() as "AM" | "PM",
    };
  };

  const timeStringToMinutes = (timeStr: string) => {
    const { hour12, minute, ampm } = parseTime(timeStr);
    let hour24 = hour12 % 12;
    if (ampm === "PM") hour24 += 12;
    return hour24 * 60 + minute;
  };

  const minutesToTimeString = (minutes: number) => {
    const normalized = ((minutes % 1440) + 1440) % 1440;
    const hour24 = Math.floor(normalized / 60);
    const minute = normalized % 60;
    const ampm = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${hour12}:${minute.toString().padStart(2, "0")} ${ampm}`;
  };

  const normalizeTimes = (times: string[]) => {
    const seen = new Set<number>();
    return times
      .map((time) => time.trim())
      .filter((time) => time.length > 0)
      .map((time) => ({
        original: time,
        minutes: timeStringToMinutes(time),
      }))
      .filter(({ minutes }) => !Number.isNaN(minutes))
      .filter(({ minutes }) => {
        if (seen.has(minutes)) return false;
        seen.add(minutes);
        return true;
      })
      .map(({ minutes }) => minutesToTimeString(minutes));
  };

  const buildIntervalTimes = (startTime: string, intervalHours: number) => {
    const baseMinutes = timeStringToMinutes(startTime);
    const counts = 24 / intervalHours;
    const times: string[] = [];
    for (let i = 0; i < counts; i += 1) {
      times.push(minutesToTimeString(baseMinutes + i * intervalHours * 60));
    }
    return times;
  };

  const getScheduledTimesForFrequency = (freq: string, currentTimes: string[]) => {
    const normalized = normalizeTimes(currentTimes);
    if (FIXED_SCHEDULE_COUNTS[freq]) {
      const required = FIXED_SCHEDULE_COUNTS[freq];
      const result = normalized.slice(0, required);
      while (result.length < required) {
        result.push(DEFAULT_FIXED_TIMES[required][result.length]);
      }
      return result;
    }

    const intervalHours = INTERVAL_SCHEDULE_HOURS[freq];
    if (intervalHours) {
      const seed = normalized.length > 0 ? normalized[0] : DEFAULT_FIXED_TIMES[1][0];
      return buildIntervalTimes(seed, intervalHours);
    }

    if (normalized.length > 0) {
      return normalized;
    }

    return ["8:00 AM"];
  };

  const canAddTime = (freq: string) => freq === "As needed" || freq === "Weekly";
  const canRemoveTime = (freq: string) => freq === "As needed" || freq === "Weekly";
  const isIntervalFrequency = (freq: string) => INTERVAL_SCHEDULE_HOURS[freq] !== undefined;
  const isFixedFrequency = (freq: string) => FIXED_SCHEDULE_COUNTS[freq] !== undefined;

  const scheduleHelpText = (() => {
    if (isFixedFrequency(frequency)) {
      const count = FIXED_SCHEDULE_COUNTS[frequency];
      return `Select ${count} time${count === 1 ? "" : "s"} for this schedule.`;
    }
    if (isIntervalFrequency(frequency)) {
      return `Choose the first time and reminders will be generated every ${INTERVAL_SCHEDULE_HOURS[frequency]} hours.`;
    }
    if (frequency === "As needed") {
      return "Add as many times as needed for this medicine.";
    }
    return "Choose one or more reminder times for this medicine.";
  })();

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDosage(parseDosageValue(initialData.dosage));
      setFrequency(initialData.frequency);
      setScheduledTimes(
        initialData.scheduledTimes.length > 0 ? initialData.scheduledTimes : ["8:00 AM"]
      );
      setStartDate(initialData.startDate || today);
      setEndDate(initialData.endDate || "");
      setNotes(initialData.notes || "");
    } else {
      setName("");
      setDosage("");
      setFrequency("Once daily");
      setScheduledTimes(["8:00 AM"]);
      setStartDate(today);
      setEndDate("");
      setNotes("");
    }
    setError("");
  }, [initialData, isOpen, today]);

  useEffect(() => {
    setScheduledTimes((prev) => getScheduledTimesForFrequency(frequency, prev));
  }, [frequency]);

  const getNextAvailableTime = (existing: string[]) => {
    const used = new Set(existing.map((t) => timeStringToMinutes(t)));
    for (let minutes = 8 * 60; minutes < 24 * 60; minutes += 30) {
      if (!used.has(minutes)) return minutesToTimeString(minutes);
    }
    for (let minutes = 0; minutes < 8 * 60; minutes += 30) {
      if (!used.has(minutes)) return minutesToTimeString(minutes);
    }
    return "8:00 AM";
  };

  const addTime = () =>
    setScheduledTimes((prev) => normalizeTimes([...prev, getNextAvailableTime(prev)]));

  const removeTime = (i: number) =>
    setScheduledTimes((prev) => prev.filter((_, idx) => idx !== i));

  const updateTime = (i: number, val: string) => {
    if (isIntervalFrequency(frequency) && i === 0) {
      setScheduledTimes(buildIntervalTimes(val, INTERVAL_SCHEDULE_HOURS[frequency]));
      return;
    }

    setScheduledTimes((prev) => {
      const nextTimes = normalizeTimes(prev.map((t, idx) => (idx === i ? val : t)));
      if (isFixedFrequency(frequency)) {
        return getScheduledTimesForFrequency(frequency, nextTimes);
      }
      return nextTimes;
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Medicine name is required.");
      return;
    }
    if (!dosage.trim() || !/^\d+$/.test(dosage.trim())) {
      setError("Dosage is required and must be a number.");
      return;
    }
    if (!startDate) {
      setError("Start date is required.");
      return;
    }

    if (startDate < today) {
      setError("Start date cannot be in the past.");
      return;
    }

    if (endDate && endDate < startDate) {
      setError("End date cannot be before start date.");
      return;
    }
    if (scheduledTimes.length === 0) {
      setError("At least one scheduled time is required.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name,
        dosage: `${dosage.trim()}mg`,
        frequency,
        scheduledTimes,
        startDate,
        endDate: endDate || undefined,
        notes,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {initialData ? "Edit Medicine" : "Add New Medicine"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Medicine Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aspirin"
              disabled={saving}
              className="w-full h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Dosage <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min="1"
                step="1"
                value={dosage}
                onChange={(e) => setDosage(parseDosageValue(e.target.value))}
                placeholder="100"
                disabled={saving}
                className="w-full h-9 rounded-md border border-input bg-transparent px-2.5 pr-14 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                mg
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={today}
              disabled={saving}
              className="w-full h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Reminders will begin from this date</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Date <span className="text-gray-400 text-xs font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || today}
              disabled={saving}
              className="w-full h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Leave blank if the medicine has no end date</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              disabled={saving}
              className="w-full h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Scheduled Times <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {scheduleHelpText}
            </p>
            <div className="space-y-2">
              {scheduledTimes.map((time, index) => (
                <div key={time} className="flex items-center gap-2">
                  <TimePicker
                    value={time}
                    onChange={(val) => updateTime(index, val)}
                    disabled={saving || (isIntervalFrequency(frequency) && index !== 0)}
                  />
                  {canRemoveTime(frequency) && scheduledTimes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTime(index)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      disabled={saving}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canAddTime(frequency) && (
              <button
                type="button"
                onClick={addTime}
                disabled={saving}
                className="mt-2 flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                <Plus className="w-4 h-4" /> Add another time
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Take with food"
              disabled={saving}
              rows={2}
              className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 resize-none disabled:opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Saving..." : initialData ? "Save Changes" : "Add Medicine"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MedicineModal;