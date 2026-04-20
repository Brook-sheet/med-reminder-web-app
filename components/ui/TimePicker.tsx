"use client";
// components/ui/TimePicker.tsx

import React, { useReducer, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AmPm = "AM" | "PM";

interface TimeState {
  hour12: number;
  minute: number;
  ampm: AmPm;
}

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTime(timeStr: string): TimeState {
  // Match "8:00 AM" or "08:30 PM"
  const ampmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    return {
      hour12: parseInt(ampmMatch[1], 10),
      minute: parseInt(ampmMatch[2], 10),
      ampm: ampmMatch[3].toUpperCase() as AmPm,
    };
  }

  // Match "08:00" 24-hour
  const plainMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (plainMatch) {
    let h = parseInt(plainMatch[1], 10);
    const m = parseInt(plainMatch[2], 10);
    const period: AmPm = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return { hour12: h, minute: m, ampm: period };
  }

  // Default fallback
  return { hour12: 8, minute: 0, ampm: "AM" };
}

function buildTimeString(state: TimeState): string {
  return `${state.hour12}:${state.minute.toString().padStart(2, "0")} ${state.ampm}`;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

type Action =
  | { type: "SET_HOUR"; payload: number }
  | { type: "SET_MINUTE"; payload: number }
  | { type: "SET_AMPM"; payload: AmPm }
  | { type: "SYNC"; payload: TimeState };

function reducer(state: TimeState, action: Action): TimeState {
  switch (action.type) {
    case "SET_HOUR":
      return { ...state, hour12: action.payload };
    case "SET_MINUTE":
      return { ...state, minute: action.payload };
    case "SET_AMPM":
      return { ...state, ampm: action.payload };
    case "SYNC":
      return action.payload;
    default:
      return state;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, disabled = false }) => {
  const [state, dispatch] = useReducer(reducer, parseTime(value || "8:00 AM"));

  // Sync internal state when the parent changes the value prop
  useEffect(() => {
    dispatch({ type: "SYNC", payload: parseTime(value || "8:00 AM") });
  }, [value]);

  const handleHour = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const h = parseInt(e.target.value, 10);
    dispatch({ type: "SET_HOUR", payload: h });
    onChange(buildTimeString({ ...state, hour12: h }));
  };

  const handleMinute = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const m = parseInt(e.target.value, 10);
    dispatch({ type: "SET_MINUTE", payload: m });
    onChange(buildTimeString({ ...state, minute: m }));
  };

  const handleAmpm = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const a = e.target.value as AmPm;
    dispatch({ type: "SET_AMPM", payload: a });
    onChange(buildTimeString({ ...state, ampm: a }));
  };

  const cls =
    "h-9 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm outline-none " +
    "focus:border-blue-400 focus:ring-2 focus:ring-blue-200 " +
    "disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

  return (
    <div className="flex items-center gap-1">
      {/* Hour 1–12 */}
      <select
        value={state.hour12}
        onChange={handleHour}
        disabled={disabled}
        className={cls}
        aria-label="Hour"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>

      <span className="text-gray-500 font-bold select-none">:</span>

      {/* Minutes 00–55 in 5-minute steps */}
      <select
        value={state.minute}
        onChange={handleMinute}
        disabled={disabled}
        className={cls}
        aria-label="Minute"
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59].map((m) => (
          <option key={m} value={m}>
            {m.toString().padStart(2, "0")}
          </option>
        ))}
      </select>

      {/* AM / PM */}
      <select
        value={state.ampm}
        onChange={handleAmpm}
        disabled={disabled}
        className={cls}
        aria-label="AM or PM"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

export default TimePicker;

