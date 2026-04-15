// public/sw.js
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const { title, body, riskLevel } = data;

  const iconColor = riskLevel === 'High' ? '🔴' : riskLevel === 'Moderate' ? '🟡' : '🟢';
  const options = {
    body: `${iconColor} ${body}`,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: `adherence-${Date.now()}`,
    requireInteraction: riskLevel === 'High',
    vibrate: riskLevel === 'High' ? [200, 100, 200, 100, 200] : [200],
    data: { url: '/', riskLevel },
    actions: [
      { action: 'view', title: 'View Dashboard' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));