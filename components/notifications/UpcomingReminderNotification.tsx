"use client";
// components/notifications/UpcomingReminderNotification.tsx
// Shows 30 minutes before a scheduled medication time.
// Includes food guidance for Diabetes/Hypertension/Both conditions.

import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { getFoodReminderContent, isFoodMonitoringApplicable } from '@/lib/foodMonitoring';

interface UpcomingReminderNotificationProps {
  medicineName: string;
  scheduledTime: string;
  condition: string;
  onClose: () => void;
}

const UpcomingReminderNotification: React.FC<UpcomingReminderNotificationProps> = ({
  medicineName,
  scheduledTime,
  condition,
  onClose,
}) => {
  const [expanded, setExpanded] = useState(false);
  const foodContent = getFoodReminderContent(condition);
  const showFoodReminder = isFoodMonitoringApplicable(condition) && foodContent;

  return (
    <div className="fixed top-4 right-4 z-[150] w-80 bg-white rounded-2xl shadow-2xl border border-blue-100 overflow-hidden animate-in slide-in-from-right duration-300">
      {/* Header bar */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔔</span>
          <span className="text-white font-semibold text-sm">Upcoming Medication</span>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4">
        {/* Main message */}
        <p className="text-gray-800 font-medium text-sm mb-1">
          Hey there! 😊 Time to get ready!
        </p>
        <p className="text-gray-600 text-sm mb-2">
          Your <span className="font-semibold text-blue-600">{medicineName}</span> is scheduled at{' '}
          <span className="font-semibold">{scheduledTime}</span> — that&apos;s in 30 minutes!
        </p>
        <p className="text-gray-500 text-xs mb-3">
          You may want to eat something before your medication if needed. 🍽️
        </p>

        {/* Food reminder toggle (only for Diabetes/Hypertension/Both) */}
        {showFoodReminder && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(prev => !prev)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-amber-50 hover:bg-amber-100 transition-colors text-sm font-medium text-amber-800"
            >
              <span>📋 Food Guidance for {condition === 'Both' ? 'Diabetes & Hypertension' : condition}</span>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expanded && foodContent && (
              <div className="px-3 py-3 bg-amber-50/50 border-t border-amber-100 max-h-48 overflow-y-auto">
                <div className="mb-3">
                  <p className="text-xs font-semibold text-green-700 mb-1.5 flex items-center gap-1">
                    ✅ Recommended to eat:
                  </p>
                  <ul className="space-y-1">
                    {foodContent.eat.slice(0, 4).map((item, i) => (
                      <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                        <span className="text-green-500 mt-0.5">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-red-700 mb-1.5 flex items-center gap-1">
                    ❌ Try to avoid:
                  </p>
                  <ul className="space-y-1">
                    {foodContent.avoid.slice(0, 4).map((item, i) => (
                      <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                        <span className="text-red-400 mt-0.5">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-xs text-gray-400 mt-2 italic">
                  Based on WHO dietary guidelines
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Close button */}
      <div className="px-4 pb-4 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors font-medium"
        >
          Got it! Close ✕
        </button>
      </div>
    </div>
  );
};

export default UpcomingReminderNotification;