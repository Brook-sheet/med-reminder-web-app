"use client";

import React from "react";
import ProfileCard from "@/components/dashboard/settings/ProfileCard";

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
        <ProfileCard />
      </div>
    </div>
  );
};

export default Settings;
