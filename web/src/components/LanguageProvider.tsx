'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { loadTranslations, DEFAULT_LANGUAGE } from '@/i18n';
import enTranslations from '@/i18n/en';

export type SupportedLanguage = 'en' | 'ceb' | 'zh' | 'ko' | 'ja' | 'es' | 'fr' | 'de' | 'vi' | 'tr';

export interface Translations {
  // Nav
  trade: string;
  portfolio: string;
  vaults: string;
  history: string;
  rewards: string;
  leaderboard: string;
  apiSdk: string;
  docs: string;
  ecosystem: string;
  developerSuite: string;
  systemWhitepaper: string;
  onChainExplorer: string;
  securityInfra: string;
  sessionKeys: string;
  contractSource: string;
  growthRankings: string;

  // Market Header
  markPrice: string;
  oraclePrice: string;
  change24h: string;
  volume24h: string;
  openInterest: string;
  fundingRate: string;

  // Order Form
  placeOrder: string;
  buyLong: string;
  sellShort: string;
  market: string;
  limit: string;
  stopMarket: string;
  stopLimit: string;
  margin: string;
  leverage: string;
  priceImpact: string;
  maxSlippage: string;
  deposit: string;
  withdraw: string;
  availableToTrade: string;
  currentPosition: string;
  stopTriggerPrice: string;
  limitPrice: string;

  // Positions Table
  positions: string;
  openOrders: string;
  tradeHistory: string;
  entryPrice: string;
  liqPrice: string;
  pnl: string;
  action: string;
  closePosition: string;
  editTpSl: string;
  sharePnl: string;
  cancelOrder: string;

  // Orderbook
  orderBook: string;
  trades: string;
  priceUsdc: string;
  size: string;
  total: string;
  spread: string;

  // Portfolio / Vaults
  liquidityVault: string;
  totalValueLocked: string;
  estimatedApr: string;
  totalSharesMinted: string;
  yourPoolShare: string;
  yourStakedBalance: string;
  depositUsdc: string;
  withdrawUsdc: string;
  stakingYield: string;
  elpPrice: string;
  dailyYield: string;
  redeemShares: string;

  // Rewards
  referralProgram: string;
  unclaimedKickback: string;
  lifetimeEarnings: string;
  referredTraders: string;
  tradingVolume30d: string;
  vipTier: string;
  feeDiscount: string;
  copyReferralLink: string;
  claimRewards: string;

  // Leaderboard
  rank: string;
  trader: string;
  realizedPnl: string;
  winRate: string;
  totalTrades: string;
  yourRank: string;

  // History
  tradeLog: string;
  exitPrice: string;
  feePaid: string;
  txHash: string;
  filterByMarket: string;
  allMarkets: string;

  // General
  connectWallet: string;
  noDataYet: string;
  loading: string;
  settings: string;
  language: string;
}


interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  numberFormat: string;
  setNumberFormat: (fmt: string) => void;
  t: (key: keyof Translations) => string;
  formatNum: (val: number, decimals?: number) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);
  const [translations, setTranslations] = useState<Partial<Translations>>(enTranslations);
  const [numberFormat, setNumberFormat] = useState<string>('1,234.56');

  useEffect(() => {
    let active = true;
    loadTranslations(language).then((dict) => {
      if (active) setTranslations(dict);
    }).catch(() => {
      if (active) setTranslations(enTranslations);
    });
    return () => { active = false; };
  }, [language]);

  const t = useCallback(
    (key: keyof Translations) => translations[key] || key,
    [translations]
  );

  const formatNum = useCallback(
    (val: number, decimals: number = 2) => {
      if (isNaN(val)) return '0.00';
      const fixed = val.toFixed(decimals);
      const [intPart, decPart] = fixed.split('.');

      let formattedInt = intPart;
      if (numberFormat === '1,234.56') {
        formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
      } else if (numberFormat === '1.234,56') {
        formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return decPart !== undefined ? `${formattedInt},${decPart}` : formattedInt;
      } else if (numberFormat === '1234,56') {
        return decPart !== undefined ? `${intPart},${decPart}` : intPart;
      } else if (numberFormat === '1 234,56') {
        formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return decPart !== undefined ? `${formattedInt},${decPart}` : formattedInt;
      }

      return fixed;
    },
    [numberFormat]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, numberFormat, setNumberFormat, t, formatNum }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
