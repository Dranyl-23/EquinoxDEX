'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../LanguageProvider';

interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
}

interface TradeEntry {
  id: number;
  price: number;
  size: number;
  time: string;
  side: 'buy' | 'sell';
}

export function OrderBook({ currentPrice, symbol = 'BTCUSDT' }: { currentPrice: number; symbol?: string }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'book' | 'trades'>('book');
  const [bids, setBids] = useState<OrderBookEntry[]>([]);
  const [asks, setAsks] = useState<OrderBookEntry[]>([]);
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const maxTotalRef = useRef<number>(1);

  // 1. High-frequency 100ms Orderbook Depth Stream with bfcache guard
  useEffect(() => {
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

    const connectDepthWs = () => {
      if (isDestroyed || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;

      try {
        const lowerSym = symbol.toLowerCase();
        ws = new WebSocket(`wss://stream.binance.com:9443/ws/${lowerSym}@depth10@100ms`);

        ws.onmessage = (event) => {
          if (isDestroyed) return;
          try {
            const data = JSON.parse(event.data);
            if (data.bids && data.asks) {
              let bidTotal = 0;
              const formattedBids: OrderBookEntry[] = data.bids.slice(0, 8).map((b: string[]) => {
                const price = parseFloat(b[0]);
                const size = parseFloat(b[1]);
                bidTotal += size;
                return { price, size, total: bidTotal };
              });

              let askTotal = 0;
              const formattedAsks: OrderBookEntry[] = data.asks.slice(0, 8).map((a: string[]) => {
                const price = parseFloat(a[0]);
                const size = parseFloat(a[1]);
                askTotal += size;
                return { price, size, total: askTotal };
              }).reverse();

              maxTotalRef.current = Math.max(bidTotal, askTotal, 1);
              setBids(formattedBids);
              setAsks(formattedAsks);
            }
          } catch {
            // ignore JSON parse errors
          }
        };

        ws.onclose = () => {
          if (isDestroyed || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
          reconnectTimer = setTimeout(connectDepthWs, 3000);
        };

        ws.onerror = () => {
          if (ws) {
            try { ws.close(); } catch {}
          }
        };
      } catch {
        // ignore ws instantiation errors
      }
    };

    connectDepthWs();

    return () => {
      isDestroyed = true;
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try { ws.close(); } catch {}
      }
    };
  }, [symbol]);

  // 2. Real-Time Public Trades Stream
  useEffect(() => {
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

    const connectTradeWs = () => {
      if (isDestroyed || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;

      try {
        const lowerSym = symbol.toLowerCase();
        ws = new WebSocket(`wss://stream.binance.com:9443/ws/${lowerSym}@trade`);

        ws.onmessage = (event) => {
          if (isDestroyed) return;
          try {
            const data = JSON.parse(event.data);
            if (data.p && data.q) {
              const price = parseFloat(data.p);
              const size = parseFloat(data.q);
              const side: 'buy' | 'sell' = data.m ? 'sell' : 'buy';
              const timeStr = new Date(data.T).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
              
              setTrades((prev) => [
                { id: data.t || Date.now(), price, size, time: timeStr, side },
                ...prev.slice(0, 24),
              ]);
            }
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          if (isDestroyed || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
          reconnectTimer = setTimeout(connectTradeWs, 3000);
        };

        ws.onerror = () => {
          if (ws) {
            try { ws.close(); } catch {}
          }
        };
      } catch {
        // ignore ws error
      }
    };

    connectTradeWs();

    return () => {
      isDestroyed = true;
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try { ws.close(); } catch {}
      }
    };
  }, [symbol]);

  const spread = asks.length > 0 && bids.length > 0
    ? (asks[asks.length - 1].price - bids[0].price).toFixed(2)
    : '0.00';

  return (
    <div className="w-full lg:w-64 h-[350px] lg:h-full shrink-0 bg-panel/70 backdrop-blur-md border-r border-t lg:border-t-0 border-border/50 flex flex-col z-20 text-xs font-mono select-none">
      {/* Header Tabs */}
      <div className="flex border-b border-border/50 p-2 gap-2 text-xs font-sans">
        <button
          onClick={() => setActiveTab('book')}
          className={`flex-1 py-1 font-semibold rounded transition-colors text-center ${
            activeTab === 'book' ? 'bg-brand/20 text-brand font-bold' : 'text-muted hover:text-white'
          }`}
        >
          {t('orderBook') || 'Order Book'}
        </button>
        <button
          onClick={() => setActiveTab('trades')}
          className={`flex-1 py-1 font-semibold rounded transition-colors text-center ${
            activeTab === 'trades' ? 'bg-brand/20 text-brand font-bold' : 'text-muted hover:text-white'
          }`}
        >
          {t('trades') || 'Recent Trades'}
        </button>
      </div>

      {activeTab === 'book' ? (
        <div className="flex-1 flex flex-col justify-between p-2 overflow-hidden">
          {/* Asks (Sells) */}
          <div className="flex flex-col gap-0.5 justify-end flex-1">
            <div className="flex justify-between text-[10px] text-muted pb-1 font-sans border-b border-border/30">
              <span>{t('priceUsdc') ? t('priceUsdc').replace('USDC', '$') : 'Price ($)'}</span>
              <span>{t('size') || 'Size'} (BTC)</span>
            </div>
            {asks.map((entry, idx) => {
              const depthPct = Math.min(100, (entry.total / maxTotalRef.current) * 100);
              return (
                <div key={idx} className="relative flex justify-between items-center py-0.5 px-1 rounded overflow-hidden">
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-danger/15 transition-all duration-75 pointer-events-none"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="text-danger font-medium z-10">{entry.price.toFixed(2)}</span>
                  <span className="text-muted z-10">{entry.size.toFixed(4)}</span>
                </div>
              );
            })}
          </div>

          {/* Current Spread Bar */}
          <div className="my-2 py-1.5 px-2 bg-background/80 rounded border border-border/40 flex justify-between items-center">
            <span className="text-sm font-bold text-white">
              ${currentPrice > 0 ? currentPrice.toFixed(2) : '...'}
            </span>
            <span className="text-[10px] text-muted font-sans">{t('spread') || 'Spread'}: ${spread}</span>
          </div>

          {/* Bids (Buys) */}
          <div className="flex flex-col gap-0.5 flex-1">
            {bids.map((entry, idx) => {
              const depthPct = Math.min(100, (entry.total / maxTotalRef.current) * 100);
              return (
                <div key={idx} className="relative flex justify-between items-center py-0.5 px-1 rounded overflow-hidden">
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-emerald-500/15 transition-all duration-75 pointer-events-none"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="text-emerald-400 font-medium z-10">{entry.price.toFixed(2)}</span>
                  <span className="text-muted z-10">{entry.size.toFixed(4)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Recent Trades Stream */
        <div className="flex-1 flex flex-col p-2 overflow-y-auto gap-1">
          <div className="flex justify-between text-[10px] text-muted pb-1 font-sans border-b border-border/30">
            <span>{t('priceUsdc') ? t('priceUsdc').replace('USDC', '$') : 'Price ($)'}</span>
            <span>{t('size') || 'Size'}</span>
            <span>Time</span>
          </div>
          {trades.map((tr) => (
            <div key={tr.id} className="flex justify-between items-center py-0.5 px-1 text-[11px] animate-fadeIn">
              <span className={`font-medium ${tr.side === 'buy' ? 'text-emerald-400' : 'text-danger'}`}>
                ${tr.price.toFixed(2)}
              </span>
              <span className="text-muted font-mono">{tr.size.toFixed(4)}</span>
              <span className="text-[10px] text-muted/70">{tr.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
