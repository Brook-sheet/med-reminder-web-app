// public/sw.js
// Enhanced service worker for Med App Reminder
// Handles all push notification types: upcoming_reminder, due_alarm, intake_confirmed, adherence_alert

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Medication Reminder', body: event.data.text() };
  }

  const { title, body, type, riskLevel, medicineName } = data;

  // Configure notification appearance based on type
  let icon = '/favicon.ico';
  let badge = '/favicon.ico';
  let tag = `med-${type || 'reminder'}-${Date.now()}`;
  let requireInteraction = false;
  let vibrate = [200];
  let actions = [];

  switch (type) {
    case 'upcoming_reminder':
      requireInteraction = false;
      vibrate = [200, 100];
      actions = [
        { action: 'view', title: '📋 View Schedule' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
      break;

    case 'due_alarm':
      requireInteraction = true; // stays until dismissed
      vibrate = [300, 100, 300, 100, 300, 100, 300];
      actions = [
        { action: 'view', title: '💊 Open App' },
        { action: 'dismiss', title: 'Snooze' },
      ];
      break;

    case 'intake_confirmed':
      requireInteraction = false;
      vibrate = [100, 50, 100];
      actions = [
        { action: 'view', title: '📊 View Stats' },
        { action: 'dismiss', title: 'OK' },
      ];
      break;

    case 'adherence_alert':
      requireInteraction = riskLevel === 'High';
      vibrate = riskLevel === 'High' ? [200, 100, 200, 100, 200] : [200];
      actions = [
        { action: 'view', title: '📈 View Dashboard' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
      break;

    default:
      vibrate = [200];
      actions = [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
  }

  // Add risk emoji prefix to body for adherence alerts
  let displayBody = body || 'You have a medication reminder.';
  if (riskLevel) {
    const emoji = riskLevel === 'High' ? '🔴' : riskLevel === 'Moderate' ? '🟡' : '🟢';
    displayBody = `${emoji} ${displayBody}`;
  }

  const options = {
    body: displayBody,
    icon,
    badge,
    tag,
    requireInteraction,
    vibrate,
    data: {
      url: '/',
      type,
      riskLevel,
      medicineName,
      timestamp: Date.now(),
    },
    actions,
    // Silent for gentle reminders, not for alarms
    silent: type === 'upcoming_reminder',
  };

  event.waitUntil(
    self.registration.showNotification(title || 'Med App Reminder', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    // Just close — no navigation
    return;
  }

  // 'view' action or clicking the notification body
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// ── Push subscription change handler ────────────────────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
    }).then((subscription) => {
      // Re-register subscription with server
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
    })
  );
});

// ── Service worker lifecycle ─────────────────────────────────────────────────
self.addEventListener('install', () => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  console.log('[SW] Activating...');
  event.waitUntil(clients.claim());
});