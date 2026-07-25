import { createChart, ColorType, CandlestickData, Time, CandlestickSeries } from 'lightweight-charts';
import React, { useEffect, useRef } from 'react';

const generateDummyData = (): CandlestickData<Time>[] => {
  const data: CandlestickData<Time>[] = [];
  let time = Math.floor(Date.now() / 1000) - 1000 * 60 * 5; // start ~83 hours ago
  let close = 58500;
  
  for (let i = 0; i < 1000; i++) {
    time += 60 * 5; // 5 min intervals
    const open = close;
    const high = open + Math.random() * 200;
    const low = open - Math.random() * 200;
    close = open + (Math.random() - 0.48) * 180; // Slight upward bias
    
    const finalClose = Math.max(low, Math.min(high, close));
    
    data.push({
      time: time as Time,
      open,
      high,
      low,
      close: finalClose,
    });
  }
  
  // Ensure the last price aligns perfectly with our 60,000 mock price
  const last = data[data.length - 1];
  last.close = 60000;
  if (last.high < 60000) last.high = 60005;
  
  return data;
}

export const DUMMY_DATA = generateDummyData();

export const TradingChart = (props: { data: CandlestickData<Time>[] }) => {
	const { data } = props;
	const chartContainerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!chartContainerRef.current) return;

		const handleResize = () => {
			chart.applyOptions({ width: chartContainerRef.current!.clientWidth });
		};

		const chart = createChart(chartContainerRef.current, {
			layout: {
				background: { type: ColorType.Solid, color: '#0b0e14' }, // Matches bg-background
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

        // Simulate real-time live price ticks
        const intervalId = setInterval(() => {
            const lastCandle = data[data.length - 1];
            const now = Math.floor(Date.now() / 1000);
            
            // Start a new 5-minute candle if time has passed
            if (now >= (lastCandle.time as number) + 300) {
                const newCandle = {
                    time: ((lastCandle.time as number) + 300) as Time,
                    open: lastCandle.close,
                    high: lastCandle.close,
                    low: lastCandle.close,
                    close: lastCandle.close,
                };
                data.push(newCandle);
                candlestickSeries.update(newCandle);
            } else {
                // Wiggle the current candle by up to $15
                const current = data[data.length - 1];
                const tick = (Math.random() - 0.5) * 30; 
                
                // Keep it tethered closely to 60k for the demo
                if (current.close > 60050) current.close -= Math.abs(tick);
                else if (current.close < 59950) current.close += Math.abs(tick);
                else current.close += tick;

                if (current.close > current.high) current.high = current.close;
                if (current.close < current.low) current.low = current.close;
                
                candlestickSeries.update({ ...current });
            }
        }, 800); // Tick every 800ms

		window.addEventListener('resize', handleResize);

		return () => {
            clearInterval(intervalId);
			window.removeEventListener('resize', handleResize);
			chart.remove();
		};
	}, [data]);

	return (
		<div
			ref={chartContainerRef}
			style={{ width: '100%', height: '100%' }}
		/>
	);
};
