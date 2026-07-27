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
      <svg className="w-8 h-8 drop-shadow-[0_0_12px_rgba(168,85,247,0.6)]" viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="eqxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="50%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="11" fill="url(#eqxGrad)" />
        <ellipse cx="16" cy="16" rx="14" ry="5" fill="none" stroke="url(#ringGrad)" strokeWidth="2" transform="rotate(-25 16 16)" />
        <path d="M11 11h9v2.2h-6.5v2.6h5.5v2.2h-5.5v2.8H20V23h-9V11z" fill="#ffffff" />
      </svg>
    );
  }
  if (id === 'XLM-PERP') {
    return (
      <svg className="w-8 h-8 drop-shadow-[0_0_12px_rgba(56,189,248,0.6)]" viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="xlmGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="13" fill="url(#xlmGrad)" />
        <path d="M16 5l2.8 7.2L26 15l-7.2 2.8L16 25l-2.8-7.2L6 15l7.2-2.8L16 5z" fill="#ffffff" />
      </svg>
    );
  }
  if (id === 'BTC-PERP') {
    return (
      <svg className="w-8 h-8 drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]" viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="btcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="13" fill="url(#btcGrad)" />
        <path d="M20.5 13.5c.4-1.2 0-2.2-1.2-2.7l.5-2.1-1.3-.3-.5 2.1c-.3-.1-.7-.2-1-.3l.5-2.1-1.3-.3-.5 2.1-2.8-.7-.4 1.6s.9.2.9.2c.5.1.6.4.5.7l-1.3 5.2c-.1.2-.3.4-.6.3 0 0-.9-.2-.9-.2l-.6 1.5 2.7.7c.5.1 1 .3 1.5.4l-.5 2.2 1.3.3.5-2.1c.4.1.7.2 1.1.3l-.5 2.1 1.3.3.5-2.1c2.1.4 3.7.2 4.3-1.6.5-1.5.1-2.4-.9-3 1-.3 1.6-1.1 1.4-2.4zm-2.4 4.7c-.4 1.5-3 .7-3.8.5l.7-2.7c.9.2 3.5.7 3.1 2.2zm.4-4.8c-.3 1.4-2.5.7-3.2.5l.6-2.5c.7.2 2.9.6 2.6 2z" fill="#ffffff" />
      </svg>
    );
  }
  return (
    <svg className="w-8 h-8 drop-shadow-[0_0_12px_rgba(129,140,248,0.6)]" viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="ethGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="13" fill="url(#ethGrad)" />
      <path d="M16 6l-7 11.5L16 21l7-3.5L16 6z" fill="#e0e7ff" opacity="0.9" />
      <path d="M16 6l7 11.5L16 21V6z" fill="#ffffff" />
      <path d="M16 22.5l-7-4 7 7.5 7-7.5-7 4z" fill="#c7d2fe" />
    </svg>
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
            className="flex items-center gap-3 text-2xl font-bold text-white hover:text-brand transition-colors focus:outline-none"
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
            <div className="absolute top-full left-0 mt-2 w-64 bg-panel/95 backdrop-blur-xl border border-border/60 rounded-lg shadow-2xl z-50 p-2 flex flex-col gap-1 animate-fadeIn">
              <div className="text-[10px] font-semibold text-muted px-2 py-1 uppercase tracking-wider">
                Select Market
              </div>
              {MARKETS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleSelect(m.id)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-all text-left ${
                    activeMarket === m.id
                      ? 'bg-brand/20 text-brand border border-brand/30 shadow-md'
                      : 'text-white hover:bg-border/40'
                  }`}
                >
                  <span className="flex items-center gap-3">
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
