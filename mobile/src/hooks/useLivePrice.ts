import { useState, useEffect } from 'react';

export interface LivePriceData {
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  connected: boolean;
}

export function useLivePrice(symbol: string): LivePriceData {
  const [data, setData] = useState<LivePriceData>({
    price: 0,
    change24h: 0,
    high24h: 0,
    low24h: 0,
    volume24h: 0,
    connected: false,
  });

  useEffect(() => {
    if (!symbol) return;

    const wsSymbol = symbol.toLowerCase();
    const wsUrl = `wss://stream.binance.com:9443/ws/${wsSymbol}@ticker`;
    
    let ws: WebSocket | null = null;
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (pollInterval || !isMounted) return;
      pollInterval = setInterval(fetchRestPrice, 2000);
    };

    // Fallback REST fetch function if WebSocket is blocked by ISP or slow
    const fetchRestPrice = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`);
        if (res.ok && isMounted) {
          const json = await res.json();
          if (json.lastPrice) {
            setData({
              price: parseFloat(json.lastPrice),
              change24h: parseFloat(json.priceChangePercent),
              high24h: parseFloat(json.highPrice),
              low24h: parseFloat(json.lowPrice),
              volume24h: parseFloat(json.quoteVolume),
              connected: true,
            });
          }
        } else if (isMounted) {
          setData((prev) => ({ ...prev, connected: false }));
        }
      } catch {
        // If network is offline, set connected: false (do NOT fake connected status)
        if (isMounted) {
          setData((prev) => ({
            ...prev,
            connected: false,
          }));
        }
      }
    };

    // Immediate initial fetch
    fetchRestPrice();

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (isMounted) setData((prev) => ({ ...prev, connected: true }));
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const message = JSON.parse(event.data);
          if (message.c) {
            setData({
              price: parseFloat(message.c),
              change24h: parseFloat(message.P),
              high24h: parseFloat(message.h),
              low24h: parseFloat(message.l),
              volume24h: parseFloat(message.q),
              connected: true,
            });
          }
        } catch {
          // Ignore
        }
      };

      ws.onerror = () => {
        startPolling();
      };

      ws.onclose = () => {
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      isMounted = false;
      if (ws) {
        try { ws.close(); } catch {}
      }
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };
  }, [symbol]);

  return data;
}
