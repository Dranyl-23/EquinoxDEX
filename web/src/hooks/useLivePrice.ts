import { useState, useEffect } from 'react';

/**
 * Subscribes to real-time price updates via Binance WebSocket with REST fallback.
 * @param symbol The pair symbol, e.g., "BTCUSDT"
 */
export function useLivePrice(symbol: string = 'BTCUSDT') {
  const [price, setPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    // 1. Initial REST fetch for instant price availability
    const fetchInitialPrice = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        if (!res.ok) throw new Error('Failed to fetch initial price');
        const data = await res.json();
        if (mounted && data.price) {
          setPrice(parseFloat(data.price));
          setLoading(false);
          setError(null);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    };

    fetchInitialPrice();

    // 2. Connect Binance real-time WebSocket ticker
    const connectWs = () => {
      const lowerSymbol = symbol.toLowerCase();
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${lowerSymbol}@ticker`);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.c) {
            const p = parseFloat(data.c);
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
        ws?.close();
      };

      ws.onclose = () => {
        if (mounted) {
          reconnectTimer = setTimeout(connectWs, 3000);
        }
      };
    };

    connectWs();

    return () => {
      mounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [symbol]);

  return { price, loading, error };
}
