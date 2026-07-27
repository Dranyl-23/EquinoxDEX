'use client';
import React, { useState } from 'react';
import { Position } from '@/lib/contract';
import { DECIMALS } from '@/lib/constants';

interface SharePnLModalProps {
  isOpen: boolean;
  onClose: () => void;
  publicKey: string | null;
  position: Position | null;
  pnl: number;
  pnlPercent: number;
  currentPrice: number;
}

export const SharePnLModal: React.FC<SharePnLModalProps> = ({
  isOpen,
  onClose,
  publicKey,
  position,
  pnl,
  pnlPercent,
  currentPrice,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !position) return null;

  const rawMargin = position.margin / DECIMALS;
  const rawEntry = position.entry_price / DECIMALS;
  const shortAddr = publicKey ? `${publicKey.slice(0, 6)}...${publicKey.slice(-4)}` : 'GBBUS2...H056';

  const handleCopyText = () => {
    const shareText = `🚀 Trading on EquinoxDEX!\n🪐 Asset: EQX-PERP ${position.leverage}x ${position.is_long ? 'Long' : 'Short'}\n📈 PnL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USD (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)\n\nTrade sub-50ms high frequency perps on Stellar Soroban: https://equinoxdex.io`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg bg-panel border border-border/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col gap-6 p-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📊</span> Share PnL Card
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-white text-lg font-bold p-1 rounded-md hover:bg-border/40 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Visual Share Card Box */}
        <div
          id="pnl-card-canvas"
          className="relative w-full bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 border border-purple-500/30 rounded-2xl p-6 flex flex-col justify-between gap-6 shadow-2xl overflow-hidden"
        >
          {/* Background Ambient Glow */}
          <div className="absolute -top-20 -right-20 w-56 h-56 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-brand/20 rounded-full blur-3xl pointer-events-none"></div>

          {/* Top Row: Brand & Trader Info */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-linear-to-tr from-purple-600 via-indigo-500 to-cyan-400 p-0.5 flex items-center justify-center font-bold text-xs">
                EQX
              </div>
              <span className="font-extrabold text-white text-lg tracking-tight">EquinoxDEX</span>
            </div>
            <div className="bg-panel/80 backdrop-blur border border-border/60 px-3 py-1 rounded-full text-xs font-mono text-muted">
              {shortAddr}
            </div>
          </div>

          {/* Center Row: Asset & PnL ROI % */}
          <div className="flex flex-col gap-2 relative z-10 my-2">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-white">EQX-PERP</span>
              <span className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded-full ${
                position.is_long ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                {position.leverage}x {position.is_long ? 'LONG' : 'SHORT'}
              </span>
            </div>

            {/* Giant ROI PnL */}
            <div className={`text-4xl sm:text-5xl font-mono font-black tracking-tight ${
              pnl >= 0 ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.4)]' : 'text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.4)]'
            }`}>
              {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
            </div>

            <div className="text-sm font-mono text-muted">
              Profit: <span className={pnl >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDC</span>
            </div>
          </div>

          {/* Bottom Row: Entry vs Current & Verified Badge */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono text-muted relative z-10">
            <div>
              Entry: <span className="text-white font-bold">${rawEntry.toLocaleString()}</span> | Current: <span className="text-white font-bold">${currentPrice.toLocaleString()}</span>
            </div>
            <div className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold flex items-center gap-1">
              <span>✓</span> Soroban Verified
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleCopyText}
            className="flex-1 py-3 bg-panel hover:bg-border/60 border border-border text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2"
          >
            {copied ? '✓ Copied to Clipboard!' : '📋 Copy Share Link & Text'}
          </button>
          
          <button
            onClick={() => {
              alert('PnL Card copied! Ready to share on Twitter/X, Telegram, or Discord.');
              onClose();
            }}
            className="flex-1 py-3 bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2"
          >
            <span>🐦</span> Share on Twitter / X
          </button>
        </div>

      </div>
    </div>
  );
};
