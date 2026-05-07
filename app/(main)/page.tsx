"use client";

import { useEffect, useState, useCallback } from "react";
import StatCard from "@/components/dashboard/StatCard";
import ScheduleList from "@/components/dashboard/Schedule/ScheduleList";
import UpcomingList from "@/components/dashboard/Upcoming/UpcomingList";
import type { DashboardStats } from "@/lib/interfaces/data/Dashboard";

export default function Home() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("there");

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashRes, profileRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/profile"),
      ]);
      const dashData = await dashRes.json();
      const profileData = await profileRes.json();

      if (dashData.success) setStats(dashData.data);

      if (profileData.success) {
        const p = profileData.data;
        if (p.firstName) {
          setUserName(p.firstName);
        } else if (p.email) {
          setUserName(p.email.split("@")[0]);
        }
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const adherenceValue = loading ? "—" : `${stats?.adherenceRate ?? 0}%`;
  const progressValue = loading
    ? "—"
    : `${stats?.todayProgress.taken ?? 0}/${stats?.todayProgress.total ?? 0}`;
  const nextReminderTime = stats?.nextReminder?.time ?? "None";
  const nextReminderMed = stats?.nextReminder?.medicineName ?? "All done for today!";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome Back, {userName}!
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mt-2">
            Here&apos;s your medication status for today
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Adherence Rate"
            value={<span className="text-white dark:text-white">{adherenceValue}</span>}
            subtitle="This month"
            className="border-l-4 border-blue-500 bg-blue-600 dark:bg-blue-700 text-white"
          />
          <StatCard
            title="Today's Progress"
            value={<span className="text-white dark:text-white">{progressValue}</span>}
            subtitle="medicines taken"
            className="bg-gray-700 dark:bg-gray-700 text-white"
          />
          <StatCard
            title="Next Reminder"
            value={<span className="text-white dark:text-white">{nextReminderTime}</span>}
            subtitle={<span className="text-white dark:text-white">{nextReminderMed}</span>}
            className="bg-gray-700 dark:bg-gray-700 text-white"
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Today&apos;s Schedule
          </h2>
          <ScheduleList
            schedule={stats?.todaySchedule ?? []}
            loading={loading}
            onStatusChange={fetchDashboard}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Upcoming</h2>
          <UpcomingList />
        </div>
      </div>
    </div>
  );
}
