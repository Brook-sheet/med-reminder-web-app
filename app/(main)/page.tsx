"use client";

import { useEffect, useState, useCallback } from "react";
import StatCard from "@/components/dashboard/StatCard";
import ScheduleList from "@/components/dashboard/Schedule/ScheduleList";
import WeeklyAdherence from "@/components/dashboard/weekly/WeeklyAdherence";
import type { DashboardStats } from "@/types";

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
      if (profileData.success && profileData.data.fullName) {
        setUserName(profileData.data.fullName.split(" ")[0]);
      } else if (profileData.success && profileData.data.email) {
        setUserName(profileData.data.email.split("@")[0]);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    // Poll every 30 seconds for real-time sensor updates
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome Back, {userName}!
          </h1>
          <p className="text-lg text-gray-600 mt-2">
            Here&apos;s your medication status for today
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Adherence Rate"
            value={<span className="text-blue-600">{adherenceValue}</span>}
            subtitle="This month"
            className="border-l-4 border-blue-500"
          />
          <StatCard
            title="Today's Progress"
            value={progressValue}
            subtitle="medicines taken"
          />
          <StatCard
            title="Next Reminder"
            value={nextReminderTime}
            subtitle={nextReminderMed}
            className="bg-orange-50 border-orange-200"
          />
        </div>

        {/* Today's Schedule */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Today&apos;s Schedule
          </h2>
          <ScheduleList
            schedule={stats?.todaySchedule ?? []}
            loading={loading}
            onStatusChange={fetchDashboard}
          />
        </div>

        {/* Weekly Adherence */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Weekly Adherence
          </h2>
          <WeeklyAdherence weeklyData={stats?.weeklyData ?? []} loading={loading} />
        </div>
      </div>
    </div>
  );
}
