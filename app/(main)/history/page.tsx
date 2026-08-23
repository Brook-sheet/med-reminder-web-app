"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock,
  Cpu,
  Pill,
  ShieldAlert,
  X,
} from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";

type Range = "today" | "week" | "month" | "custom";
type Status = "upcoming" | "due" | "pending" | "taken" | "late" | "missed" | "unverified" | "incorrect_chamber";

interface LogEntry {
  _id: string;
  medicineId: string | null;
  medicineName: string;
  dosage: string;
  scheduledDate: string;
  scheduledTime: string;
  actualTime?: string | null;
  status: Status;
  delayMinutes: number | null;
  source: "manual" | "sensor" | "system";
  verificationMethod: string;
  expectedChamberId: number | null;
  detectedChamberId: number | null;
  expectedChamberIds: number[];
  verificationNote: string;
}

interface MedicineStat {
  medicineId: string | null;
  medicineName: string;
  scheduled: number;
  verified: number;
  onTime: number;
  late: number;
  missed: number;
  incorrectChamber: number;
  adherenceRate: number | null;
}

interface HistoryData {
  summary: {
    totalScheduled: number;
    verified: number;
    onTime: number;
    late: number;
    missed: number;
    unverified: number;
    incorrectChamber: number;
    adherenceRate: number | null;
  };
  byMedicine: MedicineStat[];
  logs: LogEntry[];
}

const FILTERS: Array<{ value: Range; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "custom", label: "Custom Range" },
];

const STATUS = {
  upcoming: {
    label: "Upcoming",
    Icon: Clock,
    badge: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    border: "border-l-blue-400",
  },
  due: {
    label: "Due / Pending",
    Icon: Clock,
    badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
    border: "border-l-amber-500",
  },
  taken: {
    label: "Verified",
    Icon: Check,
    badge: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
    border: "border-l-green-500",
  },
  late: {
    label: "Late",
    Icon: Clock,
    badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
    border: "border-l-amber-500",
  },
  missed: {
    label: "Missed",
    Icon: X,
    badge: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
    border: "border-l-red-500",
  },
  incorrect_chamber: {
    label: "Incorrect Chamber",
    Icon: ShieldAlert,
    badge: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
    border: "border-l-red-500",
  },
  unverified: {
    label: "Unverified",
    Icon: AlertTriangle,
    badge: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
    border: "border-l-gray-400",
  },
  pending: {
    label: "Pending",
    Icon: Clock,
    badge: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    border: "border-l-blue-400",
  },
} satisfies Record<Status, {
  label: string;
  Icon: typeof Check;
  badge: string;
  border: string;
}>;

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

function monthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
}

function actualTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function dateHeading(value: string): string {
  if (value === todayString()) return "Today";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function LogCard({ log }: { log: LogEntry }) {
  const config = STATUS[log.status];
  const Icon = config.Icon;
  const chamberText = log.status === "incorrect_chamber"
    ? `Detected ${log.detectedChamberId ?? "—"} · Expected ${log.expectedChamberIds.join(", ") || log.expectedChamberId || "—"}`
    : log.expectedChamberId
      ? `Chamber ${log.expectedChamberId}`
      : "No chamber assigned";

  return (
    <div className={`rounded-[18px] border border-border/70 border-l-4 ${config.border} bg-card p-4 shadow-sm`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background">
          <Icon className="h-4 w-4 text-gray-500 dark:text-gray-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {log.medicineName} <span className="font-normal text-gray-400">{log.dosage}</span>
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Scheduled {log.scheduledTime} · Actual {actualTime(log.actualTime)}
              </p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${config.badge}`}>
              {config.label}
            </span>
          </div>

          <div className="mt-3 grid gap-2 text-xs text-gray-500 dark:text-gray-400 sm:grid-cols-2">
            <span className="flex items-center gap-1.5"><Pill className="h-3.5 w-3.5" />{chamberText}</span>
            <span className="flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5" />{log.verificationMethod}</span>
          </div>
          {log.verificationNote && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{log.verificationNote}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [range, setRange] = useState<Range>("month");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayString());
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchHistory = useCallback(async () => {
    if (range === "custom" && (!from || !to || from > to)) return;
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ range });
      if (range === "custom") {
        query.set("from", from);
        query.set("to", to);
      }
      const response = await fetch(`/api/history?${query.toString()}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Failed to load history.");
      setData(json.data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load history.");
    } finally {
      setLoading(false);
    }
  }, [from, range, to]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const groupedLogs = useMemo(() => {
    const groups = new Map<string, LogEntry[]>();
    for (const log of data?.logs ?? []) {
      groups.set(log.scheduledDate, [...(groups.get(log.scheduledDate) ?? []), log]);
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [data]);

  const summary = data?.summary;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-7">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">History</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Medication verification records and adherence reporting
          </p>
        </div>

        <div className="rounded-[20px] border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setRange(filter.value)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  range === filter.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {range === "custom" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-gray-600 dark:text-gray-300">
                From
                <input
                  type="date"
                  value={from}
                  max={to}
                  onChange={(event) => setFrom(event.target.value)}
                  className="mt-1 block h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm"
                />
              </label>
              <label className="text-sm text-gray-600 dark:text-gray-300">
                To
                <input
                  type="date"
                  value={to}
                  min={from}
                  max={todayString()}
                  onChange={(event) => setTo(event.target.value)}
                  className="mt-1 block h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm"
                />
              </label>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Adherence" value={loading || summary?.adherenceRate == null ? "—" : `${summary.adherenceRate}%`} subtitle={summary?.adherenceRate == null ? "No completed medication events yet" : "Late doses receive half credit"} />
          <StatCard title="Verified" value={loading ? "—" : String(summary?.verified ?? 0)} subtitle={`${summary?.onTime ?? 0} on time · ${summary?.late ?? 0} late`} />
          <StatCard title="Missed" value={loading ? "—" : String(summary?.missed ?? 0)} subtitle={`${summary?.totalScheduled ?? 0} scheduled doses evaluated`} />
          <StatCard title="Verification Issues" value={loading ? "—" : String((summary?.incorrectChamber ?? 0) + (summary?.unverified ?? 0))} subtitle={`${summary?.incorrectChamber ?? 0} incorrect chamber · ${summary?.unverified ?? 0} unverified`} />
        </div>

        <section className="rounded-[28px] border border-border/70 bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Medication Performance</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(data?.byMedicine ?? []).map((medicine) => (
              <div key={medicine.medicineId || medicine.medicineName} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-gray-900 dark:text-white">{medicine.medicineName}</p>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{medicine.adherenceRate == null ? "—" : `${medicine.adherenceRate}%`}</span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs text-gray-500 dark:text-gray-400">
                  <span><b className="block text-base text-gray-900 dark:text-white">{medicine.scheduled}</b>Due</span>
                  <span><b className="block text-base text-green-600">{medicine.verified}</b>Verified</span>
                  <span><b className="block text-base text-amber-600">{medicine.late}</b>Late</span>
                  <span><b className="block text-base text-red-600">{medicine.missed}</b>Missed</span>
                </div>
              </div>
            ))}
            {!loading && (data?.byMedicine.length ?? 0) === 0 && (
              <p className="text-sm text-gray-500">No medication performance data for this range.</p>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-border/70 bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Medication Activity</h2>
          </div>
          <div className="mt-5 space-y-6">
            {groupedLogs.map(([date, logs]) => (
              <div key={date} className="space-y-2">
                <p className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">{dateHeading(date)}</p>
                {logs.map((log) => <LogCard key={log._id} log={log} />)}
              </div>
            ))}
            {!loading && groupedLogs.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-gray-500">
                No medication activity for this range.
              </div>
            )}
            {loading && <p className="text-sm text-gray-500">Loading medication records…</p>}
          </div>
        </section>
      </div>
    </div>
  );
}