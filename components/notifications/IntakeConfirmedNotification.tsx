"use client";
// components/notifications/IntakeConfirmedNotification.tsx
// Shows after the sensor confirms the user took their medication.
// Displays adherence rate, risk classification, and Proceed button for food monitoring.

import React from 'react';
import { X, ChevronRight } from 'lucide-react';

interface IntakeConfirmedNotificationProps {
  medicineName: string;
  adherenceRate: number;
  riskLevel: 'Low' | 'Moderate' | 'High';
  showFoodMonitoring: boolean; // true for Diabetes/Hypertension/Both
  onClose: () => void;
  onProceed: () => void; // opens food monitoring modal
  className?: string;
}

const RISK_STYLES = {
  Low: {
    badge: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300',
    desc: 'Great job. Keep up the healthy habits.',
  },
  Moderate: {
    badge: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-300',
    desc: 'Consider improving your medication adherence.',
  },
  High: {
    badge: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300',
    desc: 'Please consult your doctor about your medication schedule.',
  },
};

const IntakeConfirmedNotification: React.FC<IntakeConfirmedNotificationProps> = ({
  medicineName,
  adherenceRate,
  riskLevel,
  showFoodMonitoring,
  onClose,
  onProceed,
  className,
}) => {
  const style = RISK_STYLES[riskLevel];
  let progressBarClass = 'bg-red-500';
  if (riskLevel === 'Low') progressBarClass = 'bg-green-500';
  else if (riskLevel === 'Moderate') progressBarClass = 'bg-yellow-500';

  return (
    <div className={`w-[min(92vw,20rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-green-100 dark:border-green-900/30 overflow-hidden animate-in slide-in-from-right duration-300 ${className ?? ''}`}>
      {/* Header */}
      <div className="bg-linear-to-r from-green-500 to-green-600 px-4 py-3 flex items-center justify-between">
        <div>
          <span className="text-white font-semibold text-sm">Medication Taken</span>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Confirmation message */}
        <p className="text-gray-800 dark:text-gray-100 font-medium text-sm mb-1">
          Intake confirmed by sensor.
        </p>
        <p className="text-gray-500 dark:text-gray-300 text-sm mb-4">
          <span className="font-semibold text-gray-700 dark:text-gray-100">{medicineName}</span> has been successfully recorded.
        </p>

        {/* Adherence stats */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 mb-3 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Current Adherence Rate</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">{adherenceRate}%</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all ${progressBarClass}`}
              style={{ width: `${Math.min(adherenceRate, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">Risk Level</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${style.badge}`}>
              {riskLevel} Risk
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{style.desc}</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-200 rounded-lg transition-colors font-medium"
          >
            Close
          </button>
          {showFoodMonitoring && (
            <button
              onClick={onProceed}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors font-semibold"
            >
              Food Check
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntakeConfirmedNotification;