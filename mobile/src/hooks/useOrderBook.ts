import { useState, useEffect } from 'react';

export interface OrderBookEntry {
  price: string;
  size: string;
  total: string;
}

export interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: string;
  connected: boolean;
}

export function useOrderBook(symbol: string): OrderBookData {
  const [data, setData] = useState<OrderBookData>({
    bids: [],
    asks: [],
    spread: '0.00',
    connected: false,
  });

  useEffect(() => {
    if (!symbol) return;

    const wsSymbol = symbol.toLowerCase();
    const wsUrl = `wss://stream.binance.com:9443/ws/${wsSymbol}@depth10@100ms`;

    let ws: WebSocket | null = null;
    let isMounted = true;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (isMounted) setData((prev) => ({ ...prev, connected: true }));
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const message = JSON.parse(event.data);
          // message.bids = [[price, qty], ...], message.asks = [[price, qty], ...]
          if (message.bids && message.asks) {
            const rawBids = message.bids.slice(0, 5);
            const rawAsks = message.asks.slice(0, 5);

            const asks: OrderBookEntry[] = rawAsks.map((item: [string, string]) => {
              const p = parseFloat(item[0]);
              const q = parseFloat(item[1]);
              return {
                price: p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                size: q.toFixed(3),
                total: (p * q).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              };
            }).reverse();

            const bids: OrderBookEntry[] = rawBids.map((item: [string, string]) => {
              const p = parseFloat(item[0]);
              const q = parseFloat(item[1]);
              return {
                price: p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                size: q.toFixed(3),
                total: (p * q).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              };
            });

            // Calculate spread
            const bestAsk = parseFloat(rawAsks[0]?.[0] || '0');
            const bestBid = parseFloat(rawBids[0]?.[0] || '0');
            const spread = (bestAsk - bestBid).toFixed(2);

            setData({
              bids,
              asks,
              spread,
              connected: true,
            });
          }
        } catch {
          // Swallow parse error
        }
      };

      ws.onerror = () => {
        if (isMounted) setData((prev) => ({ ...prev, connected: false }));
      };

      ws.onclose = () => {
        if (isMounted) setData((prev) => ({ ...prev, connected: false }));
      };
    } catch {
      if (isMounted) setData((prev) => ({ ...prev, connected: false }));
    }

    return () => {
      isMounted = false;
      if (ws) {
        try {
          ws.close();
        } catch {
          // Ignore
        }
      }
    };
  }, [symbol]);

  return data;
}
