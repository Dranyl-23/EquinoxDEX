'use client';
import React from 'react';
import { DECIMALS } from '@/lib/constants';

interface MarketHeaderProps {
  currentPrice: number;
  marketState: { long_oi: number; short_oi: number; global_funding: number; total_volume: number };
  loading?: boolean;
  error?: string | null;
}

export const MarketHeader: React.FC<MarketHeaderProps> = ({ currentPrice, marketState, loading, error }) => {
  const skew = marketState.long_oi - marketState.short_oi;
  const skewDisplay = (skew / DECIMALS).toLocaleString();
  const isSkewLong = skew > 0;
  const isSkewShort = skew < 0;

  return (
    <div className="flex items-center justify-between border-b border-border/50 px-6 py-4 bg-panel/30 backdrop-blur-md z-10">
      <div className="flex items-center gap-4">
        <span className="text-2xl font-bold text-white">BTC-USDC</span>
        {error && currentPrice === 0 ? (
          <span className="text-xs text-danger bg-danger/10 px-2.5 py-1 rounded border border-danger/30 font-medium">
            Price Feed Unavailable
          </span>
        ) : (
          <span className={`text-xl font-mono ${currentPrice > 0 ? 'text-green-500' : 'text-muted animate-pulse'}`}>
            {currentPrice > 0 ? `$${currentPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : loading ? 'Loading...' : '...'}
          </span>
        )}
      </div>
      <div className="text-xs text-muted flex gap-4 bg-background px-3 py-1.5 rounded-lg border border-border">
        <div className="flex flex-col border-r border-border pr-3">
          <span className="text-muted/70 mb-0.5">Total Volume</span>
          <span className="font-mono text-white">${(marketState.total_volume / DECIMALS).toLocaleString()}</span>
        </div>
        <div className="flex flex-col border-r border-border pr-3 pl-1">
          <span className="text-muted/70 mb-0.5">Global Skew</span>
          <span className={`font-mono font-bold ${isSkewLong ? 'text-brand' : isSkewShort ? 'text-danger' : 'text-white'}`}>
            {skew === 0 ? 'Balanced' : `${isSkewLong ? 'Long' : 'Short'} $${Math.abs(Number(skewDisplay))}`}
          </span>
        </div>
        <div className="flex flex-col pl-1">
          <span className="text-muted/70 mb-0.5">Acc. Funding Index</span>
          <span className="font-mono text-white">{marketState.global_funding / DECIMALS} USDC / Unit</span>
        </div>
      </div>
    </div>
  );
};
