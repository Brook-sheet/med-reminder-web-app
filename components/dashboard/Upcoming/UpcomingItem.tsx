// components/dashboard/Upcoming/UpcomingItem.tsx
import React from "react";
import { FaBell, FaClock } from "react-icons/fa";

interface UpcomingItemProps {
  name: string;
  time: string;
  date: string;
  note?: string;
  status: "Upcoming" | "Scheduled";
}

const UpcomingItem: React.FC<UpcomingItemProps> = ({
  name,
  time,
  date,
  note,
  status,
}) => {
  const getStatusStyles = () => {
    switch (status) {
      case "Upcoming":
        return "bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "Scheduled":
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600";
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600";
    }
  };

  const getIcon = () => {
    switch (status) {
      case "Upcoming":
        return <FaBell className="h-4 w-4" />;
      case "Scheduled":
        return <FaClock className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="rounded-[28px] border border-border/70 bg-card p-4 shadow-lg shadow-slate-900/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="min-w-0 line-clamp-2 wrap-break-word text-base font-semibold text-gray-900 dark:text-white">
            {name}
          </h3>

          <p className="mt-0.5 truncate text-sm text-gray-600 dark:text-gray-300">
            {time}
          </p>

          <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
            {date}
          </p>

          {note && (
            <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
              <span className="font-semibold">Note:</span> {note}
            </p>
          )}
        </div>

        <div
          className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${getStatusStyles()}`}
        >
          {getIcon()}
          <span>{status}</span>
        </div>
      </div>
    </div>
  );
};

export default UpcomingItem;