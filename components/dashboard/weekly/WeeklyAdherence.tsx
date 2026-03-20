import React from 'react';
import DayBar from './DayBar';

interface WeeklyData {
  day: string;
  taken: number;
  total: number;
}

const WeeklyAdherence: React.FC = () => {
  // Sample data - replace with actual data from your backend
  const weeklyData: WeeklyData[] = [
    { day: 'Mon', taken: 2, total: 4 },
    { day: 'Tue', taken: 4, total: 4 },
    { day: 'Wed', taken: 2, total: 4 },
    { day: 'Thu', taken: 4, total: 4 },
    { day: 'Fri', taken: 3, total: 4 },
    { day: 'Sat', taken: 1, total: 4 },
    { day: 'Sun', taken: 1, total: 4 },
  ];

  return (
    <div className="w-full">
      <div className="flex gap-2 h-64 md:gap-4 md:h-72">
        {weeklyData.map((data, index) => (
          <DayBar
            key={index}
            day={data.day}
            taken={data.taken}
            total={data.total}
          />
        ))}
      </div>
    </div>
  );
};

export default WeeklyAdherence;
