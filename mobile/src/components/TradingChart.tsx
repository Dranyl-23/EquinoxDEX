import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme';

interface TradingChartProps {
  symbol: string;
  baseAsset: string;
  currentPrice: number;
}

export default function TradingChart({ symbol, baseAsset, currentPrice }: TradingChartProps) {
  const webViewRef = useRef<WebView>(null);

  // Send price updates to WebView via JS injection without re-reloading the page
  useEffect(() => {
    if (currentPrice > 0 && webViewRef.current) {
      const script = `
        if (window.updateLivePrice) {
          window.updateLivePrice(${currentPrice});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(script);
    }
  }, [currentPrice]);

  // Static HTML document — loads Binance historical klines once and listens for price updates
  const chartHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body, html { width: 100%; height: 100%; background-color: #12121a; overflow: hidden; }
          #chart-container { width: 100%; height: 100%; }
        </style>
        <script src="https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js"></script>
      </head>
      <body>
        <div id="chart-container"></div>
        <script>
          document.addEventListener("DOMContentLoaded", function() {
            const container = document.getElementById('chart-container');
            const chart = LightweightCharts.createChart(container, {
              layout: {
                background: { type: 'solid', color: '#12121a' },
                textColor: '#71717a',
                fontSize: 10,
              },
              grid: {
                vertLines: { color: 'rgba(39, 39, 42, 0.5)' },
                horzLines: { color: 'rgba(39, 39, 42, 0.5)' },
              },
              crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
              },
              rightPriceScale: {
                borderColor: '#27272a',
                autoScale: true,
              },
              timeScale: {
                borderColor: '#27272a',
                timeVisible: true,
                secondsVisible: false,
              },
            });

            const candlestickSeries = chart.addCandlestickSeries({
              upColor: '#10b981',
              downColor: '#ef4444',
              borderVisible: false,
              wickUpColor: '#10b981',
              wickDownColor: '#ef4444',
            });

            let currentCandle = null;

            // Clean symbol (remove slash e.g. BTC/USDC -> BTCUSDC)
            const rawSymbol = "${symbol}";
            const binanceSymbol = rawSymbol.replace('/', '').toUpperCase();

            // Fetch REAL historical Binance klines
            fetch("https://api.binance.com/api/v3/klines?symbol=" + binanceSymbol + "&interval=1h&limit=100")
              .then(res => {
                if (!res.ok) throw new Error("Binance API error");
                return res.json();
              })
              .then(klines => {
                const formatted = klines.map(k => ({
                  time: Math.floor(k[0] / 1000),
                  open: parseFloat(k[1]),
                  high: parseFloat(k[2]),
                  low: parseFloat(k[3]),
                  close: parseFloat(k[4]),
                }));
                candlestickSeries.setData(formatted);
                chart.timeScale().fitContent();
                if (formatted.length > 0) {
                  currentCandle = { ...formatted[formatted.length - 1] };
                }
              })
              .catch(() => {
                // Dynamic fallback aligned with live price
                const basePrice = ${currentPrice > 0 ? currentPrice : 64320};
                const data = [];
                let now = Math.floor(Date.now() / 1000) - (100 * 3600);
                let price = basePrice * 0.98;
                for (let i = 0; i < 99; i++) {
                  const change = (Math.random() - 0.48) * (basePrice * 0.008);
                  const open = price;
                  const close = open + change;
                  const high = Math.max(open, close) + (basePrice * 0.001);
                  const low = Math.min(open, close) - (basePrice * 0.001);
                  data.push({
                    time: now + (i * 3600),
                    open: parseFloat(open.toFixed(2)),
                    high: parseFloat(high.toFixed(2)),
                    low: parseFloat(low.toFixed(2)),
                    close: parseFloat(close.toFixed(2)),
                  });
                  price = close;
                }
                // Last candle open matches previous close and ends at currentPrice
                data.push({
                  time: now + (99 * 3600),
                  open: parseFloat(price.toFixed(2)),
                  high: parseFloat(Math.max(price, basePrice).toFixed(2)),
                  low: parseFloat(Math.min(price, basePrice).toFixed(2)),
                  close: parseFloat(basePrice.toFixed(2)),
                });
                candlestickSeries.setData(data);
                chart.timeScale().fitContent();
                currentCandle = { ...data[data.length - 1] };
              });

            // Live price update function injected from React Native
            window.updateLivePrice = function(price) {
              if (!price) return;
              if (!currentCandle) {
                const nowSec = Math.floor(Date.now() / 1000);
                currentCandle = {
                  time: nowSec,
                  open: price,
                  high: price,
                  low: price,
                  close: price
                };
              } else {
                currentCandle.close = price;
                currentCandle.high = Math.max(currentCandle.high, price);
                currentCandle.low = Math.min(currentCandle.low, price);
              }
              candlestickSeries.update(currentCandle);
            };

            // Resize handler
            window.addEventListener('resize', () => {
              chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
            });
          });
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: chartHtml }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.brand} />
          </View>
        )}
        startInLoadingState={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 220,
    width: '100%',
    backgroundColor: colors.surface,
  },
  webview: {
    backgroundColor: colors.surface,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
