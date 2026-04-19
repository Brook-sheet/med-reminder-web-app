/* eslint-disable react-hooks/set-state-in-effect */
"use client";
// components/ui/TimePicker.tsx
// A clean time picker that shows hours, minutes, and AM/PM selectors.
// Usage:
//   <TimePicker value="08:00 AM" onChange={(val) => console.log(val)} />
//   val is always in "8:00 AM" / "12:30 PM" format

import React, { useState, useEffect } from "react";

interface TimePickerProps {
  value: string;           // e.g. "8:00 AM"
  onChange: (value: string) => void;
  disabled?: boolean;
}

// Parse "8:00 AM" → { hour12: 8, minute: 0, ampm: "AM" }
function parseTime(timeStr: string): { hour12: number; minute: number; ampm: "AM" | "PM" } {
  // Try "8:00 AM" format
  const ampmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    return {
      hour12: parseInt(ampmMatch[1]),
      minute: parseInt(ampmMatch[2]),
      ampm: ampmMatch[3].toUpperCase() as "AM" | "PM",
    };
  }
  // Try "08:00" 24-hour format
  const plainMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (plainMatch) {
    let h = parseInt(plainMatch[1]);
    const m = parseInt(plainMatch[2]);
    const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return { hour12: h, minute: m, ampm };
  }
  // Default
  return { hour12: 8, minute: 0, ampm: "AM" };
}

// Build "8:00 AM" string
function formatTime(hour12: number, minute: number, ampm: "AM" | "PM"): string {
  return `${hour12}:${minute.toString().padStart(2, "0")} ${ampm}`;
}

const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, disabled }) => {
  const parsed = parseTime(value || "8:00 AM");
  const [hour12, setHour12] = useState(parsed.hour12);
  const [minute, setMinute] = useState(parsed.minute);
  const [ampm, setAmpm] = useState<"AM" | "PM">(parsed.ampm);

  // Sync when value prop changes externally
  useEffect(() => {
    const p = parseTime(value || "8:00 AM");
    setHour12(p.hour12);
    setMinute(p.minute);
    setAmpm(p.ampm);
  }, [value]);

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const h = parseInt(e.target.value);
    setHour12(h);
    onChange(formatTime(h, minute, ampm));
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const m = parseInt(e.target.value);
    setMinute(m);
    onChange(formatTime(hour12, m, ampm));
  };

  const handleAmpmChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const a = e.target.value as "AM" | "PM";
    setAmpm(a);
    onChange(formatTime(hour12, minute, a));
  };

  const selectClass =
    "h-9 rounded-md border border-input bg-white px-2 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

  return (
    <div className="flex items-center gap-1">
      {/* Hour */}
      <select
        value={hour12}
        onChange={handleHourChange}
        disabled={disabled}
        className={selectClass}
        aria-label="Hour"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>

      <span className="text-gray-500 font-bold">:</span>

      {/* Minute */}
      <select
        value={minute}
        onChange={handleMinuteChange}
        disabled={disabled}
        className={selectClass}
        aria-label="Minute"
      >
        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
          <option key={m} value={m}>
            {m.toString().padStart(2, "0")}
          </option>
        ))}
      </select>

      {/* AM/PM */}
      <select
        value={ampm}
        onChange={handleAmpmChange}
        disabled={disabled}
        className={selectClass}
        aria-label="AM or PM"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

export default TimePicker;