/**
 * Desktop Notifications Helper
 * 
 * Provides utilities for requesting permission and sending notifications.
 */

// Check if browser supports notifications
export function isNotificationSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

// Get current notification permission status
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
    if (!isNotificationSupported()) {
        return 'unsupported';
    }
    return Notification.permission;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (!isNotificationSupported()) {
        console.warn('[Notifications] Not supported in this browser');
        return 'unsupported';
    }

    if (Notification.permission === 'granted') {
        return 'granted';
    }

    if (Notification.permission === 'denied') {
        console.warn('[Notifications] Permission was previously denied');
        return 'denied';
    }

    try {
        const permission = await Notification.requestPermission();
        console.log('[Notifications] Permission:', permission);
        return permission;
    } catch (error) {
        console.error('[Notifications] Error requesting permission:', error);
        return 'denied';
    }
}

// Register Service Worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
        console.warn('[SW] Service Worker not supported');
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
        });
        console.log('[SW] Registered:', registration.scope);
        return registration;
    } catch (error) {
        console.error('[SW] Registration failed:', error);
        return null;
    }
}

// Send notification via Service Worker
export async function sendNotification(options: {
    title: string;
    body: string;
    url?: string;
    conversationId?: string;
}): Promise<boolean> {
    const permission = getNotificationPermission();

    if (permission !== 'granted') {
        console.warn('[Notifications] Permission not granted:', permission);
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.ready;

        // Send message to Service Worker to show notification
        registration.active?.postMessage({
            type: 'SHOW_NOTIFICATION',
            ...options,
        });

        return true;
    } catch (error) {
        console.error('[Notifications] Error sending:', error);

        // Fallback: Use native Notification API
        try {
            new Notification(options.title, {
                body: options.body,
                icon: '/icon-192.png',
                tag: `conversation-${options.conversationId || 'default'}`,
            });
            return true;
        } catch {
            return false;
        }
    }
}

// Show notification for new message
export async function notifyNewMessage(data: {
    customerName: string;
    messagePreview: string;
    conversationId: string;
}): Promise<boolean> {
    console.log("[Notifications] notifyNewMessage called:", data);

    return sendNotification({
        title: `💬 ${data.customerName}`,
        body: data.messagePreview.length > 100
            ? data.messagePreview.slice(0, 100) + '...'
            : data.messagePreview,
        url: `/dashboard/conversations?id=${data.conversationId}`,
        conversationId: data.conversationId,
    });
}

// Initialize notifications on app load
export async function initNotifications(): Promise<{
    supported: boolean;
    permission: NotificationPermission | 'unsupported';
    swRegistered: boolean;
}> {
    const supported = isNotificationSupported();

    if (!supported) {
        return { supported: false, permission: 'unsupported', swRegistered: false };
    }

    const permission = getNotificationPermission();
    const registration = await registerServiceWorker();

    return {
        supported: true,
        permission,
        swRegistered: !!registration,
    };
}

// Play notification sound
export function playNotificationSound(): void {
    try {
        const audio = new Audio('/sounds/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {
            // Audio playback may fail if user hasn't interacted with page
        });
    } catch {
        // Audio not available
    }
}
