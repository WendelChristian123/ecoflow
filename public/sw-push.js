/**
 * Push Notification Service Worker Extension
 * This file is loaded by the Workbox SW via importScripts.
 * Handles: push events, notification click with deep linking.
 * 
 * MOBILE PWA ONLY — this SW only activates in standalone mode.
 */

// Push event: show notification
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = {
      title: 'Contazze',
      body: event.data.text(),
      data: {}
    };
  }

  const title = payload.title || 'Contazze';
  const options = {
    body: payload.body || '',
    icon: self.location.origin + '/notif-icon.png',
    badge: self.location.origin + '/notif-badge.png',
    tag: payload.data?.id || 'contazze-notif-' + Date.now() + '-' + Math.random(),
    renotify: true,
    data: {
      url: payload.data?.url || '/',
      type: payload.data?.type || 'general',
      id: payload.data?.id || null
    },
    vibrate: [300, 100, 300, 100, 300],
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click: deep link to the relevant item
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notifData = event.notification.data || {};
  let targetUrl = notifData.url || '/';

  // Build deep link based on type
  if (notifData.type && notifData.id) {
    switch (notifData.type) {
      case 'task_deadline':
        targetUrl = `/#/tasks?open=${notifData.id}`;
        break;
      case 'event_start':
        targetUrl = `/#/agenda?open=${notifData.id}`;
        break;
      case 'payable_due':
      case 'receivable_due':
        targetUrl = `/#/finance/transactions?open=${notifData.id}`;
        break;
      case 'quote_expiration':
        targetUrl = `/#/commercial/quotes?open=${notifData.id}`;
        break;
      default:
        targetUrl = notifData.url || '/#/dashboard';
    }
  }

  // Resolve to absolute URL
  const urlToOpen = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If app is already open, navigate to the deep link
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin)) {
          client.navigate(urlToOpen);
          client.focus();
          return;
        }
      }
      // Otherwise, open a new window
      return clients.openWindow(urlToOpen);
    })
  );
});
