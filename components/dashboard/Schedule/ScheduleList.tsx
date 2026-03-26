"use client";

import React, { useState } from "react";
import ScheduleItem from "./ScheduleItem";
import type { ScheduleItem as ScheduleItemType } from "@/types";

interface ScheduleListProps {
  schedule: ScheduleItemType[];
  loading: boolean;
  onStatusChange?: () => void;
}

const ScheduleList: React.FC<ScheduleListProps> = ({ schedule, loading, onStatusChange }) => {
  const [markingId, setMarkingId] = useState<string | null>(null);

  const handleMarkTaken = async (logId: string) => {
    setMarkingId(logId);
    try {
      await fetch("/api/history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId, status: "taken" }),
      });
      onStatusChange?.();
    } catch (err) {
      console.error("Failed to mark as taken:", err);
    } finally {
      setMarkingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="bg-gray-100 rounded-lg h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  if (schedule.length === 0) {
    return (
      <p className="text-gray-400 text-sm">No medications scheduled for today.</p>
    );
  }

  return (
    <div className="space-y-4">
      {schedule.map((item) => (
        <div key={item.logId ?? item.medicineId} className="relative group">
          <ScheduleItem name={item.name} time={item.time} status={item.status} />
          {/* Show "Mark Taken" button for non-taken items */}
          {item.status !== "Taken" && item.logId && (
            <button
              onClick={() => handleMarkTaken(item.logId!)}
              disabled={markingId === item.logId}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs bg-green-600 text-white px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-green-700 disabled:opacity-50"
            >
              {markingId === item.logId ? "Saving..." : "Mark Taken"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default ScheduleList;
