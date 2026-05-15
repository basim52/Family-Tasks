self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'تنبيـه جديـد 🌴';
  const options = {
    body: data.body || 'لديك تحديث جديد في تطبيق العائلة',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
