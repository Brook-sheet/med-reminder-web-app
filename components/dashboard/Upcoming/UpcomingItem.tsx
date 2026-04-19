// components/dashboard/Upcoming/UpcomingItem.tsx
import React from "react";
import { FaBell } from "react-icons/fa";
import { FaClock } from "react-icons/fa";

interface UpcomingItemProps {
  name: string;
  time: string;
  date: string;           // "Today", "Mon, Apr 21", etc.
  status: "Upcoming" | "Scheduled";
}

const UpcomingItem: React.FC<UpcomingItemProps> = ({ name, time, date, status }) => {
  const getStatusStyles = () => {
    switch (status) {
      case "Upcoming":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Scheduled":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getIcon = () => {
    switch (status) {
      case "Upcoming":
        return <FaBell className="w-4 h-4" />;
      case "Scheduled":
        return <FaClock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-900">{name}</h3>
          <p className="text-sm text-gray-600 mt-0.5">{time}</p>
          <p className="text-xs text-gray-400 mt-0.5">{date}</p>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium ${getStatusStyles()}`}
        >
          {getIcon()}
          <span>{status}</span>
        </div>
      </div>
    </div>
  );
};

export default UpcomingItem;
