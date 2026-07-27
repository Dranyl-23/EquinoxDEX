import { createChart, ColorType, CandlestickData, Time, IChartApi, ISeriesApi, CandlestickSeries } from 'lightweight-charts';
import React, { useEffect, useRef, useState } from 'react';

type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

export const TradingChart = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<Timeframe>('15m');
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(true);

  // Initialize Chart once & set up ResizeObserver for perfect timeScale visibility
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const initialWidth = container.clientWidth || 600;
    const initialHeight = container.clientHeight || 400;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#1a1f2c' },
        horzLines: { color: '#1a1f2c' },
      },
      width: initialWidth,
      height: initialHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#2a2f3a',
        visible: true,
      },
      rightPriceScale: {
        borderColor: '#2a2f3a',
        visible: true,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
        
    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Use ResizeObserver so exact height/width is calculated without padding displacement
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        chart.applyOptions({ width, height });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Fetch Initial Data and connect WebSocket for selected interval with bfcache guard
  useEffect(() => {
    if (!seriesRef.current) return;
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

    const fetchKlineData = async () => {
      try {
        setError(null);
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${selectedInterval}&limit=200`);
        if (!res.ok) throw new Error('Failed to fetch chart data');
        const rawData = await res.json();
        
        const formattedData: CandlestickData<Time>[] = rawData.map((d: (string | number)[]) => ({
          time: (Number(d[0]) / 1000) as Time,
          open: parseFloat(d[1] as string),
          high: parseFloat(d[2] as string),
          low: parseFloat(d[3] as string),
          close: parseFloat(d[4] as string),
        }));

        if (seriesRef.current && !isDestroyed) {
          seriesRef.current.setData(formattedData);
          chartRef.current?.timeScale().fitContent();
        }
      } catch (err: unknown) {
        if (!isDestroyed) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    fetchKlineData();

    // 2. Real-time WebSocket Kline stream
    const connectWs = () => {
      if (isDestroyed || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;

      try {
        ws = new WebSocket(`wss://stream.binance.com:9443/ws/btcusdt@kline_${selectedInterval}`);

        ws.onopen = () => {
          if (!isDestroyed) setWsConnected(true);
        };

        ws.onmessage = (event) => {
          if (isDestroyed) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.e === 'kline' && seriesRef.current) {
              const k = msg.k;
              const candle: CandlestickData<Time> = {
                time: (k.t / 1000) as Time,
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
              };
              seriesRef.current.update(candle);
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onerror = () => {
          if (!isDestroyed) setWsConnected(false);
          if (ws) {
            try { ws.close(); } catch {}
          }
        };

        ws.onclose = () => {
          if (!isDestroyed && typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
            setWsConnected(false);
            reconnectTimer = setTimeout(connectWs, 3000);
          }
        };
      } catch {
        if (!isDestroyed) setWsConnected(false);
      }
    };

    connectWs();

    return () => {
      isDestroyed = true;
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try { ws.close(); } catch {}
      }
    };
  }, [selectedInterval]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center text-danger border border-dashed border-danger/30 rounded-lg p-6 bg-danger/5">
        {error}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col pt-12 pb-1 [&_#tv-attr-logo]:hidden [&_a]:hidden overflow-hidden">
      {/* Timeframe Selector Toolbar (Hyperliquid Style) */}
      <div className="absolute top-2.5 left-3 z-20 flex items-center gap-1 bg-panel/95 backdrop-blur-md border border-border/60 rounded-lg p-1 shadow-lg">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setSelectedInterval(tf)}
            className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-md transition-all ${
              selectedInterval === tf
                ? 'bg-brand text-white shadow-sm'
                : 'text-muted hover:text-white hover:bg-border/40'
            }`}
          >
            {tf}
          </button>
        ))}
        {!wsConnected && (
          <span className="ml-2 text-[10px] text-amber-400 flex items-center gap-1 font-mono animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
            Reconnecting...
          </span>
        )}
      </div>

      {/* Chart Canvas Container */}
      <div
        ref={chartContainerRef}
        className="w-full flex-1 min-h-0"
      />
    </div>
  );
};
