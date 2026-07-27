'use client';
import { useState, useEffect } from 'react';

export function NetworkBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      setIsSlow(false);
    };

    if (!navigator.onLine) {
      setIsOffline(true);
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    const nav = navigator as unknown as { connection?: { effectiveType?: string; addEventListener?: (type: string, fn: () => void) => void } };
    if (nav.connection) {
      const checkConnection = () => {
        const type = nav.connection?.effectiveType;
        if (type === 'slow-2g' || type === '2g') {
          setIsSlow(true);
        } else {
          setIsSlow(false);
        }
      };
      checkConnection();
      nav.connection.addEventListener?.('change', checkConnection);
    }

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline && !isSlow) return null;

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-300 px-4 py-2 text-xs flex items-center justify-between font-medium backdrop-blur-md z-50">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
        </span>
        <span>
          {isOffline
            ? 'Internet Disconnected — Retrying connection to Binance & Stellar Testnet...'
            : 'Slow Network Connection Detected — Price updates may be slightly delayed.'}
        </span>
      </div>
    </div>
  );
}
