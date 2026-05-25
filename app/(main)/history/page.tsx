"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Check, X, Clock, AlertTriangle, Pill } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";

// ── Types ──────────────────────────────────────────────────────────────────

type ClassifiedStatus = "taken" | "delayed" | "missed";

interface LogEntry {
  _id: string;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  scheduledDate: string;
  status: string;
  classifiedStatus: ClassifiedStatus;
  delayMinutes: number | null;
  source: string;
  takenAt?: string | null;
}

interface HistorySummary {
  /**
   * totalTaken = onTime + totalDelayed  (all confirmed doses, used as card headline)
   * onTime     = confirmed within 30-min grace window
   * totalDelayed = confirmed after 30 min but within 2 hrs
   */
  totalTaken: number;
  onTime: number;
  totalDelayed: number;
  totalMissed: number;
  totalRecords: number;
  successRate: number;
}

interface HistoryData {
  summary: HistorySummary;
  today: LogEntry[];
  thisWeek: LogEntry[];
  thisMonth: LogEntry[];
  earlier: LogEntry[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatScheduledTime(timeStr: string): string {
  if (!timeStr) return "";
  const ampm = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) return timeStr.trim();
  const plain = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (plain) {
    const h = parseInt(plain[1]);
    const m = plain[2];
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m} ${period}`;
  }
  return timeStr;
}

function formatTakenAt(takenAt: string | null | undefined): string {
  if (!takenAt) return "";
  const d = new Date(takenAt);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateHeading(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Groups logs by scheduledDate, most recent date first. */
function groupByDate(logs: LogEntry[]): { date: string; entries: LogEntry[] }[] {
  const map = new Map<string, LogEntry[]>();
  for (const log of logs) {
    const existing = map.get(log.scheduledDate) ?? [];
    existing.push(log);
    map.set(log.scheduledDate, existing);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, entries]) => ({ date, entries }));
}

/** Formats delayMinutes into a human-readable string like "47 minutes" or "1h 12m". */
function formatDelay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m} minute${m !== 1 ? "s" : ""}`;
}

// ── Status Config ──────────────────────────────────────────────────────────
// Single source of truth for badge/border/icon per status.

const STATUS_CONFIG: Record<
  ClassifiedStatus,
  {
    label: string;
    badgeClass: string;
    iconClass: string;
    borderClass: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  taken: {
    label: "Taken",
    badgeClass:
      "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800",
    iconClass: "text-green-500 dark:text-green-400",
    borderClass: "border-l-green-500",
    Icon: Check,
  },
  delayed: {
    label: "Delayed",
    badgeClass:
      "bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600",
    iconClass: "text-gray-400 dark:text-gray-500",
    borderClass: "border-l-gray-400",
    Icon: AlertTriangle,
  },
  missed: {
    label: "Missed",
    badgeClass:
      "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800",
    iconClass: "text-red-500 dark:text-red-400",
    borderClass: "border-l-red-500",
    Icon: X,
  },
};

// ── Medication History Card ────────────────────────────────────────────────

function MedCard({ log }: { log: LogEntry }) {
  // Always derive display from classifiedStatus — never from raw log.status
  const cfg = STATUS_CONFIG[log.classifiedStatus];
  const { Icon } = cfg;
  const takenTime = formatTakenAt(log.takenAt);

  // Build the human-readable detail line
  let detail = "";
  if (log.classifiedStatus === "taken") {
    detail = takenTime ? `Taken at ${takenTime}` : "Intake confirmed";
  } else if (log.classifiedStatus === "delayed") {
    const delayStr =
      log.delayMinutes !== null && log.delayMinutes !== undefined
        ? formatDelay(log.delayMinutes)
        : null;
    if (takenTime && delayStr) {
      detail = `Taken at ${takenTime} — Delayed by ${delayStr}`;
    } else if (delayStr) {
      detail = `Delayed by ${delayStr}`;
    } else {
      detail = "Taken outside scheduled window";
    }
  } else {
    // missed
    detail = "Dose not taken";
  }

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3
        bg-card border border-border/70 border-l-4 ${cfg.borderClass}
        rounded-[16px] shadow-sm transition-shadow hover:shadow-md
      `}
    >
      {/* Status icon circle */}
      <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-background border border-border/50">
        <Icon className={`w-4 h-4 ${cfg.iconClass}`} />
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">
            {log.medicineName}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">
            {log.dosage}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <Clock className="w-3 h-3 text-gray-400 dark:text-gray-500 shrink-0" />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Scheduled {formatScheduledTime(log.scheduledTime)}
          </span>
          {detail && (
            <>
              <span className="text-gray-300 dark:text-gray-600 text-xs">·</span>
              <span
                className={`text-xs font-medium ${
                  log.classifiedStatus === "taken"
                    ? "text-green-600 dark:text-green-400"
                    : log.classifiedStatus === "delayed"
                    ? "text-gray-500 dark:text-gray-400"
                    : "text-red-500 dark:text-red-400"
                }`}
              >
                {detail}
              </span>
            </>
          )}
          {log.source === "sensor" && (
            <>
              <span className="text-gray-300 dark:text-gray-600 text-xs">·</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-500 dark:text-blue-400">
                Sensor
              </span>
            </>
          )}
        </div>
      </div>

      {/* Status badge — always uses classifiedStatus, never raw status */}
      <span
        className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.badgeClass}`}
      >
        <Icon className="w-3 h-3" />
        {cfg.label}
      </span>
    </div>
  );
}

// ── Date Group ─────────────────────────────────────────────────────────────

function DateGroup({ date, entries }: { date: string; entries: LogEntry[] }) {
  const todayStr = new Date().toISOString().split("T")[0];
  const heading = date === todayStr ? "Today" : formatDateHeading(date);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">
        {heading}
      </p>
      {entries.map((log) => (
        <MedCard key={String(log._id)} log={log} />
      ))}
    </div>
  );
}

// ── Section ────────────────────────────────────────────────────────────────

function Section({
  title,
  logs,
  emptyMessage,
  loading,
}: {
  title: string;
  logs: LogEntry[];
  emptyMessage: string;
  loading: boolean;
}) {
  const groups = groupByDate(logs);

  return (
    <div className="bg-card border border-border/80 shadow-sm shadow-slate-900/10 rounded-[28px] p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{title}</h2>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-14 bg-gray-100 dark:bg-gray-700 rounded-[16px] animate-pulse"
            />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex items-center gap-3 py-4 px-3 rounded-2xl border border-dashed border-border/60 text-gray-400 dark:text-gray-500">
          <Pill className="w-4 h-4 shrink-0 opacity-50" />
          <p className="text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(({ date, entries }) => (
            <DateGroup key={date} date={date} entries={entries} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

const History = () => {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    intervalRef.current = setInterval(fetchHistory, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchHistory]);

  const s = data?.summary;

  // ── "Total Taken" card ──────────────────────────────────────────────────
  // Headline: totalTaken = onTime + delayed (ALL confirmed doses)
  // Subtitle breakdown: "X on time · Y delayed"  (correct math)
  const takenValue = loading ? "—" : String(s?.totalTaken ?? 0);

  const takenSubtitle = (() => {
    if (loading) return "Loading…";
    if (!s) return "";
    if (s.totalDelayed === 0) return "All doses taken on time";
    // onTime = totalTaken - totalDelayed  (never show wrong numbers)
    const onTime = s.onTime;
    return `${onTime} on time · ${s.totalDelayed} delayed`;
  })();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">History</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            View your medication intake history
          </p>
        </div>

        {/* ── 3 summary stat cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: Total Taken (on-time + delayed) with breakdown subtitle */}
          <StatCard
            title="Total Taken"
            value={takenValue}
            subtitle={takenSubtitle}
            className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
          />

          {/* Card 2: Total Missed */}
          <StatCard
            title="Total Missed"
            value={loading ? "—" : String(s?.totalMissed ?? 0)}
            subtitle="Medicines missed this month"
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          />

          {/* Card 3: Success Rate */}
          <StatCard
            title="Success Rate"
            value={loading ? "—" : `${s?.successRate ?? 0}%`}
            subtitle="Medication adherence rate"
            className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
          />
        </div>

        {/* ── History sections — always rendered ── */}
        <div className="space-y-8">
          <Section
            title="Today"
            logs={data?.today ?? []}
            emptyMessage="No finalized medication records for today yet."
            loading={loading}
          />
          <Section
            title="This Week"
            logs={data?.thisWeek ?? []}
            emptyMessage="No medication records in the past 7 days."
            loading={loading}
          />
          {/* Always visible even when empty */}
          <Section
            title="This Month"
            logs={data?.thisMonth ?? []}
            emptyMessage="No medication records this month yet."
            loading={loading}
          />
          {/* Always visible even when empty */}
          <Section
            title="Earlier Records"
            logs={data?.earlier ?? []}
            emptyMessage="No earlier medication records available."
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
};

export default History;