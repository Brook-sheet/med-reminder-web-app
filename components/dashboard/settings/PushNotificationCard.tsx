"use client";
// components/dashboard/settings/PushNotificationCard.tsx
// Allows users to enable/disable browser push notifications.

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Bell, BellOff, CheckCircle, AlertCircle } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const PushNotificationCard: React.FC = () => {
  const { supported, subscribed, permission, loading, error, subscribe, unsubscribe } =
    usePushNotifications();

  if (!supported) {
    return (
      <Card className="w-full mx-auto shadow-lg border-gray-200">
        <CardHeader className="flex items-center space-x-2 pb-2">
          <BellOff className="h-5 w-5 text-gray-400" />
          <CardTitle className="text-lg font-semibold text-gray-500">Push Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400">
            Push notifications are not supported in your current browser.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full mx-auto shadow-lg">
      <CardHeader className="flex items-center space-x-2 pb-4">
        <Bell className="h-5 w-5 text-blue-600" />
        <CardTitle className="text-lg font-semibold">Browser Push Notifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
          {subscribed && permission === 'granted' ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700">Push notifications enabled</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  You&apos;ll receive notifications even when the app is in the background.
                </p>
              </div>
            </>
          ) : permission === 'denied' ? (
            <>
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-700">Notifications blocked</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Please allow notifications in your browser settings and reload the page.
                </p>
              </div>
            </>
          ) : (
            <>
              <Bell className="w-5 h-5 text-gray-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-700">Push notifications disabled</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Enable to receive medication reminders in your browser.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* What you'll receive */}
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
          <p className="text-xs font-semibold text-blue-700 mb-2">You&apos;ll receive:</p>
          <ul className="space-y-1">
            {[
              '⏰ 30-minute advance medication reminders',
              '🚨 Alarm when medication is due',
              '✅ Confirmation when sensor detects intake',
              '📊 Adherence risk alerts',
            ].map((item, i) => (
              <li key={i} className="text-xs text-blue-600">{item}</li>
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
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading
              ? 'Processing...'
              : subscribed
              ? '🔕 Disable Push Notifications'
              : '🔔 Enable Push Notifications'}
          </button>
        )}
      </CardContent>
    </Card>
  );
};

export default PushNotificationCard;