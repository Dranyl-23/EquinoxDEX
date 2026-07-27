'use client';
import React, { useState, useEffect } from 'react';
import { MARKETS, MarketInfo } from '@/lib/markets';

interface MarketSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMarket: (market: MarketInfo) => void;
  currentSymbol: string;
}

export const MarketSelectorModal: React.FC<MarketSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectMarket,
  currentSymbol,
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  // Keyboard shortcut Ctrl+K / Cmd+K to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = ['All', 'Top', 'Layer 1', 'Memes', 'AI', 'DeFi', 'RWA'];

  const filteredMarkets = MARKETS.filter((m) => {
    const matchesSearch =
      m.symbol.toLowerCase().includes(search.toLowerCase()) ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.baseAsset.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      activeCategory === 'All' || m.category === activeCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-panel border border-border/80 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="p-4 border-b border-border/60 flex flex-col gap-3 bg-panel/50">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌐</span>
              <h2 className="font-bold text-white text-base sm:text-lg tracking-tight whitespace-nowrap">Select Market</h2>
              <span className="text-[10px] sm:text-xs font-mono bg-brand/20 text-brand px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                {MARKETS.length} Pairs
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden sm:inline-block text-[11px] text-muted font-mono bg-background px-2 py-1 rounded border border-border/60 whitespace-nowrap">
                <kbd>Ctrl</kbd> + <kbd>K</kbd>
              </span>
              <button 
                onClick={onClose}
                className="text-muted hover:text-white font-bold p-1 hover:bg-panel rounded-md transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full">
            <input
              type="text"
              autoFocus
              placeholder="Search by market name, symbol (e.g. BTC, PEPE, SOL)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border border-border/80 rounded-xl px-4 py-2.5 pl-10 text-sm text-white focus:outline-none focus:border-brand font-mono shadow-inner"
            />
            <svg
              className="w-4 h-4 text-muted absolute left-3.5 top-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeCategory === cat
                    ? 'bg-brand text-white font-bold shadow-md shadow-brand/20'
                    : 'bg-background/60 text-muted hover:text-white hover:bg-background'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Markets Table List */}
        <div className="flex-1 overflow-y-auto p-2">
          {filteredMarkets.length === 0 ? (
            <div className="py-16 text-center text-muted text-sm font-mono">
              No markets found matching &quot;{search}&quot;.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {filteredMarkets.map((market) => {
                const isSelected = market.symbol === currentSymbol;
                const change = market.change24h || 0;
                const isPos = change >= 0;

                return (
                  <button
                    key={market.symbol}
                    onClick={() => {
                      onSelectMarket(market);
                      onClose();
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-brand/15 border-brand text-white font-semibold shadow-md'
                        : 'bg-panel/40 border-border/40 hover:bg-panel hover:border-border/80 text-muted hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-background border border-border/60 flex items-center justify-center font-bold text-xs font-mono text-white">
                        {market.baseAsset.slice(0, 3)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm font-mono">{market.baseAsset}</span>
                          <span className="text-[10px] text-muted font-sans font-medium bg-background/80 px-1.5 py-0.5 rounded">
                            {market.quoteAsset}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted truncate max-w-[120px] block">
                          {market.name}
                        </span>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-xs font-semibold text-white">
                        Up to {market.maxLeverage}x
                      </div>
                      <span
                        className={`text-xs font-bold ${
                          isPos ? 'text-brand' : 'text-danger'
                        }`}
                      >
                        {isPos ? '+' : ''}
                        {change.toFixed(2)}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border/60 bg-panel/80 text-center text-xs text-muted font-mono flex justify-between items-center px-4">
          <span>EquinoxDEX Multi-Market Engine</span>
          <span className="text-brand font-semibold">200+ Perpetual Pairs Live</span>
        </div>
      </div>
    </div>
  );
};
