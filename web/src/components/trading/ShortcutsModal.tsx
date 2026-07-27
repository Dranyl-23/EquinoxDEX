'use client';
import React from 'react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcutList = [
    { keyCombo: ['Ctrl', 'K'], action: 'Open 200+ Market Selector Search' },
    { keyCombo: ['Shift', 'L'], action: 'Switch Order Direction to LONG' },
    { keyCombo: ['Shift', 'S'], action: 'Switch Order Direction to SHORT' },
    { keyCombo: ['Shift', 'M'], action: 'Select Market Order Tab' },
    { keyCombo: ['Shift', 'O'], action: 'Select Limit Order Tab' },
    { keyCombo: ['Shift', 'C'], action: 'Close Active Position' },
    { keyCombo: ['Shift', '?'], action: 'Toggle Keyboard Shortcuts Cheat Sheet' },
    { keyCombo: ['Esc'], action: 'Dismiss Active Modal / Overlay' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-panel border border-border/80 rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-5 relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-brand/20 blur-3xl rounded-full pointer-events-none" />

        <div className="flex justify-between items-center border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⌨️</span>
            <h3 className="font-bold text-white text-base">Pro Trader Keyboard Shortcuts</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-muted hover:text-white font-bold text-lg px-1 cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {shortcutList.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center px-3 py-2 bg-background/60 rounded-xl border border-border/40 hover:border-brand/40 transition-colors">
              <span className="text-xs text-muted font-medium">{item.action}</span>
              <div className="flex items-center gap-1">
                {item.keyCombo.map((k, kIdx) => (
                  <React.Fragment key={kIdx}>
                    <kbd className="bg-panel border border-border px-2 py-1 rounded text-[11px] font-mono font-bold text-brand shadow-sm">
                      {k}
                    </kbd>
                    {kIdx < item.keyCombo.length - 1 && <span className="text-xs text-muted font-mono">+</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-border/50 text-xs text-muted">
          <span>Press <kbd className="font-mono text-brand">Esc</kbd> to close</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-brand hover:bg-brand/80 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
