"use client";
// app/(main)/settings/page.tsx

import React from "react";
import ProfileCard from "@/components/dashboard/settings/ProfileCard";
import PushNotificationCard from "@/components/dashboard/settings/PushNotificationCard";
import { ThemeToggle } from "@/components/theme-toggle";

const Settings = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Customize your medication reminders and preferences
          </p>
        </div>

        <div className="space-y-6">
          <ProfileCard />
          <PushNotificationCard />
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Appearance</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-700 dark:text-gray-300">Theme</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Click to cycle: Light → Dark → System</p>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;