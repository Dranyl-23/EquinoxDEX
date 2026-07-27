import { createChart, ColorType, CandlestickData, Time, IChartApi, ISeriesApi, CandlestickSeries } from 'lightweight-charts';
import React, { useEffect, useRef, useState } from 'react';

export const TradingChart = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
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

  // Fetch Initial Data and connect WebSocket
  useEffect(() => {
    if (!seriesRef.current) return;
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const loadData = async () => {
      try {
        // 1. Fetch REST Data
        const res = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=1000');
        const raw = await res.json();
        
        const formatted: CandlestickData<Time>[] = raw.map((d: (number | string)[]) => ({
          time: (Number(d[0]) / 1000) as Time,
          open: parseFloat(d[1] as string),
          high: parseFloat(d[2] as string),
          low: parseFloat(d[3] as string),
          close: parseFloat(d[4] as string),
        }));

        seriesRef.current?.setData(formatted);

        // 2. Connect WebSocket for live updates with silent auto-reconnect
        const connectWs = () => {
          try {
            ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_15m');
            
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
              reconnectTimer = setTimeout(connectWs, 5000);
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
        setError("Failed to load chart data. Retrying...");
      }
    };
    
    void loadData();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center text-danger border border-dashed border-danger/30 rounded-lg p-6 bg-danger/5">
        {error}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {!wsConnected && (
        <div className="absolute top-3 left-3 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded backdrop-blur-md z-20 flex items-center gap-1.5 animate-pulse font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
          Reconnecting live chart stream...
        </div>
      )}
      <div
        ref={chartContainerRef}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};
