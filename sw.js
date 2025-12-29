// Service Worker for Offline Support and Push Notifications
const CACHE_NAME = 'todo-app-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate event - clear old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', event => {
  // Skip non-GET requests and API calls
  if (event.request.method !== 'GET' || event.request.url.includes('/.netlify/functions/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone the response and cache it
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request);
      })
  );
});

// Push notification event
self.addEventListener('push', event => {
  console.log('[SW] Push received:', event);
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : 'You have a task reminder' };
  }
  
  const title = data.title || '⏰ Task Reminder';
  const options = {
    body: data.body || 'You have a task reminder',
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-96.svg',
    vibrate: [200, 100, 200],
    data: data.data || {},
    tag: data.data?.taskId ? `task-${data.data.taskId}` : 'reminder',
    renotify: true,
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus existing window or open new one
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(urlToOpen);
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', event => {
  console.log('[SW] Notification closed');
});
