import React from 'react';
import StatCard from '@/components/dashboard/StatCard';
import HistoryItem from '@/components/dashboard/history/HistoryItems';

const History = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">History</h1>
          <p className="text-gray-600 mt-2">View your medication intake history</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Total Taken"
            value="0"
            subtitle="Medicines taken this month"
            className="bg-green-50 border border-green-200 rounded-lg"
          />
          <StatCard
            title="Total Missed"
            value="0"
            subtitle="Medicines missed this month"
            className="bg-red-50 border border-red-200 rounded-lg"
          />
          <StatCard
            title="Success Rate"
            value="0%"
            subtitle="Medication adherence rate"
            className="bg-blue-50 border border-blue-200 rounded-lg"
          />
        </div>

        {/* History Sections */}
        <div className="space-y-8">
          {/* Today */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Today</h2>
            <div className="space-y-4">
              <HistoryItem
                medicationName="Aspirin"
                time="8:00 AM"
                status="Taken"
                description="Successfully taken on time"
              />
              <HistoryItem
                medicationName="Lisinopril"
                time="12:00 PM"
                status="Reminder"
                description="Reminder sent - awaiting confirmation"
              />
            </div>
          </div>

          {/* Last Week */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Last Week</h2>
            <div className="space-y-4">
              <HistoryItem
                medicationName="Aspirin"
                time="8:00 AM"
                status="Missed"
                description="Missed dose - reminder sent"
              />
              <HistoryItem
                medicationName="Lisinopril"
                time="12:00 PM"
                status="Taken"
                description="Successfully taken on time"
              />
            </div>
          </div>

          {/* This Month */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">This Month</h2>
            <div className="space-y-4">
              <HistoryItem
                medicationName="Aspirin"
                time="8:00 AM"
                status="Taken"
                description="Successfully taken on time"
              />
              <HistoryItem
                medicationName="Lisinopril"
                time="12:00 PM"
                status="Taken"
                description="Successfully taken on time"
              />
              <HistoryItem
                medicationName="Vitamin D"
                time="6:00 PM"
                status="Reminder"
                description="Reminder sent - awaiting confirmation"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default History;
