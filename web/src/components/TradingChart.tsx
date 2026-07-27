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

  // Initialize Chart once
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#1a1f2c' },
        horzLines: { color: '#1a1f2c' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#2a2f3a',
      },
      rightPriceScale: {
        borderColor: '#2a2f3a',
      }
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

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Fetch Initial Data and connect WebSocket for selected interval
  useEffect(() => {
    if (!seriesRef.current) return;
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const loadData = async () => {
      try {
        setError(null);
        // 1. Fetch REST Data for selected interval
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${selectedInterval}&limit=1000`);
        const raw = await res.json();
        
        const formatted: CandlestickData<Time>[] = raw.map((d: (number | string)[]) => ({
          time: (Number(d[0]) / 1000) as Time,
          open: parseFloat(d[1] as string),
          high: parseFloat(d[2] as string),
          low: parseFloat(d[3] as string),
          close: parseFloat(d[4] as string),
        }));

        seriesRef.current?.setData(formatted);

        // 2. Connect WebSocket for selected timeframe interval
        const connectWs = () => {
          try {
            ws = new WebSocket(`wss://stream.binance.com:9443/ws/btcusdt@kline_${selectedInterval}`);
            
            ws.onopen = () => {
              setWsConnected(true);
            };

            ws.onmessage = (event) => {
              try {
                const message = JSON.parse(event.data);
                if (message.e === 'kline' && seriesRef.current) {
                  const kline = message.k;
                  seriesRef.current.update({
                    time: (kline.t / 1000) as Time,
                    open: parseFloat(kline.o),
                    high: parseFloat(kline.h),
                    low: parseFloat(kline.l),
                    close: parseFloat(kline.c),
                  });
                  setWsConnected(true);
                }
              } catch {
                // ignore parse errors
              }
            };

            ws.onclose = () => {
              setWsConnected(false);
              reconnectTimer = setTimeout(connectWs, 3000);
            };

            ws.onerror = () => {
              setWsConnected(false);
              ws?.close();
            };
          } catch {
            setWsConnected(false);
          }
        };

        connectWs();

      } catch {
        setError("Failed to load chart data.");
      }
    };
    
    void loadData();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
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
    <div className="relative w-full h-full flex flex-col">
      {/* Timeframe Selector Toolbar (Hyperliquid Style) */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-panel/90 backdrop-blur border border-border/50 rounded-md p-1">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setSelectedInterval(tf)}
            className={`px-2 py-0.5 text-xs font-mono font-medium rounded transition-colors ${
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

      <div
        ref={chartContainerRef}
        className="w-full h-full pt-10"
      />
    </div>
  );
};
