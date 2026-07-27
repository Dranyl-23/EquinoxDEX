'use client';
import React from 'react';
import { DECIMALS } from '@/lib/constants';

export interface MarketHeaderProps {
  currentPrice: number;
  marketState: { long_oi: number; short_oi: number; global_funding: number; total_volume: number };
  loading?: boolean;
  error?: string | null;
}

export function MarketHeader({ currentPrice, marketState, loading, error }: MarketHeaderProps) {
  const skew = marketState.long_oi - marketState.short_oi;
  const skewDisplay = (skew / DECIMALS).toLocaleString();
  const isSkewLong = skew > 0;
  const isSkewShort = skew < 0;

  return (
    <div className="flex items-center justify-between border-b border-border/50 px-6 py-4 bg-panel/30 backdrop-blur-md z-10">
      <div className="flex items-center gap-4">
        <span className="text-2xl font-bold text-white flex items-center gap-2">
          BTC-USDC
          <span className="text-[10px] font-mono font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Sub-50ms Engine
          </span>
        </span>
        {error && currentPrice === 0 ? (
          <span className="text-xs text-danger bg-danger/10 px-2.5 py-1 rounded border border-danger/30 font-medium">
            Price Feed Unavailable
          </span>
        ) : (
          <span className={`text-xl font-mono ${currentPrice > 0 ? 'text-green-500 font-bold' : 'text-muted animate-pulse'}`}>
            {currentPrice > 0 ? `$${currentPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : loading ? 'Loading...' : '...'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div>
          <div className="text-muted text-xs">Global Skew</div>
          <div className={`font-medium ${isSkewLong ? 'text-brand' : isSkewShort ? 'text-danger' : 'text-white'}`}>
            {isSkewLong ? `+${skewDisplay} USDC` : `${skewDisplay} USDC`}
          </div>
        </div>

        <div>
          <div className="text-muted text-xs">Global Funding Rate</div>
          <div className="font-medium text-white font-mono">
            {((marketState.global_funding / DECIMALS) * 100).toFixed(4)}% / hr
          </div>
        </div>

        <div>
          <div className="text-muted text-xs">Total Volume</div>
          <div className="font-medium text-white font-mono">
            ${(marketState.total_volume / DECIMALS).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
