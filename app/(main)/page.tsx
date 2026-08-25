"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import StatCard from "@/components/dashboard/StatCard";

import ScheduleList from "@/components/dashboard/Schedule/ScheduleList";

import UpcomingList from "@/components/dashboard/Upcoming/UpcomingList";

import AdherenceCard from "@/components/dashboard/AdherenceCard";

import RxBoxLoadingOrder from "@/components/dashboard/RxBoxLoadingOrder";

import type {
  DashboardStats,
} from "@/lib/interfaces/data/Dashboard";

import {
  toast,
} from "@/components/ui/Toast";

export default function Home() {
  const [
    stats,
    setStats,
  ] =
    useState<DashboardStats | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    userName,
    setUserName,
  ] =
    useState("there");

  const dashboardErrorShown =
    useRef(false);

  const fetchDashboard =
    useCallback(
      async () => {
        try {
          const [
            dashboardResponse,
            profileResponse,
          ] =
            await Promise.all([
              fetch(
                "/api/dashboard"
              ),

              fetch(
                "/api/profile"
              ),
            ]);

          const dashboardData =
            await dashboardResponse.json();

          const profileData =
            await profileResponse.json();

          if (
            dashboardData.success
          ) {
            setStats(
              dashboardData.data
            );

            dashboardErrorShown.current =
              false;
          } else if (
            !dashboardErrorShown.current
          ) {
            toast.error(
              dashboardData.error ||
              "Unable to load the Dashboard. Please try again."
            );

            dashboardErrorShown.current =
              true;
          }

          if (
            profileData.success
          ) {
            const profile =
              profileData.data;

            if (
              profile.firstName
            ) {
              setUserName(
                profile.firstName
              );
            } else if (
              profile.email
            ) {
              setUserName(
                profile.email
                  .split("@")[0]
              );
            }
          }
        } catch (error) {
          console.error(
            "Dashboard fetch error:",
            error
          );

          if (
            !dashboardErrorShown.current
          ) {
            toast.error(
              "Unable to load the Dashboard. Please check your connection."
            );

            dashboardErrorShown.current =
              true;
          }
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    fetchDashboard();

    const interval =
      setInterval(
        fetchDashboard,
        30000
      );

    const refreshWhenVisible =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          fetchDashboard();
        }
      };

    window.addEventListener(
      "focus",
      fetchDashboard
    );

    document.addEventListener(
      "visibilitychange",
      refreshWhenVisible
    );

    return () => {
      clearInterval(
        interval
      );

      window.removeEventListener(
        "focus",
        fetchDashboard
      );

      document.removeEventListener(
        "visibilitychange",
        refreshWhenVisible
      );
    };
  }, [fetchDashboard]);

  useEffect(() => {
    const handleScheduleChange =
      () => {
        setLoading(true);
        fetchDashboard();
      };

    window.addEventListener(
      "medicineScheduleChanged",
      handleScheduleChange
    );

    return () => {
      window.removeEventListener(
        "medicineScheduleChanged",
        handleScheduleChange
      );
    };
  }, [fetchDashboard]);

  const adherenceValue =
    loading ||
    stats?.adherenceRate ==
      null
      ? "—"
      : `${stats.adherenceRate}%`;

  const progressValue =
    loading
      ? "—"
      : `${
          stats?.todayProgress
            .taken ??
          0
        }/${
          stats?.todayProgress
            .total ??
          0
        }`;

  const nextReminderTime =
    stats?.nextReminder
      ?.time ??
    "None";

  const nextReminderMed =
    stats?.nextReminder
      ?.medicineName ??
    "All done for today!";

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome Back,{" "}
            {userName}!
          </h1>

          <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">
            Here&apos;s your
            medication status
            for today
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatCard
            title="Adherence Rate"
            value={
              <span className="text-white dark:text-white">
                {
                  adherenceValue
                }
              </span>
            }
            subtitle="Overall Adherence"
            className="border-l-4 border-blue-500 bg-blue-600 text-white dark:bg-blue-700"
          />

          <StatCard
            title="Today's Progress"
            value={
              <span className="text-white dark:text-white">
                {
                  progressValue
                }
              </span>
            }
            subtitle="Medicines Taken"
            className="bg-gray-700 text-white dark:bg-gray-700"
          />

          <StatCard
            title="Next Reminder"
            value={
              <span className="text-white dark:text-white">
                {
                  nextReminderTime
                }
              </span>
            }
            subtitle={
              <span className="text-white dark:text-white">
                {
                  nextReminderMed
                }
              </span>
            }
            className="bg-gray-700 text-white dark:bg-gray-700"
          />
        </div>

        <RxBoxLoadingOrder />

        <div className="mb-6 rounded-[28px] border border-border/80 bg-card p-6 shadow-sm shadow-slate-900/10">
          <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
            Today&apos;s
            Schedule
          </h2>

          <ScheduleList
            schedule={
              stats?.todaySchedule ??
              []
            }
            loading={
              loading
            }
            onStatusChange={
              fetchDashboard
            }
          />
        </div>

        <div className="mb-6 rounded-[28px] border border-border/80 bg-card p-6 shadow-sm shadow-slate-900/10">
          <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
            Upcoming
          </h2>

          <UpcomingList />
        </div>

        <div className="mb-6">
          <AdherenceCard />
        </div>
      </div>
    </div>
  );
}