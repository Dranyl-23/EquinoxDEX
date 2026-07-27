'use client';

import React from 'react';
import { useSettings } from './SettingsProvider';
import { useToast } from './Toast';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSetting, resetSettings } = useSettings();
  const { toast } = useToast();

  if (!isOpen) return null;

  const handleSave = () => {
    toast('Preferences Saved', 'info', 'Your trader preferences have been updated in local storage.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-panel border border-border/80 rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-5 relative overflow-hidden font-sans">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-border/60 pb-3">
          <h3 className="font-bold text-white text-base">Trader Preferences</h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-white font-bold text-sm px-1 cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Preferences List */}
        <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1 text-xs">
          
          <label className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-background/90 border border-border/50 cursor-pointer transition-colors">
            <span className="font-semibold text-white">Persist 24h 1-Click Session Connection</span>
            <input
              type="checkbox"
              checked={settings.persistSession}
              onChange={(e) => updateSetting('persistSession', e.target.checked)}
              className="accent-brand w-4 h-4 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-background/90 border border-border/50 cursor-pointer transition-colors">
            <span className="font-semibold text-white">Skip Open Order Confirmation</span>
            <input
              type="checkbox"
              checked={settings.skipOpenConfirm}
              onChange={(e) => updateSetting('skipOpenConfirm', e.target.checked)}
              className="accent-brand w-4 h-4 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-background/90 border border-border/50 cursor-pointer transition-colors">
            <span className="font-semibold text-white">Skip Close Position Confirmation</span>
            <input
              type="checkbox"
              checked={settings.skipCloseConfirm}
              onChange={(e) => updateSetting('skipCloseConfirm', e.target.checked)}
              className="accent-brand w-4 h-4 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-background/90 border border-border/50 cursor-pointer transition-colors">
            <span className="font-semibold text-white">Show Buy & Sell Executions on Chart</span>
            <input
              type="checkbox"
              checked={settings.showExecutionsOnChart}
              onChange={(e) => updateSetting('showExecutionsOnChart', e.target.checked)}
              className="accent-brand w-4 h-4 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-background/90 border border-border/50 cursor-pointer transition-colors">
            <span className="font-semibold text-white">Animate Real-Time Order Book</span>
            <input
              type="checkbox"
              checked={settings.animateOrderBook}
              onChange={(e) => updateSetting('animateOrderBook', e.target.checked)}
              className="accent-brand w-4 h-4 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-background/90 border border-border/50 cursor-pointer transition-colors">
            <span className="font-semibold text-white">Disable Sound FX for Trade Fills</span>
            <input
              type="checkbox"
              checked={settings.disableFillSounds}
              onChange={(e) => updateSetting('disableFillSounds', e.target.checked)}
              className="accent-brand w-4 h-4 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-background/90 border border-border/50 cursor-pointer transition-colors">
            <span className="font-semibold text-white">Hide PnL & Sensitive Balances</span>
            <input
              type="checkbox"
              checked={settings.hidePnl}
              onChange={(e) => updateSetting('hidePnl', e.target.checked)}
              className="accent-brand w-4 h-4 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-background/90 border border-border/50 cursor-pointer transition-colors">
            <span className="font-semibold text-white">Show All Risk Warnings</span>
            <input
              type="checkbox"
              checked={settings.showAllWarnings}
              onChange={(e) => updateSetting('showAllWarnings', e.target.checked)}
              className="accent-brand w-4 h-4 rounded cursor-pointer"
            />
          </label>

        </div>

        <div className="flex justify-between items-center pt-2 border-t border-border/50">
          <button
            onClick={() => {
              resetSettings();
              toast('Reset to Defaults', 'info', 'Trader settings restored to default values.');
            }}
            className="text-xs text-muted hover:text-white font-mono cursor-pointer"
          >
            Reset Defaults
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-brand hover:bg-brand/90 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Save Preferences
          </button>
        </div>

      </div>
    </div>
  );
};
