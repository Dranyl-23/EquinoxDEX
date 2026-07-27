'use client';

import React from 'react';
import { useLanguage, SupportedLanguage } from './LanguageProvider';

export interface LanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LANGUAGES: { code: SupportedLanguage; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'ceb', name: 'Cebuano / Bisaya' },
  { code: 'zh', name: '简体中文' },
  { code: 'ko', name: '한국어' },
  { code: 'ja', name: '日本語' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'tr', name: 'Türkçe' },
];

export const NUMBER_FORMATS = [
  '1,234.56',
  '1.234,56',
  '1234,56',
  '1 234,56',
];

export const LanguageModal: React.FC<LanguageModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { language, setLanguage, numberFormat, setNumberFormat } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-panel border border-border/80 rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-5 relative overflow-hidden font-sans">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-border/60 pb-3">
          <h3 className="font-bold text-white text-base">Language & Format</h3>
          <button
            onClick={onClose}
            className="text-muted hover:text-white font-bold text-sm px-1 cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Number Formatting Section */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-mono font-bold text-muted uppercase tracking-wider">
            Number Formatting
          </label>
          <div className="grid grid-cols-2 gap-2">
            {NUMBER_FORMATS.map((fmt) => (
              <button
                key={fmt}
                onClick={() => setNumberFormat(fmt)}
                className={`py-2 px-3 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer text-center ${
                  numberFormat === fmt
                    ? 'bg-brand/20 border-brand text-brand shadow-sm'
                    : 'bg-background/60 border-border/60 text-muted hover:text-white hover:border-border'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        {/* Language Selection (10 Languages) */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-mono font-bold text-muted uppercase tracking-wider">
            Supported Languages (10)
          </label>
          <div className="flex flex-col gap-1 max-h-60 overflow-y-auto pr-1">
            {LANGUAGES.map((lang) => {
              const isSelected = language === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                  }}
                  className={`flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-brand text-white font-bold shadow-md'
                      : 'text-muted hover:text-white hover:bg-background/80'
                  }`}
                >
                  <span>{lang.name}</span>
                  {isSelected && <span className="text-xs font-bold font-mono">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-border/50">
          <button
            onClick={() => {
              setLanguage('en');
              setNumberFormat('1,234.56');
            }}
            className="text-xs text-muted hover:text-white font-mono cursor-pointer"
          >
            Reset Defaults
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-brand hover:bg-brand/90 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
