import React from 'react';
import { FaCheckCircle } from "react-icons/fa";
import { FaBell } from "react-icons/fa";
import { FaClock } from "react-icons/fa";

interface ScheduleItemProps {
  name: string;
  time: string;
  status: 'Taken' | 'Upcoming' | 'Scheduled' | 'Missed';
}

const ScheduleItem: React.FC<ScheduleItemProps> = ({ name, time, status }) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'Taken':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'Upcoming':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800';
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
      case 'Scheduled':
        return <FaClock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{name}</h3>
          <p className="text-gray-600 dark:text-gray-300">{time}</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium ${getStatusStyles()}`}>
          {getIcon()}
          <span>{status}</span>
        </div>
      </div>
    </div>
  );
};

export default ScheduleItem;

