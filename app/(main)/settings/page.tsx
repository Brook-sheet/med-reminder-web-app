"use client";

import ProfileCard from "@/components/dashboard/settings/ProfileCard";
import PushNotificationCard from "@/components/dashboard/settings/PushNotificationCard";
import ResetDataCard from "@/components/dashboard/settings/ResetDataCard";
import FamilyMonitoringCard from "@/components/dashboard/settings/FamilyMonitoringCard";
import { ThemeToggle } from "@/components/theme-toggle";

const Settings = () => {
  return (
    <div className="min-h-full bg-background p-6 pb-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>

          <p className="mt-1 text-gray-600 dark:text-gray-300">
            Customize your medication reminders and preferences
          </p>
        </div>

        <div className="space-y-4">
          <ProfileCard />

          <FamilyMonitoringCard />

          <div className="rounded-[28px] border border-border/80 bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Appearance
            </h2>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Theme
                </p>

                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Click to cycle: Light → Dark → System
                </p>
              </div>

              <div className="flex items-center self-center">
                <ThemeToggle />
              </div>
            </div>
          </div>

          <PushNotificationCard />

          <ResetDataCard />
        </div>
      </div>
    </div>
  );
};

export default Settings;