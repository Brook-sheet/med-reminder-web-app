import React from 'react';
import { FaCheckCircle, FaBell, FaClock } from "react-icons/fa";

interface ScheduleItemProps {
  name: string;
  time: string;
  status: 'Taken' | 'Upcoming' | 'Scheduled' | 'Missed' | 'Now';
}

const ScheduleItem: React.FC<ScheduleItemProps> = ({ name, time, status }) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'Taken':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'Upcoming':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800';
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
        return <FaCheckCircle className="w-4 h-4" />;
      case 'Upcoming':
        return <FaBell className="w-4 h-4" />;
        case 'Now':
          return <FaBell className="w-4 h-4" />;
      case 'Scheduled':
        return <FaClock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="rounded-[28px] border border-border/70 bg-card p-4 shadow-lg shadow-slate-900/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white min-w-0 break-words line-clamp-2">
            {name}
          </h3>
          <p className="text-gray-600 dark:text-gray-300 truncate">{time}</p>
        </div>
        <div className={`flex-shrink-0 flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium ${getStatusStyles()}`}>
          {getIcon()}
          <span>{status}</span>
        </div>
      </div>
    </div>
  );
};

export default ScheduleItem;

