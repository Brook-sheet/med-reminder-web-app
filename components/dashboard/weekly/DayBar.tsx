import React from 'react';

interface DayBarProps {
  day: string;
  taken: number;
  total: number;
}

const DayBar: React.FC<DayBarProps> = ({ day, taken, total }) => {
  const percentage = total > 0 ? (taken / total) * 100 : 0;

  const getBarColor = () => {
    if (total === 0) return 'bg-gray-300';
    if (taken === total) return 'bg-green-500';
    if (taken > 0) return 'bg-blue-500';
    return 'bg-gray-300';
  };

  return (
    <div className="flex flex-col items-center gap-3 flex-1">
      {/* Bar Container */}
      <div className="w-full flex items-end justify-center flex-1">
        {/* Bar Background */}
        <div className="w-3/4 bg-gray-200 rounded-t-lg overflow-hidden h-full flex items-end justify-center">
          {/* Colored Bar */}
          <div
            className={`w-full rounded-t-lg transition-all duration-300 ease-out ${getBarColor()}`}
            style={{ height: `${Math.max(percentage, 5)}%` }}
          />
        </div>
      </div>

      {/* Value Label */}
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-900">
          {taken}/{total}
        </p>
      </div>

      {/* Day Label */}
      <div className="text-center">
        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          {day}
        </p>
      </div>
    </div>
  );
};

export default DayBar;
