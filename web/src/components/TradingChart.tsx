import { createChart, ColorType, CandlestickData, Time, CandlestickSeries } from 'lightweight-charts';
import React, { useEffect, useRef, useState } from 'react';
import { MOCK_PRICE } from '@/lib/constants';

export const TradingChart = () => {
	const chartContainerRef = useRef<HTMLDivElement>(null);
    const [data, setData] = useState<CandlestickData<Time>[]>([]);
    const [error, setError] = useState<string | null>(null);
    const dataRef = useRef(data);
    
    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    useEffect(() => {
        // Fetch real Binance data
        const loadData = async () => {
            try {
                // Fetch 15-minute candlesticks for BTC-USDT
                const res = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=1000');
                const raw = await res.json();
                
                let formatted: CandlestickData<Time>[] = raw.map((d: (number | string)[]) => ({
                    time: (Number(d[0]) / 1000) as Time,
                    open: parseFloat(d[1] as string),
                    high: parseFloat(d[2] as string),
                    low: parseFloat(d[3] as string),
                    close: parseFloat(d[4] as string),
                }));

                // To prevent a massive drop candle at the end, we calculate the difference
                // between the real Binance price and our MOCK_PRICE, and shift the ENTIRE
                // chart by that difference so the shape is identical but it ends at MOCK_PRICE.
                if (formatted.length > 0) {
                    const lastRealClose = formatted[formatted.length - 1].close;
                    const priceOffset = lastRealClose - MOCK_PRICE;
                    
                    formatted = formatted.map(candle => ({
                        ...candle,
                        open: candle.open - priceOffset,
                        high: candle.high - priceOffset,
                        low: candle.low - priceOffset,
                        close: candle.close - priceOffset,
                    }));
                }

                setData(formatted);
            } catch (e) {
                console.error("Failed to load Binance data", e);
                setError("Failed to load chart data from Binance.");
            }
        };
        
        loadData();
    }, []);

	useEffect(() => {
		if (!chartContainerRef.current || data.length === 0) return;

		const handleResize = () => {
			chart.applyOptions({ width: chartContainerRef.current!.clientWidth });
		};

		const chart = createChart(chartContainerRef.current, {
			layout: {
				background: { type: ColorType.Solid, color: '#09090b' }, // Matches bg-background
				textColor: '#9CA3AF', // text-muted
			},
			grid: {
				vertLines: { color: '#1a1f2c' }, // Subtle grid
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
            upColor: '#22c55e', // Matches Tailwind green-500
            downColor: '#ef4444', // Matches Tailwind red-500
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });
        
		candlestickSeries.setData(data);

        // Simulate real-time live price ticks tethered to MOCK_PRICE
        const intervalId = setInterval(() => {
            const currentData = [...dataRef.current];
            if (currentData.length === 0) return;
            const lastCandle = currentData[currentData.length - 1];
            const now = Math.floor(Date.now() / 1000);
            
            // Start a new 15-minute candle if time has passed
            if (now >= (lastCandle.time as number) + 900) {
                const newCandle = {
                    time: ((lastCandle.time as number) + 900) as Time,
                    open: lastCandle.close,
                    high: lastCandle.close,
                    low: lastCandle.close,
                    close: lastCandle.close,
                };
                currentData.push(newCandle);
                candlestickSeries.update(newCandle);
                setData(currentData);
            } else {
                // Wiggle the current candle by up to $15
                const tick = (Math.random() - 0.5) * 30; 
                
                // Keep it tethered closely to MOCK_PRICE for the demo
                if (lastCandle.close > MOCK_PRICE + 50) lastCandle.close -= Math.abs(tick);
                else if (lastCandle.close < MOCK_PRICE - 50) lastCandle.close += Math.abs(tick);
                else lastCandle.close += tick;

                if (lastCandle.close > lastCandle.high) lastCandle.high = lastCandle.close;
                if (lastCandle.close < lastCandle.low) lastCandle.low = lastCandle.close;
                
                candlestickSeries.update({ ...lastCandle });
            }
        }, 800); // Tick every 800ms

		window.addEventListener('resize', handleResize);

		return () => {
            clearInterval(intervalId);
			window.removeEventListener('resize', handleResize);
			chart.remove();
		};
	}, [data]);

	if (error) {
        return (
            <div className="w-full h-full flex items-center justify-center text-danger border border-dashed border-danger/30 rounded-lg p-6 bg-danger/5">
                {error}
            </div>
        );
    }

	return (
		<div
			ref={chartContainerRef}
			style={{ width: '100%', height: '100%' }}
		/>
	);
};
