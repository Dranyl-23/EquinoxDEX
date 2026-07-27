import { NextResponse } from 'next/server';
import { MARKETS } from '@/lib/markets';

export async function GET() {
  const formattedMarkets = MARKETS.map((m) => ({
    symbol: m.symbol,
    name: m.name,
    category: m.category,
    price: m.displayPrice || 65000,
    change24h: m.change24h || 0,
    maxLeverage: m.maxLeverage,
  }));

  return NextResponse.json(
    {
      success: true,
      total: formattedMarkets.length,
      markets: formattedMarkets,
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=5',
      },
    }
  );
}
