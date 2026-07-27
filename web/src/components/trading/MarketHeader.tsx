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

const TokenLogo = ({ id }: { id: string }) => {
  if (id === 'EQX-PERP') {
    return (
      <div className="w-7 h-7 rounded-full bg-linear-to-tr from-purple-600 via-indigo-500 to-cyan-400 p-[1.5px] shadow-lg shadow-purple-500/30 flex items-center justify-center">
        <div className="w-full h-full rounded-full bg-panel flex items-center justify-center font-bold text-xs text-transparent bg-clip-text bg-linear-to-r from-purple-400 to-cyan-300">
          EQX
        </div>
      </div>
    );
  }
  if (id === 'XLM-PERP') {
    return (
      <div className="w-7 h-7 rounded-full bg-linear-to-tr from-cyan-500 to-blue-600 p-[1.5px] shadow-lg shadow-cyan-500/30 flex items-center justify-center">
        <div className="w-full h-full rounded-full bg-panel flex items-center justify-center font-extrabold text-[11px] text-cyan-300">
          ★
        </div>
      </div>
    );
  }
  if (id === 'BTC-PERP') {
    return (
      <div className="w-7 h-7 rounded-full bg-amber-500 text-black font-black flex items-center justify-center text-sm shadow-lg shadow-amber-500/30">
        ₿
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-linear-to-tr from-indigo-500 to-purple-400 text-white font-bold flex items-center justify-center text-xs shadow-lg shadow-indigo-500/30">
      Ξ
    </div>
  );
};

const MARKETS = [
  { id: 'EQX-PERP', name: 'EQX-PERP', badge: 'Flagship Token' },
  { id: 'XLM-PERP', name: 'XLM-PERP', badge: 'Stellar Native' },
  { id: 'BTC-PERP', name: 'BTC-PERP', badge: 'Cross-Margin' },
  { id: 'ETH-PERP', name: 'ETH-PERP', badge: 'Cross-Margin' },
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
            className="flex items-center gap-2.5 text-2xl font-bold text-white hover:text-brand transition-colors focus:outline-none"
          >
            <TokenLogo id={currentObj.id} />
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
                  <span className="flex items-center gap-2.5">
                    <TokenLogo id={m.id} />
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
