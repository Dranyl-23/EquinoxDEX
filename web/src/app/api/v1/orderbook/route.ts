import { NextRequest, NextResponse } from 'next/server';
import { MARKETS } from '@/lib/markets';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol')?.toUpperCase() || 'BTCUSDT';
  const market = MARKETS.find((m) => m.symbol === symbol) || MARKETS[0];
  const midPrice = market.displayPrice || 65000;

  // Generate real-time synthetic orderbook depth around midPrice
  const bids = Array.from({ length: 8 }).map((_, i) => {
    const price = Number((midPrice * (1 - (i + 1) * 0.0004)).toFixed(2));
    const amount = Number((Math.random() * 1.5 + 0.1).toFixed(4));
    return { price, amount, total: Number((price * amount).toFixed(2)) };
  });

  const asks = Array.from({ length: 8 }).map((_, i) => {
    const price = Number((midPrice * (1 + (i + 1) * 0.0004)).toFixed(2));
    const amount = Number((Math.random() * 1.5 + 0.1).toFixed(4));
    return { price, amount, total: Number((price * amount).toFixed(2)) };
  });

  return NextResponse.json(
    {
      symbol,
      midPrice,
      bids,
      asks,
      timestamp: Date.now(),
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    }
  );
}
