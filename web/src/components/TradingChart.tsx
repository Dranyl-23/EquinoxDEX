import { createChart, ColorType, Time, IChartApi, ISeriesApi, CandlestickSeries } from 'lightweight-charts';
import React, { useEffect, useRef, useState } from 'react';
import { 
  MousePointer, 
  TrendingUp, 
  Maximize2, 
  Paintbrush, 
  Type, 
  Ruler, 
  Magnet, 
  Trash2,
  Sliders,
  Calendar,
  Eye,
  EyeOff,
  PenTool,
  ChevronDown
} from 'lucide-react';

type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
type DrawingTool = 'pointer' | 'trendline' | 'fibonacci' | 'pattern' | 'riskbox' | 'brush' | 'text' | 'ruler';

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
const DATE_RANGES = ['5y', '1y', '6m', '3m', '1m', '5d', '1d'] as const;

interface DrawingLine {
  id: string;
  type: DrawingTool;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  text?: string;
}

export const TradingChart = ({ symbol = 'BTCUSDT' }: { symbol?: string }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<Timeframe>('15m');
  const [activeRange, setActiveRange] = useState<string>('1d');
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(true);

  // Calendar Date Jump Modal State
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [targetDateInput, setTargetDateInput] = useState<string>('2026-07-27');

  // Drawing Toolbar State
  const [activeTool, setActiveTool] = useState<DrawingTool>('pointer');
  const [magnetMode, setMagnetMode] = useState<boolean>(false);
  const [drawings, setDrawings] = useState<DrawingLine[]>([]);
  const [currentLine, setCurrentLine] = useState<DrawingLine | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  
  // Minimize/Maximize & Axis toggles
  const [showRightScale, setShowRightScale] = useState(true);
  const [showTools, setShowTools] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShowTools(window.innerWidth > 768);
    }
  }, []);

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
        visible: showRightScale,
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

  // Toggle Price Scale Visibility Effect
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({
        rightPriceScale: { visible: showRightScale }
      });
    }
  }, [showRightScale]);

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
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${selectedInterval}&limit=200`);
        if (!res.ok) throw new Error('Failed to fetch chart data');
        const rawData = await res.json();
        
        if (isDestroyed || !seriesRef.current) return;

        const formattedData = rawData.map((d: (string | number)[]) => ({
          time: (Number(d[0]) / 1000) as Time,
          open: parseFloat(d[1] as string),
          high: parseFloat(d[2] as string),
          low: parseFloat(d[3] as string),
          close: parseFloat(d[4] as string),
        }));

        seriesRef.current.setData(formattedData);
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }

        // Setup WebSocket for Live Kline Updates
        const wsSymbol = symbol.toLowerCase();
        ws = new WebSocket(`wss://stream.binance.com/ws/${wsSymbol}@kline_${selectedInterval}`);

        ws.onopen = () => setWsConnected(true);
        ws.onmessage = (event) => {
          if (isDestroyed || !seriesRef.current) return;
          try {
            const data = JSON.parse(event.data);
            const k = data.k;
            seriesRef.current.update({
              time: (k.t / 1000) as Time,
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
            });
          } catch {}
        };

        ws.onerror = () => setWsConnected(false);
        ws.onclose = () => {
          setWsConnected(false);
          if (!isDestroyed) {
            reconnectTimer = setTimeout(fetchKlineData, 3000);
          }
        };

      } catch (err: unknown) {
        if (!isDestroyed) {
          setError(err instanceof Error ? err.message : 'Chart stream error');
        }
      }
    };

    fetchKlineData();

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try { ws.close(); } catch {}
      }
    };
  }, [selectedInterval, symbol]);

  // Handle Range Quick Select
  const handleSelectRange = (range: string) => {
    setActiveRange(range);
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  };

  // Handle Calendar Date Jump
  const handleJumpToDate = () => {
    if (!targetDateInput || !chartRef.current) return;
    const targetTimestamp = new Date(targetDateInput).getTime() / 1000;
    if (isNaN(targetTimestamp)) return;

    try {
      chartRef.current.timeScale().setVisibleRange({
        from: (targetTimestamp - 86400 * 3) as Time,
        to: (targetTimestamp + 86400 * 3) as Time,
      });
    } catch {}
    setShowDatePicker(false);
  };

  // Drawing Canvas Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'pointer') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setCurrentLine({
      id: Math.random().toString(36).substring(2, 9),
      type: activeTool,
      startX: x,
      startY: y,
      endX: x,
      endY: y,
      text: activeTool === 'text' ? 'Analysis Note' : undefined,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !currentLine) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentLine((prev) => (prev ? { ...prev, endX: x, endY: y } : null));
  };

  const handleMouseUp = () => {
    if (isDrawing && currentLine) {
      setDrawings((prev) => [...prev, currentLine]);
      setCurrentLine(null);
      setIsDrawing(false);
    }
  };

  const renderToolGraphic = (line: DrawingLine, isDraft = false) => {
    const { id, type, startX, startY, endX, endY } = line;
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    const minX = Math.min(startX, endX);
    const minY = Math.min(startY, endY);
    const maxX = Math.max(startX, endX);
    const maxY = Math.max(startY, endY);

    if (type === 'trendline' || type === 'brush') {
      return (
        <g key={id}>
          <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="#38bdf8" strokeWidth="2.5" strokeDasharray={isDraft ? "4" : undefined} />
          <circle cx={startX} cy={startY} r="4" fill="#38bdf8" />
          <circle cx={endX} cy={endY} r="4" fill="#38bdf8" />
        </g>
      );
    }

    if (type === 'fibonacci') {
      const fibLevels = [
        { ratio: 0.0, label: '0.0% (0.000)', color: '#ef4444' },
        { ratio: 0.236, label: '23.6% (0.236)', color: '#f97316' },
        { ratio: 0.382, label: '38.2% (0.382)', color: '#eab308' },
        { ratio: 0.5, label: '50.0% (0.500)', color: '#22c55e' },
        { ratio: 0.618, label: '61.8% (0.618)', color: '#06b6d4' },
        { ratio: 1.0, label: '100.0% (1.000)', color: '#a855f7' },
      ];

      return (
        <g key={id}>
          {fibLevels.map((fib) => {
            const yPos = startY + (endY - startY) * fib.ratio;
            return (
              <g key={fib.ratio}>
                <line x1={minX} y1={yPos} x2={Math.max(maxX, minX + 300)} y2={yPos} stroke={fib.color} strokeWidth="1.5" strokeDasharray="3 3" />
                <text x={minX + 4} y={yPos - 4} fill={fib.color} fontSize="10" fontFamily="monospace" fontWeight="bold">
                  {fib.label}
                </text>
              </g>
            );
          })}
        </g>
      );
    }

    if (type === 'pattern') {
      // XABCD Pattern
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      const ptA = { x: startX, y: startY };
      const ptB = { x: startX + width * 0.3, y: maxY };
      const ptC = { x: midX, y: minY + height * 0.3 };
      const ptD = { x: endX, y: endY };

      const pathStr = `M ${ptA.x} ${ptA.y} L ${ptB.x} ${ptB.y} L ${ptC.x} ${ptC.y} L ${ptD.x} ${ptD.y}`;

      return (
        <g key={id}>
          <path d={pathStr} fill="rgba(168, 85, 247, 0.15)" stroke="#a855f7" strokeWidth="2" strokeDasharray={isDraft ? "4" : undefined} />
          <circle cx={ptA.x} cy={ptA.y} r="4" fill="#a855f7" />
          <text x={ptA.x - 8} y={ptA.y - 6} fill="#a855f7" fontSize="11" fontWeight="bold">X</text>
          <circle cx={ptB.x} cy={ptB.y} r="4" fill="#a855f7" />
          <text x={ptB.x - 8} y={ptB.y + 14} fill="#a855f7" fontSize="11" fontWeight="bold">A</text>
          <circle cx={ptC.x} cy={ptC.y} r="4" fill="#a855f7" />
          <text x={ptC.x - 8} y={ptC.y - 6} fill="#a855f7" fontSize="11" fontWeight="bold">B</text>
          <circle cx={ptD.x} cy={ptD.y} r="4" fill="#a855f7" />
          <text x={ptD.x + 6} y={ptD.y + 14} fill="#a855f7" fontSize="11" fontWeight="bold">C/D</text>
        </g>
      );
    }

    if (type === 'riskbox') {
      // Long Position Risk-Reward Box
      const tpHeight = Math.max(20, height * 0.6);
      const slHeight = Math.max(20, height * 0.4);

      return (
        <g key={id}>
          {/* Target Profit (Green Box) */}
          <rect x={minX} y={minY} width={Math.max(120, width)} height={tpHeight} fill="rgba(34, 197, 94, 0.2)" stroke="#22c55e" strokeWidth="1.5" />
          <text x={minX + 8} y={minY + 16} fill="#22c55e" fontSize="10" fontFamily="monospace" fontWeight="bold">
            Target Profit: +{(tpHeight * 0.12).toFixed(2)}% (R:R 2.50)
          </text>

          {/* Stop Loss (Red Box) */}
          <rect x={minX} y={minY + tpHeight} width={Math.max(120, width)} height={slHeight} fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="1.5" />
          <text x={minX + 8} y={minY + tpHeight + 16} fill="#ef4444" fontSize="10" fontFamily="monospace" fontWeight="bold">
            Stop Loss: -{(slHeight * 0.12).toFixed(2)}%
          </text>
        </g>
      );
    }

    if (type === 'text') {
      return (
        <g key={id}>
          <rect x={startX} y={startY - 18} width="110" height="24" rx="4" fill="#18181b" stroke="#38bdf8" strokeWidth="1" />
          <text x={startX + 8} y={startY - 3} fill="#ffffff" fontSize="11" fontFamily="sans-serif" fontWeight="bold">
            📌 Analysis Note
          </text>
        </g>
      );
    }

    if (type === 'ruler') {
      const deltaPct = ((height / 200) * 100).toFixed(2);
      return (
        <g key={id}>
          <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 4" />
          <rect x={(startX + endX) / 2 - 45} y={(startY + endY) / 2 - 14} width="90" height="20" rx="4" fill="#000000" stroke="#f59e0b" strokeWidth="1" />
          <text x={(startX + endX) / 2} y={(startY + endY) / 2} fill="#f59e0b" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
            Δ +{deltaPct}%
          </text>
        </g>
      );
    }

    return null;
  };

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center text-danger border border-dashed border-danger/30 rounded-lg p-6 bg-danger/5">
        {error}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex pt-12 pb-8 [&_#tv-attr-logo]:hidden [&_a]:hidden overflow-hidden">
      
      {/* Timeframe Selector Toolbar */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-panel/95 backdrop-blur-md border border-border/60 rounded-lg p-1 shadow-lg">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setSelectedInterval(tf)}
            className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-md transition-all cursor-pointer ${
              selectedInterval === tf
                ? 'bg-brand text-white shadow-sm'
                : 'text-muted hover:text-white hover:bg-border/40'
            }`}
          >
            {tf}
          </button>
        ))}
        <div className="w-px h-4 bg-border/60 mx-1" />
        <button
          onClick={() => setShowTools(!showTools)}
          className={`p-1 rounded cursor-pointer transition-colors ${showTools ? 'text-brand bg-brand/10' : 'text-muted hover:text-white hover:bg-border/40'}`}
          title="Toggle Drawing Tools"
        >
          <PenTool className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setShowRightScale(!showRightScale)}
          className={`p-1 rounded cursor-pointer transition-colors ${showRightScale ? 'text-muted hover:text-white hover:bg-border/40' : 'text-danger bg-danger/10 hover:bg-danger/20'}`}
          title="Toggle Price Scale (Y-Axis)"
        >
          {showRightScale ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        {!wsConnected && (
          <span className="ml-2 text-[10px] text-amber-400 flex items-center gap-1 font-mono animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
            Reconnecting...
          </span>
        )}
      </div>

      {/* Left Pro Chart Drawing Toolbar */}
      {showTools && (
        <div className="absolute left-2 top-12 z-20 flex flex-col gap-1 bg-panel/90 backdrop-blur-xl border border-border/70 rounded-xl p-1 shadow-2xl max-h-[220px] md:max-h-[80%] overflow-y-auto custom-scrollbar">
          <button
              onClick={() => setActiveTool('pointer')}
              className="p-2 rounded-lg transition-colors cursor-pointer relative group text-muted hover:text-white hover:bg-background"
              title="Pointer / Crosshair"
            >
              <MousePointer className={`w-4 h-4 ${activeTool === 'pointer' ? 'text-brand font-bold' : ''}`} />
              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-panel/95 border border-border/80 text-white text-[11px] font-semibold px-2 py-1 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Crosshair
              </span>
            </button>

            <button
              onClick={() => setActiveTool('trendline')}
              className="p-2 rounded-lg transition-colors cursor-pointer relative group text-muted hover:text-white hover:bg-background"
              title="Trendline Tool"
            >
              <TrendingUp className={`w-4 h-4 ${activeTool === 'trendline' ? 'text-brand font-bold' : ''}`} />
              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-panel/95 border border-border/80 text-white text-[11px] font-semibold px-2 py-1 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Trendline
              </span>
            </button>

            <button
              onClick={() => setActiveTool('fibonacci')}
              className="p-2 rounded-lg transition-colors cursor-pointer relative group text-muted hover:text-white hover:bg-background"
              title="Fibonacci Retracement"
            >
              <Sliders className={`w-4 h-4 ${activeTool === 'fibonacci' ? 'text-brand font-bold' : ''}`} />
              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-panel/95 border border-border/80 text-white text-[11px] font-semibold px-2 py-1 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Fibonacci Retracement
              </span>
            </button>

            <button
              onClick={() => setActiveTool('pattern')}
              className="p-2 rounded-lg transition-colors cursor-pointer relative group text-muted hover:text-white hover:bg-background"
              title="XABCD Pattern Tool"
            >
              <Maximize2 className={`w-4 h-4 ${activeTool === 'pattern' ? 'text-brand font-bold' : ''}`} />
              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-panel/95 border border-border/80 text-white text-[11px] font-semibold px-2 py-1 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                XABCD Pattern
              </span>
            </button>

            <button
              onClick={() => setActiveTool('riskbox')}
              className="p-2 rounded-lg transition-colors cursor-pointer relative group text-muted hover:text-white hover:bg-background"
              title="Long / Short Position Projection"
            >
              <Sliders className={`w-4 h-4 rotate-90 ${activeTool === 'riskbox' ? 'text-brand font-bold' : ''}`} />
              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-panel/95 border border-border/80 text-white text-[11px] font-semibold px-2 py-1 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Long Position
              </span>
            </button>

            <button
              onClick={() => setActiveTool('brush')}
              className="p-2 rounded-lg transition-colors cursor-pointer relative group text-muted hover:text-white hover:bg-background"
              title="Freehand Brush"
            >
              <Paintbrush className={`w-4 h-4 ${activeTool === 'brush' ? 'text-brand font-bold' : ''}`} />
              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-panel/95 border border-border/80 text-white text-[11px] font-semibold px-2 py-1 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Brush Markup
              </span>
            </button>

            <button
              onClick={() => setActiveTool('text')}
              className="p-2 rounded-lg transition-colors cursor-pointer relative group text-muted hover:text-white hover:bg-background"
              title="Text Note"
            >
              <Type className={`w-4 h-4 ${activeTool === 'text' ? 'text-brand font-bold' : ''}`} />
              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-panel/95 border border-border/80 text-white text-[11px] font-semibold px-2 py-1 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Text Note
              </span>
            </button>

            <button
              onClick={() => setActiveTool('ruler')}
              className="p-2 rounded-lg transition-colors cursor-pointer relative group text-muted hover:text-white hover:bg-background"
              title="Price & Delta Measure Ruler"
            >
              <Ruler className={`w-4 h-4 ${activeTool === 'ruler' ? 'text-brand font-bold' : ''}`} />
              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-panel/95 border border-border/80 text-white text-[11px] font-semibold px-2 py-1 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Price & Delta Measure
              </span>
            </button>

            <div className="w-full h-px bg-border/60 my-0.5" />

            <button
              onClick={() => setMagnetMode((prev) => !prev)}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                magnetMode ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-muted hover:text-white hover:bg-background'
              }`}
              title={magnetMode ? 'Magnet Mode Enabled' : 'Enable Magnet Snap'}
            >
              <Magnet className="w-4 h-4" />
            </button>

          <button
            onClick={() => {
              setDrawings([]);
              setCurrentLine(null);
            }}
            className="p-2 rounded-lg text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Clear All Drawings"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Chart Canvas & Interactive Drawing Overlay Container */}
      <div 
        className="relative w-full flex-1 min-h-0 ml-12"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div ref={chartContainerRef} className="w-full h-full" />

        {/* SVG Drawing Layer Overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {drawings.map((line) => renderToolGraphic(line, false))}
          {currentLine && renderToolGraphic(currentLine, true)}
        </svg>
      </div>

      {/* Bottom Historical Date Range & Go To Date Toolbar */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-panel/95 backdrop-blur-md border border-border/60 rounded-lg px-3 py-1 shadow-lg text-xs font-mono">
        <div className="flex items-center gap-1.5 text-muted">
          {DATE_RANGES.map((rng) => (
            <button
              key={rng}
              onClick={() => handleSelectRange(rng)}
              className={`hover:text-white transition-colors cursor-pointer font-semibold px-1.5 py-0.5 rounded ${
                activeRange === rng ? 'text-brand font-bold bg-brand/10' : ''
              }`}
            >
              {rng}
            </button>
          ))}
        </div>

        <div className="w-px h-3 bg-border/60" />

        <div className="relative">
          <button
            onClick={() => setShowDatePicker((prev) => !prev)}
            className="flex items-center gap-1 text-muted hover:text-white transition-colors cursor-pointer font-semibold"
            title="Go to Date (Calendar Jump)"
          >
            <Calendar className="w-3.5 h-3.5 text-brand" />
          </button>

          {showDatePicker && (
            <div className="absolute bottom-full right-0 mb-2 p-4 bg-panel/95 border border-border/80 rounded-2xl shadow-2xl backdrop-blur-2xl z-50 flex flex-col gap-3.5 w-64 text-xs font-sans">
              
              {/* Header */}
              <div className="flex justify-between items-center border-b border-border/60 pb-2">
                <span className="font-bold text-white text-sm">Go to</span>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="text-muted hover:text-white font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border/60 text-xs font-semibold gap-4 pb-1">
                <button className="text-white font-bold border-b-2 border-brand pb-1">Date</button>
                <button className="text-muted hover:text-white pb-1">Custom range</button>
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-2 gap-2 font-mono">
                <input
                  type="date"
                  value={targetDateInput}
                  onChange={(e) => setTargetDateInput(e.target.value)}
                  className="w-full min-w-0 bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:border-brand"
                />
                <input
                  type="time"
                  defaultValue="00:00"
                  className="w-full min-w-0 bg-background border border-border/80 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:border-brand text-center"
                />
              </div>

              {/* Days Grid (July 2026) */}
              <div className="flex flex-col gap-1 bg-background/60 p-2.5 rounded-xl border border-border/60 font-mono">
                <div className="flex justify-between items-center text-[10px] text-muted font-bold pb-1">
                  <span>‹</span>
                  <span className="text-white">July 2026</span>
                  <span>›</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-[10px] text-center text-muted">
                  <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs pt-1">
                  <span className="text-muted/40"></span><span className="text-muted/40"></span>
                  <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                  <span>6</span><span>7</span><span>8</span><span>9</span><span>10</span><span>11</span><span>12</span>
                  <span>13</span><span>14</span><span>15</span><span>16</span><span>17</span><span>18</span><span>19</span>
                  <span>20</span><span>21</span><span>22</span><span>23</span><span>24</span><span>25</span><span>26</span>
                  <span className="bg-brand text-white font-bold rounded shadow-sm py-0.5">27</span>
                  <span className="text-muted">28</span><span className="text-muted">29</span><span className="text-muted">30</span><span className="text-muted">31</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="px-3 py-1.5 border border-border/80 rounded-lg text-xs font-semibold text-muted hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJumpToDate}
                  className="px-4 py-1.5 bg-brand hover:bg-brand/90 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer"
                >
                  Go to
                </button>
              </div>

            </div>
          )}
        </div>
      </div>

    </div>
  );
};
