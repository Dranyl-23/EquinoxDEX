'use client';

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch {
    return false;
  }
}

export function isNotificationGranted(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  return Notification.permission === 'granted';
}

export function sendDesktopNotification(title: string, body?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: body || 'EquinoxDEX Trade Alert',
        icon: '/favicon.ico',
        tag: 'equinox-dex-alert',
      });
    } catch {
      // Fallback silently if browser restricts background notification
    }
  }
}
