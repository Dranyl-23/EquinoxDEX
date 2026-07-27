'use client';
import { useSyncExternalStore } from 'react';

const subscribeOffline = (callback: () => void) => {
  if (typeof window !== 'undefined') {
    window.addEventListener('offline', callback);
    window.addEventListener('online', callback);
    return () => {
      window.removeEventListener('offline', callback);
      window.removeEventListener('online', callback);
    };
  }
  return () => {};
};

const getOfflineSnapshot = () => (typeof navigator !== 'undefined' ? !navigator.onLine : false);
const getServerOfflineSnapshot = () => false;

export function NetworkBanner() {
  const isOffline = useSyncExternalStore(subscribeOffline, getOfflineSnapshot, getServerOfflineSnapshot);

  if (!isOffline) return null;

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-300 px-4 py-2 text-xs flex items-center justify-between font-medium backdrop-blur-md z-50">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
        </span>
        <span>
          Internet Disconnected — Retrying connection to Binance & Stellar Testnet...
        </span>
      </div>
    </div>
  );
}
