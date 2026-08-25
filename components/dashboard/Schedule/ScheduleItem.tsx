import React from 'react';
import {
  FaCheckCircle,
  FaBell,
  FaClock,
  FaExclamationTriangle,
} from "react-icons/fa";

interface ScheduleItemProps {
  name: string;
  time: string;
  note?: string;

  status:
    | 'Taken'
    | 'Late'
    | 'Upcoming'
    | 'Scheduled'
    | 'Missed'
    | 'Wrong Chamber'
    | 'Now';
}

const ScheduleItem:
  React.FC<ScheduleItemProps> = ({
    name,
    time,
    note,
    status,
  }) => {
    const getStatusStyles = () => {
      switch (status) {
        case 'Taken':
          return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800';

        case 'Upcoming':
          return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800';

        case 'Late':
          return 'bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';

        case 'Missed':
        case 'Wrong Chamber':
          return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800';

        case 'Now':
          return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800';

        case 'Scheduled':
          return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600';

        default:
          return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600';
      }
    };

    const getIcon = () => {
      switch (status) {
        case 'Taken':
          return (
            <FaCheckCircle className="h-4 w-4" />
          );

        case 'Late':
          return (
            <FaClock className="h-4 w-4" />
          );

        case 'Missed':
        case 'Wrong Chamber':
          return (
            <FaExclamationTriangle className="h-4 w-4" />
          );

        case 'Upcoming':
          return (
            <FaBell className="h-4 w-4" />
          );

        case 'Now':
          return (
            <FaBell className="h-4 w-4" />
          );

        case 'Scheduled':
          return (
            <FaClock className="h-4 w-4" />
          );

        default:
          return null;
      }
    };

    return (
      <div className="rounded-[28px] border border-border/70 bg-card p-4 shadow-lg shadow-slate-900/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="min-w-0 line-clamp-2 break-words text-lg font-semibold text-gray-900 dark:text-white">
              {name}
            </h3>

            <p className="truncate text-gray-600 dark:text-gray-300">
              {time}
            </p>

            {note && (
              <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                <span className="font-semibold">
                  Note:
                </span>{' '}
                {note}
              </p>
            )}
          </div>

          <div
            className={`flex flex-shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${getStatusStyles()}`}
          >
            {getIcon()}

            <span>
              {status}
            </span>
          </div>
        </div>
      </div>
    );
  };

export default ScheduleItem;