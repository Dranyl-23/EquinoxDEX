import { useState, useEffect } from 'react';

/**
 * Subscribes to ultra-high frequency sub-50ms real-time price updates via Binance @aggTrade WebSocket.
 * Outperforms standard DEX ticker polling for instant execution feedback.
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

    // 2. Connect Binance high-frequency @aggTrade WebSocket (sub-50ms updates)
    const connectWs = () => {
      const lowerSymbol = symbol.toLowerCase();
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${lowerSymbol}@aggTrade`);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // aggTrade payload uses 'p' for price and 'q' for quantity
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
        ws?.close();
      };

      ws.onclose = () => {
        if (mounted) {
          reconnectTimer = setTimeout(connectWs, 2000);
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
