/**
 * Telegram Mini App WebApp SDK Integration Helper (Task #18)
 * Auto-detects inside-Telegram environment, expands viewport, configures theme & haptics.
 */

export interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  };
  colorScheme: 'light' | 'dark';
  initDataUnsafe?: {
    user?: {
      id: number;
      first_name: string;
      username?: string;
    };
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function initTelegramMiniApp() {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    console.log('🚀 Telegram Mini App initialized successfully.');
    return tg;
  }
  return null;
}

export function triggerHaptic(type: 'success' | 'warning' | 'error' | 'impact') {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
    const haptic = window.Telegram.WebApp.HapticFeedback;
    if (type === 'impact') {
      haptic.impactOccurred('medium');
    } else {
      haptic.notificationOccurred(type);
    }
  }
}
