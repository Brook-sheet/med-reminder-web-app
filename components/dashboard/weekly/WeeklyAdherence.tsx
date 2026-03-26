import React from "react";
import DayBar from "./DayBar";
import type { WeeklyDayData } from "@/types";

interface WeeklyAdherenceProps {
  weeklyData: WeeklyDayData[];
  loading: boolean;
}

const WeeklyAdherence: React.FC<WeeklyAdherenceProps> = ({ weeklyData, loading }) => {
  if (loading) {
    return (
      <div className="flex gap-2 h-64 md:gap-4 md:h-72">
        {Array(7).fill(0).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-3">
            <div className="w-3/4 bg-gray-200 rounded-t-lg animate-pulse h-full" />
            <div className="h-3 w-8 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-6 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex gap-2 h-64 md:gap-4 md:h-72">
        {weeklyData.map((data, index) => (
          <DayBar key={index} day={data.day} taken={data.taken} total={data.total} />
        ))}
      </div>
    </div>
  );
};

export default WeeklyAdherence;
