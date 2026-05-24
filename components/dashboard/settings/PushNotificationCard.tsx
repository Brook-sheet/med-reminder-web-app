"use client";
// components/dashboard/settings/PushNotificationCard.tsx
// Allows users to enable/disable browser push notifications.

import React from 'react';
import { Bell, BellOff, CheckCircle, AlertCircle } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const PushNotificationCard: React.FC = () => {
  const { supported, subscribed, permission, loading, error, subscribe, unsubscribe } =
    usePushNotifications();

  if (!supported) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center space-x-2 pb-4 mb-4 border-b border-gray-100 dark:border-gray-700">
          <BellOff className="h-5 w-5 text-gray-400 dark:text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-500 dark:text-gray-400">Push Notifications</h2>
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-400">
          Push notifications are not supported in your current browser.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center space-x-2 pb-4 mb-4 border-b border-gray-100 dark:border-gray-700">
        <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Browser Push Notifications</h2>
      </div>
      <div className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
          {subscribed && permission === 'granted' ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">Push notifications enabled</p>
                <p className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">
                  You&apos;ll receive notifications even when the app is in the background.
                </p>
              </div>
            </>
          ) : permission === 'denied' ? (
            <>
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300">Notifications blocked</p>
                <p className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">
                  Please allow notifications in your browser settings and reload the page.
                </p>
              </div>
            </>
          ) : (
            <>
              <Bell className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Push notifications disabled</p>
                <p className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">
                  Enable to receive medication reminders in your browser.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg px-3 py-2">
            <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* What you'll receive */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-100 dark:border-blue-700/50">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">You&apos;ll receive:</p>
          <ul className="space-y-1">
            {[
              '30-minute advance medication reminders',
              'Alarm when medication is due',
              'Confirmation when sensor detects intake',
              'Adherence risk alerts',
            ].map((item, i) => (
              <li key={i} className="text-xs text-blue-600 dark:text-blue-300">{item}</li>
            ))}
          </ul>
        </div>

        {/* Toggle button */}
        {permission !== 'denied' && (
          <button
            onClick={subscribed ? unsubscribe : subscribe}
            disabled={loading}
            className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 ${
              subscribed
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                : 'bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600'
            }`}
          >
            {loading
              ? 'Processing...'
              : subscribed
              ? 'Disable Push Notifications'
              : 'Enable Push Notifications'}
          </button>
        )}
      </div>
    </div>
  );
};

export default PushNotificationCard;