import React from 'react';
import { Check, Bell, X } from 'lucide-react';

interface HistoryItemProps {
  medicationName: string;
  time: string;
  status: 'Taken' | 'Reminder' | 'Missed';
  description: string;
}

const HistoryItem: React.FC<HistoryItemProps> = ({
  medicationName,
  time,
  status,
  description,
}) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'Taken':
        return {
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-700',
          icon: <Check className="w-5 h-5" />,
        };
      case 'Reminder':
        return {
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-700',
          icon: <Bell className="w-5 h-5" />,
        };
      case 'Missed':
        return {
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-700',
          icon: <X className="w-5 h-5" />,
        };
      default:
        return {
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-700',
          icon: <Bell className="w-5 h-5" />,
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div className={`rounded-lg border p-4 ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`flex items-center justify-center w-10 h-10 rounded-full ${config.bgColor} border ${config.borderColor} ${config.textColor}`}>
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-gray-900">{medicationName}</h4>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor} border ${config.borderColor}`}>
              {status}
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-1">{time}</p>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
    </div>
  );
};

export default HistoryItem;