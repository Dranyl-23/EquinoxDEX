'use client';
import React, { useState } from 'react';
import { DECIMALS } from '@/lib/constants';
import { useLanguage } from '../LanguageProvider';

export interface MarketHeaderProps {
  currentPrice: number;
  marketState: { long_oi: number; short_oi: number; global_funding: number; total_volume: number };
  loading?: boolean;
  error?: string | null;
  selectedMarket?: string;
  onSelectMarket?: (market: string) => void;
  onOpenMarketModal?: () => void;
  onOpenShortcutsModal?: () => void;
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
  onOpenMarketModal,
  onOpenShortcutsModal,
}: MarketHeaderProps) {
  const { t, formatNum } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [activeMarket, setActiveMarket] = useState(selectedMarket);

  const skew = marketState.long_oi - marketState.short_oi;
  const skewDisplay = (skew / DECIMALS).toLocaleString();
  const isSkewLong = skew > 0;
  const isSkewShort = skew < 0;

  const currentObj = MARKETS.find((m) => m.id === (selectedMarket || activeMarket)) || MARKETS[0];

  const handleSelect = (id: string) => {
    setActiveMarket(id);
    setIsOpen(false);
    if (onSelectMarket) onSelectMarket(id);
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center items-start justify-between border-b border-border/50 px-4 md:px-6 py-4 bg-panel/30 backdrop-blur-md z-30 relative gap-4">
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full md:w-auto justify-between md:justify-start">
        {/* App Logo */}
        <div className="flex items-center gap-2 mr-1 sm:mr-3">
          <img src="/equinox_logo.png" alt="Equinox DEX" className="w-10 h-10 mix-blend-screen rounded-xl" />
          <span className="font-bold text-white text-xl tracking-tight hidden lg:block">Equinox</span>
        </div>

        {/* Interactive Market Selector Dropdown */}
        <button
          onClick={onOpenMarketModal || (() => setIsOpen(!isOpen))}
          className="flex items-center gap-2 sm:gap-3 text-lg md:text-xl font-bold text-white hover:text-brand transition-colors focus:outline-none bg-panel/40 hover:bg-panel border border-border/60 hover:border-brand px-2 sm:px-3 py-1.5 rounded-xl shadow-xs cursor-pointer transition-all"
          title="Click or press Ctrl+K to select from 200+ Markets"
        >
          <TokenLogo id={currentObj.id} />
          <span>{selectedMarket || currentObj.name}</span>
          <span className="text-xs text-muted">▼</span>
          <span className="text-[10px] font-mono font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded hidden sm:flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            200+ Markets
          </span>
        </button>

        {error && currentPrice === 0 ? (
          <span className="text-xs text-danger bg-danger/10 px-2.5 py-1 rounded border border-danger/30 font-medium">
            Price Feed Unavailable
          </span>
        ) : (
          <span className={`text-lg md:text-xl font-mono ${currentPrice > 0 ? 'text-green-500 font-bold' : 'text-muted animate-pulse'}`}>
            {currentPrice > 0 ? `$${currentPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : loading ? 'Loading...' : '...'}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 md:gap-6 text-sm w-full md:w-auto border-t md:border-none border-border/50 pt-3 md:pt-0">
        <div>
          <div className="text-muted text-xs">{t('openInterest') || 'Global Skew'}</div>
          <div className={`font-medium ${isSkewLong ? 'text-brand' : isSkewShort ? 'text-danger' : 'text-white'}`}>
            {isSkewLong ? `+${skewDisplay} USDC` : `${skewDisplay} USDC`}
          </div>
        </div>

        <div>
          <div className="text-muted text-xs">{t('fundingRate') || 'Global Funding Rate'}</div>
          <div className="font-medium text-white font-mono">
            {((marketState.global_funding / DECIMALS) * 100).toFixed(4)}% / hr
          </div>
        </div>

        <div>
          <div className="text-muted text-xs">{t('volume24h') || 'Total Volume'}</div>
          <div className="font-medium text-white font-mono">
            ${formatNum(marketState.total_volume / DECIMALS)}
          </div>
        </div>

        <button
          onClick={onOpenShortcutsModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-panel/60 hover:bg-panel border border-border/60 hover:border-brand text-xs font-semibold text-white transition-all cursor-pointer shadow-xs"
          title="Press Shift+? for Pro Hotkeys"
        >
          <span>Shortcuts</span>
        </button>
      </div>
    </div>
  );
}
