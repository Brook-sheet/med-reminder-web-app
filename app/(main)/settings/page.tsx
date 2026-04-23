"use client";
// app/(main)/settings/page.tsx

import React from "react";
import ProfileCard from "@/components/dashboard/settings/ProfileCard";
import PushNotificationCard from "@/components/dashboard/settings/PushNotificationCard";

const Settings = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">
            Customize your medication reminders and preferences
          </p>
        </div>

        <div className="space-y-6">
          <ProfileCard />
          <PushNotificationCard />
        </div>
      </div>
    </div>
  );
};

export default Settings;