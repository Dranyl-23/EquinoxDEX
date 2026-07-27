import { useState, useEffect } from 'react';

/**
 * Subscribes to ultra-high frequency sub-50ms real-time price updates via Binance @aggTrade WebSocket.
 * Includes pagehide & bfcache guards to prevent Chrome DevTools WebSocket warnings.
 */
export function useLivePrice(symbol: string = 'BTCUSDT') {
  const [price, setPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let isDestroyed = false;

    const handlePageHide = () => {
      isDestroyed = true;
      if (ws) {
        try { ws.close(); } catch {}
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    // 1. Initial REST fetch for instant price availability
    const fetchInitialPrice = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        if (!res.ok) throw new Error('Failed to fetch initial price');
        const data = await res.json();
        if (mounted && !isDestroyed && data.price) {
          setPrice(parseFloat(data.price));
          setLoading(false);
          setError(null);
        }
      } catch (err: unknown) {
        if (mounted && !isDestroyed) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    };

    fetchInitialPrice();

    let attemptCount = 0;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && mounted && !isDestroyed) {
        if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          attemptCount = 0;
          connectWs();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 2. Connect Binance high-frequency @aggTrade WebSocket
    const connectWs = () => {
      if (isDestroyed || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;

      try {
        const lowerSymbol = symbol.toLowerCase();
        ws = new WebSocket(`wss://stream.binance.com/ws/${lowerSymbol}@aggTrade`);

        ws.onopen = () => {
          attemptCount = 0;
        };

        ws.onmessage = (event) => {
          if (isDestroyed) return;
          try {
            const data = JSON.parse(event.data);
            const rawPrice = data.p || data.c;
            if (rawPrice) {
              const p = parseFloat(rawPrice);
              if (mounted && !isNaN(p)) {
                setPrice(p);
                setLoading(false);
                setError(null);
              }
            }
          } catch {
            // ignore parsing error
          }
        };

        ws.onerror = () => {
          if (ws) {
            try { ws.close(); } catch {}
          }
        };

        ws.onclose = () => {
          if (mounted && !isDestroyed && typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
            attemptCount++;
            const delay = Math.min(1000 * Math.pow(2, attemptCount), 30000);
            reconnectTimer = setTimeout(connectWs, delay);
          }
        };
      } catch {
        // ignore ws error
      }
    };

    connectWs();

    return () => {
      mounted = false;
      isDestroyed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try { ws.close(); } catch {}
      }
    };
  }, [symbol]);

  return { price, loading, error };
}
