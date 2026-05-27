"use client";
// components/notifications/UpcomingReminderNotification.tsx
import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, Utensils } from 'lucide-react';
import { getFoodReminderContent, isFoodMonitoringApplicable } from '@/lib/foodMonitoring';

interface UpcomingReminderNotificationProps {
  medicineName: string;
  scheduledTime: string;
  condition: string;
  onClose: () => void;
  className?: string;
}

const UpcomingReminderNotification: React.FC<UpcomingReminderNotificationProps> = ({
  medicineName,
  scheduledTime,
  condition,
  onClose,
  className,
}) => {
  const [expanded, setExpanded] = useState(false);
  const foodContent = getFoodReminderContent(condition);
  const showFoodReminder = isFoodMonitoringApplicable(condition) && foodContent;

  const conditionLabel = condition === 'Both'
    ? 'Diabetes & Hypertension'
    : condition;

  return (
    <div className={`w-[min(92vw,20rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-blue-100 dark:border-blue-900 overflow-hidden animate-in slide-in-from-right duration-300 ${className ?? ''}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm">Upcoming Medication</span>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Main message */}
        <div>
          <p className="text-gray-800 dark:text-gray-100 font-semibold text-sm">
            Medication reminder in 30 minutes
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            <span className="font-semibold text-blue-600 dark:text-blue-300">{medicineName}</span>{' '}
            is scheduled at <span className="font-semibold dark:text-gray-100">{scheduledTime}</span>.
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            Prepare now — eat something appropriate before your medication if needed.
          </p>
        </div>

        {/* Food reminder — condition-specific */}
        {showFoodReminder && foodContent && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(prev => !prev)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-800/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  {foodContent.title}
                </span>
              </div>
              {expanded
                ? <ChevronUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                : <ChevronDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              }
            </button>

            {expanded && (
              <div className="px-3 py-3 bg-amber-50/50 dark:bg-amber-900/10 border-t border-amber-100 dark:border-amber-800/50 max-h-56 overflow-y-auto">
                <div className="mb-3">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1.5 uppercase tracking-wide">
                    ✓ Recommended to eat:
                  </p>
                  <ul className="space-y-1">
                    {foodContent.eat.slice(0, 5).map((item, i) => (
                      <li key={i} className="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-1.5">
                        <span className="text-green-500 mt-0.5 shrink-0">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1.5 uppercase tracking-wide">
                    ✗ Try to avoid:
                  </p>
                  <ul className="space-y-1">
                    {foodContent.avoid.slice(0, 5).map((item, i) => (
                      <li key={i} className="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-1.5">
                        <span className="text-red-400 mt-0.5 shrink-0">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 italic text-center">
                  Evidence-based dietary guidance for {conditionLabel}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Close */}
      <div className="px-4 pb-4 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-200 rounded-lg transition-colors font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default UpcomingReminderNotification;