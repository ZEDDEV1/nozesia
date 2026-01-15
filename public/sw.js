/**
 * Push Notifications Service Worker
 * 
 * Handles background notifications for new messages and events.
 */

const CACHE_NAME = 'agentedeia-v1';

// Install event
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('[SW] Service Worker activated');
    event.waitUntil(self.clients.claim());
});

// Push notification received
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received');

    let data = {
        title: 'AgenteDeia',
        body: 'Nova mensagem recebida',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: 'new-message',
        data: {},
    };

    // Parse push data if available
    if (event.data) {
        try {
            const payload = event.data.json();
            data = { ...data, ...payload };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/icon-192.png',
        badge: data.badge || '/badge-72.png',
        tag: data.tag || 'new-message',
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: data.data,
        actions: [
            { action: 'open', title: 'Abrir' },
            { action: 'dismiss', title: 'Ignorar' },
        ],
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.action);

    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    // Get the URL to open
    const urlToOpen = event.notification.data?.url || '/dashboard/conversations';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If app is already open, focus it
                for (const client of clientList) {
                    if (client.url.includes('/dashboard') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise open new window
                if (self.clients.openWindow) {
                    return self.clients.openWindow(urlToOpen);
                }
            })
    );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
    console.log('[SW] Notification closed');
});

// Message from main app
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);

    if (event.data.type === 'SHOW_NOTIFICATION') {
        const { title, body, url, conversationId } = event.data;

        self.registration.showNotification(title || 'Nova mensagem', {
            body: body || 'Você recebeu uma nova mensagem',
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            tag: `conversation-${conversationId || 'default'}`,
            requireInteraction: false,
            vibrate: [200],
            data: { url: url || '/dashboard/conversations', conversationId },
        });
    }
});
