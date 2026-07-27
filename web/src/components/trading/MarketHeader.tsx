'use client';
import React, { useState } from 'react';
import { DECIMALS } from '@/lib/constants';

export interface MarketHeaderProps {
  currentPrice: number;
  marketState: { long_oi: number; short_oi: number; global_funding: number; total_volume: number };
  loading?: boolean;
  error?: string | null;
  selectedMarket?: string;
  onSelectMarket?: (market: string) => void;
}

const MARKETS = [
  { id: 'EQX-PERP', name: 'EQX-PERP', badge: 'Flagship Token', icon: '🪐' },
  { id: 'XLM-PERP', name: 'XLM-PERP', badge: 'Stellar Native', icon: '🚀' },
  { id: 'BTC-PERP', name: 'BTC-PERP', badge: 'Cross-Margin', icon: '⚡' },
  { id: 'ETH-PERP', name: 'ETH-PERP', badge: 'Cross-Margin', icon: '💎' },
];

export function MarketHeader({
  currentPrice,
  marketState,
  loading,
  error,
  selectedMarket = 'EQX-PERP',
  onSelectMarket,
}: MarketHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeMarket, setActiveMarket] = useState(selectedMarket);

  const skew = marketState.long_oi - marketState.short_oi;
  const skewDisplay = (skew / DECIMALS).toLocaleString();
  const isSkewLong = skew > 0;
  const isSkewShort = skew < 0;

  const currentObj = MARKETS.find((m) => m.id === activeMarket) || MARKETS[0];

  const handleSelect = (id: string) => {
    setActiveMarket(id);
    setIsOpen(false);
    if (onSelectMarket) onSelectMarket(id);
  };

  return (
    <div className="flex items-center justify-between border-b border-border/50 px-6 py-4 bg-panel/30 backdrop-blur-md z-30 relative">
      <div className="flex items-center gap-4">
        {/* Interactive Market Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 text-2xl font-bold text-white hover:text-brand transition-colors focus:outline-none"
          >
            <span>{currentObj.icon}</span>
            <span>{currentObj.name}</span>
            <span className="text-xs text-muted">▼</span>
            <span className="text-[10px] font-mono font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {currentObj.badge}
            </span>
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-panel/95 backdrop-blur-xl border border-border/60 rounded-lg shadow-2xl z-50 p-1.5 flex flex-col gap-1 animate-fadeIn">
              <div className="text-[10px] font-semibold text-muted px-2 py-1 uppercase tracking-wider">
                Select Market
              </div>
              {MARKETS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleSelect(m.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors text-left ${
                    activeMarket === m.id
                      ? 'bg-brand/20 text-brand border border-brand/30'
                      : 'text-white hover:bg-border/40'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{m.icon}</span>
                    <span className="font-bold">{m.name}</span>
                  </span>
                  <span className="text-[10px] text-muted font-mono">{m.badge}</span>
                </button>
              ))}
            </div>
          )}
        </div>

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
