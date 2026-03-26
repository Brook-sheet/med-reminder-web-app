"use client";

import React, { useEffect, useState, useCallback } from "react";
import StatCard from "@/components/dashboard/StatCard";
import HistoryItem from "@/components/dashboard/history/HistoryItems";

interface LogEntry {
  _id: string;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  scheduledDate: string;
  status: "taken" | "missed" | "pending" | "reminder";
  source: string;
  takenAt?: string;
}

interface HistoryData {
  summary: { totalTaken: number; totalMissed: number; successRate: number };
  today: LogEntry[];
  lastWeek: LogEntry[];
  thisMonth: LogEntry[];
}

const statusMap = (status: LogEntry["status"]): "Taken" | "Reminder" | "Missed" => {
  if (status === "taken") return "Taken";
  if (status === "missed") return "Missed";
  return "Reminder";
};

const descriptionMap = (log: LogEntry): string => {
  if (log.status === "taken") return `Successfully taken on time${log.source === "sensor" ? " (sensor confirmed)" : ""}`;
  if (log.status === "missed") return "Missed dose";
  if (log.status === "reminder") return "Reminder sent — awaiting confirmation";
  return "Pending";
};

const History = () => {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  const handleMarkTaken = async (logId: string) => {
    await fetch("/api/history", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logId, status: "taken" }),
    });
    fetchHistory();
  };

  const renderSection = (title: string, logs: LogEntry[]) => (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">{title}</h2>
      {logs.length === 0 ? (
        <p className="text-gray-400 text-sm">No records for this period.</p>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <div key={log._id} className="relative group">
              <HistoryItem
                medicationName={`${log.medicineName} ${log.dosage}`}
                time={log.scheduledTime}
                status={statusMap(log.status)}
                description={descriptionMap(log)}
              />
              {log.status === "pending" && (
                <button
                  onClick={() => handleMarkTaken(log._id)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs bg-green-600 text-white px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-green-700"
                >
                  Mark Taken
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">History</h1>
          <p className="text-gray-600 mt-2">View your medication intake history</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Total Taken"
            value={loading ? "—" : String(data?.summary.totalTaken ?? 0)}
            subtitle="Medicines taken this month"
            className="bg-green-50 border border-green-200 rounded-lg"
          />
          <StatCard
            title="Total Missed"
            value={loading ? "—" : String(data?.summary.totalMissed ?? 0)}
            subtitle="Medicines missed this month"
            className="bg-red-50 border border-red-200 rounded-lg"
          />
          <StatCard
            title="Success Rate"
            value={loading ? "—" : `${data?.summary.successRate ?? 0}%`}
            subtitle="Medication adherence rate"
            className="bg-blue-50 border border-blue-200 rounded-lg"
          />
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
                <div className="space-y-3">
                  <div className="h-16 bg-gray-100 rounded" />
                  <div className="h-16 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {renderSection("Today", data?.today ?? [])}
            {renderSection("Last Week", data?.lastWeek ?? [])}
            {renderSection("This Month", data?.thisMonth ?? [])}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
