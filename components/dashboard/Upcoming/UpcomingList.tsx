"use client";

import React, { useEffect, useState, useCallback } from "react";
import UpcomingItem from "./UpcomingItem";

interface UpcomingItemData {
  medicineId: string;
  medicineName: string;
  dosage: string;
  scheduledDate: string;
  scheduledDateFormatted: string;
  scheduledTime: string;
  status: "Upcoming" | "Scheduled";
  logId?: string;
}

const UpcomingList = () => {
  const [items, setItems] = useState<UpcomingItemData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUpcoming = useCallback(async () => {
    try {
      const res = await fetch("/api/upcoming");
      const data = await res.json();
      if (data.success) {
        setItems(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch upcoming:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUpcoming();
    // Refresh every 60 seconds
    const interval = setInterval(fetchUpcoming, 60000);
    return () => clearInterval(interval);
  }, [fetchUpcoming]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-100 rounded-lg h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-gray-400 text-sm">
        No upcoming medications scheduled. Add a medicine to see it here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <UpcomingItem
          key={`${item.medicineId}-${item.scheduledDate}-${item.scheduledTime}-${index}`}
          name={`${item.medicineName} ${item.dosage}`}
          time={item.scheduledTime}
          date={item.scheduledDateFormatted}
          status={item.status}
        />
      ))}
    </div>
  );
};

export default UpcomingList;

