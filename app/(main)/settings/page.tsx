"use client";
// app/(main)/settings/page.tsx

import ProfileCard from "@/components/dashboard/settings/ProfileCard";
import PushNotificationCard from "@/components/dashboard/settings/PushNotificationCard";
import ResetDataCard from "@/components/dashboard/settings/ResetDataCard";
import { ThemeToggle } from "@/components/theme-toggle";

const Settings = () => {
  return (
    <div className="min-h-full bg-background p-6 pb-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Customize your medication reminders and preferences
          </p>
        </div>

        <div className="space-y-4">
          {/* 1. Profile Information */}
          <ProfileCard />

          {/* 2. Appearance */}
          <div className="bg-card p-6 rounded-[28px] shadow-sm border border-border/80">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appearance</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Theme</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Click to cycle: Light → Dark → System
                </p>
              </div>
              <div className="flex items-center self-center">
                <ThemeToggle />
              </div>
            </div>
          </div>

          {/* 3. Browser Push Notifications */}
          <PushNotificationCard />

          {/* 4. Reset Data (bottom) */}
          <ResetDataCard />

        </div>
      </div>
    </div>
  );
};

export default Settings;