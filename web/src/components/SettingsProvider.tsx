'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface TraderSettings {
  persistSession: boolean;
  skipOpenConfirm: boolean;
  skipCloseConfirm: boolean;
  showExecutionsOnChart: boolean;
  animateOrderBook: boolean;
  disableFillSounds: boolean;
  hidePnl: boolean;
  showAllWarnings: boolean;
}

const DEFAULT_SETTINGS: TraderSettings = {
  persistSession: true,
  skipOpenConfirm: false,
  skipCloseConfirm: false,
  showExecutionsOnChart: true,
  animateOrderBook: true,
  disableFillSounds: false,
  hidePnl: false,
  showAllWarnings: true,
};

interface SettingsContextType {
  settings: TraderSettings;
  updateSetting: <K extends keyof TraderSettings>(key: K, value: TraderSettings[K]) => void;
  updateAllSettings: (newSettings: TraderSettings) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'equinox_trader_settings_v1';

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<TraderSettings>(DEFAULT_SETTINGS);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      }
    } catch {}
  }, []);

  // Save settings to localStorage on change
  const saveToStorage = (newSettings: TraderSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch {}
  };

  const updateSetting = useCallback(<K extends keyof TraderSettings>(key: K, value: TraderSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveToStorage(next);
      return next;
    });
  }, []);

  const updateAllSettings = useCallback((newSettings: TraderSettings) => {
    setSettings(newSettings);
    saveToStorage(newSettings);
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    saveToStorage(DEFAULT_SETTINGS);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, updateAllSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
