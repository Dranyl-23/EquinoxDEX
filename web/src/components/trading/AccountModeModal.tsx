'use client';
import React from 'react';

export type AccountMarginMode = 'cross' | 'isolated' | 'portfolio';

interface AccountModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: AccountMarginMode;
  onSelectMode: (mode: AccountMarginMode) => void;
}

export const AccountModeModal: React.FC<AccountModeModalProps> = ({
  isOpen,
  onClose,
  currentMode,
  onSelectMode,
}) => {
  if (!isOpen) return null;

  const modeOptions = [
    {
      id: 'cross' as const,
      title: 'Smart Cross-Margin (Recommended)',
      badge: 'Default',
      description:
        'Account equity is shared across all active perpetual positions. Perps use settlement collateral jointly to minimize liquidation risk.',
      available: true,
    },
    {
      id: 'isolated' as const,
      title: 'Isolated Risk Margin',
      badge: 'Coming Soon',
      description:
        'Collateral is strictly assigned per individual trade. Liquidation is restricted to the specific trade margin without affecting overall account balance.',
      available: false,
    },
    {
      id: 'portfolio' as const,
      title: 'Multi-Asset Portfolio Collateral',
      badge: 'Coming Soon',
      description:
        'Advanced institutional mode allowing XLM and USDC native Stellar tokens to directly back perpetual positions without manual swapping.',
      available: false,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-panel border border-border/80 rounded-2xl p-6 w-full max-w-lg shadow-2xl flex flex-col gap-5 relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-brand/20 blur-3xl rounded-full pointer-events-none" />

        <div className="flex justify-between items-center border-b border-border/60 pb-3">
          <h3 className="font-bold text-white text-base">Account Margin Mode</h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-white font-bold text-lg px-1 cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {modeOptions.map((opt) => {
            const isSelected = currentMode === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => {
                  if (!opt.available) return;
                  onSelectMode(opt.id);
                  onClose();
                }}
                disabled={!opt.available}
                className={`flex flex-col gap-1.5 p-4 rounded-xl border text-left transition-all relative ${
                  isSelected
                    ? 'bg-brand/10 border-brand text-white shadow-md'
                    : opt.available
                    ? 'bg-background/60 border-border/50 hover:border-brand/40 text-muted hover:text-white'
                    : 'bg-background/30 border-border/20 text-muted/70 cursor-not-allowed'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-brand bg-brand' : 'border-border'}`}>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <span className="font-bold text-xs text-white">{opt.title}</span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${isSelected ? 'bg-brand text-white' : 'bg-border/60 text-muted'}`}>
                    {opt.badge}
                  </span>
                </div>
                <p className="text-[11px] text-muted leading-relaxed pl-5 font-mono">{opt.description}</p>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end pt-2 border-t border-border/50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-brand hover:bg-brand/80 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
          >
            Confirm Mode
          </button>
        </div>
      </div>
    </div>
  );
};
