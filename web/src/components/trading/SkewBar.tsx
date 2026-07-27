'use client';
import React from 'react';

interface SkewBarProps {
  totalLongOi: number;
  totalShortOi: number;
}

export const SkewBar: React.FC<SkewBarProps> = ({ totalLongOi, totalShortOi }) => {
  const total = totalLongOi + totalShortOi;
  const longPct = total > 0 ? (totalLongOi / total) * 100 : 50;
  const shortPct = total > 0 ? (totalShortOi / total) * 100 : 50;

  return (
    <div className="bg-panel/40 border border-border/60 rounded-lg p-2.5 flex flex-col gap-1.5 shadow-sm text-xs select-none">
      <div className="flex justify-between items-center font-mono">
        <span className="text-brand font-bold flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-brand"></span>
          Longs {longPct.toFixed(1)}%
        </span>
        <span className="text-muted text-[10px] tracking-wider uppercase font-sans font-medium">Market Skew & Open Interest</span>
        <span className="text-danger font-bold flex items-center gap-1">
          Shorts {shortPct.toFixed(1)}%
          <span className="w-2 h-2 rounded-full bg-danger"></span>
        </span>
      </div>

      {/* Progress Bar Container */}
      <div className="w-full h-2 bg-background rounded-full overflow-hidden flex border border-border/40 shadow-inner">
        <div 
          className="h-full bg-gradient-to-r from-brand to-emerald-400 transition-all duration-500" 
          style={{ width: `${longPct}%` }}
        />
        <div 
          className="h-full bg-gradient-to-r from-rose-500 to-danger transition-all duration-500" 
          style={{ width: `${shortPct}%` }}
        />
      </div>
    </div>
  );
};
