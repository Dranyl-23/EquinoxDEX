'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, BellOff, ChevronDown, Globe, Settings } from 'lucide-react';
import { useWalletContext } from './WalletProvider';
import ConnectWallet from './ConnectWallet';
import { contractConfigured } from '@/lib/contract';
import { requestNotificationPermission, isNotificationGranted, sendDesktopNotification } from '@/lib/notifications';
import { LanguageModal } from './LanguageModal';
import { SettingsModal } from './SettingsModal';
import { useLanguage } from './LanguageProvider';

export default function Navbar() {
  const wallet = useWalletContext();
  const pathname = usePathname();
  const [notifGranted, setNotifGranted] = useState<boolean>(false);
  const [showEcosystem, setShowEcosystem] = useState<boolean>(false);
  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [currentNumberFormat, setCurrentNumberFormat] = useState<string>('1,234.56');

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotifGranted(isNotificationGranted());
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowEcosystem(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleNotif = async () => {
    if (!notifGranted) {
      const granted = await requestNotificationPermission();
      setNotifGranted(granted);
      if (granted) {
        sendDesktopNotification('EquinoxDEX Alerts Active', 'Desktop notifications enabled for order execution & TP/SL triggers!');
      }
    } else {
      sendDesktopNotification('Test Notification', 'EquinoxDEX desktop alert system is working perfectly!');
    }
  };

  const isEcosystemActive = pathname === '/api-docs' || pathname === '/docs' || pathname === '/rewards' || pathname === '/leaderboard';

  const { t } = useLanguage();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-panel px-4 relative z-40">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-xl font-bold tracking-tight text-white hover:text-brand transition-colors">
          EquinoxDEX
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-muted">
          <Link 
            href="/" 
            className={`hover:text-white transition-colors ${pathname === '/' ? 'text-white font-bold' : ''}`}
          >
            {t('trade')}
          </Link>
          <Link 
            href="/portfolio" 
            className={`hover:text-white transition-colors ${pathname === '/portfolio' ? 'text-white font-bold' : ''}`}
          >
            {t('portfolio')}
          </Link>
          <Link 
            href="/vaults" 
            className={`hover:text-white transition-colors ${pathname === '/vaults' ? 'text-white font-bold' : ''}`}
          >
            {t('vaults')}
          </Link>
          <Link 
            href="/history" 
            className={`hover:text-white transition-colors ${pathname === '/history' ? 'text-white font-bold' : ''}`}
          >
            {t('history')}
          </Link>

          {/* Equinox Ecosystem Institutional Mega-Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowEcosystem((prev) => !prev)}
              className={`flex items-center gap-1 hover:text-white transition-colors py-1 cursor-pointer font-semibold ${
                isEcosystemActive ? 'text-brand font-bold' : 'text-muted'
              }`}
            >
              <span>{t('ecosystem')}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showEcosystem ? 'rotate-180 text-brand' : ''}`} />
            </button>

            {showEcosystem && (
              <div className="absolute left-0 top-full mt-2 w-[540px] bg-panel/95 border border-border/80 rounded-2xl shadow-2xl backdrop-blur-2xl p-5 z-50 animate-fade-in grid grid-cols-3 gap-4">
                
                {/* Column 1: Developer Suite */}
                <div className="flex flex-col gap-2">
                  <div className="text-[11px] font-mono uppercase font-bold text-emerald-400 tracking-wider border-b border-border/60 pb-1.5">
                    Developer Suite
                  </div>
                  <Link
                    href="/api-docs"
                    onClick={() => setShowEcosystem(false)}
                    className="flex flex-col p-2 rounded-lg hover:bg-background/80 transition-colors group"
                  >
                    <span className="text-xs font-bold text-white group-hover:text-brand transition-colors">API & Client SDK</span>
                    <span className="text-[10px] text-muted">REST & TS SDK Docs</span>
                  </Link>
                  <Link
                    href="/docs"
                    onClick={() => setShowEcosystem(false)}
                    className="flex flex-col p-2 rounded-lg hover:bg-background/80 transition-colors group"
                  >
                    <span className="text-xs font-bold text-white group-hover:text-brand transition-colors">System Whitepaper</span>
                    <span className="text-[10px] text-muted">Soroban Specs & Math</span>
                  </Link>
                  <a
                    href="https://stellar.expert/explorer/testnet"
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setShowEcosystem(false)}
                    className="flex flex-col p-2 rounded-lg hover:bg-background/80 transition-colors group"
                  >
                    <span className="text-xs font-bold text-white group-hover:text-brand transition-colors">On-Chain Explorer</span>
                    <span className="text-[10px] text-muted">StellarExpert Audit</span>
                  </a>
                </div>

                {/* Column 2: Security & Infra */}
                <div className="flex flex-col gap-2">
                  <div className="text-[11px] font-mono uppercase font-bold text-cyan-400 tracking-wider border-b border-border/60 pb-1.5">
                    Security & Infra
                  </div>
                  <div className="flex flex-col p-2 rounded-lg bg-background/40">
                    <span className="text-xs font-bold text-white">1-Click Session Keys</span>
                    <span className="text-[10px] text-muted">Ephemeral ED25519 Auth</span>
                  </div>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col p-2 rounded-lg hover:bg-background/80 transition-colors group"
                  >
                    <span className="text-xs font-bold text-white group-hover:text-brand transition-colors">Contract Source</span>
                    <span className="text-[10px] text-muted">Soroban Rust Codebase</span>
                  </a>
                </div>

                {/* Column 3: Growth & Rankings */}
                <div className="flex flex-col gap-2">
                  <div className="text-[11px] font-mono uppercase font-bold text-brand tracking-wider border-b border-border/60 pb-1.5">
                    Growth & Rankings
                  </div>
                  <Link
                    href="/rewards"
                    onClick={() => setShowEcosystem(false)}
                    className="flex flex-col p-2 rounded-lg hover:bg-background/80 transition-colors group"
                  >
                    <span className="text-xs font-bold text-white group-hover:text-brand transition-colors">Rewards & Discounts</span>
                    <span className="text-[10px] text-muted">Fee Rebates & Referrals</span>
                  </Link>
                  <Link
                    href="/leaderboard"
                    onClick={() => setShowEcosystem(false)}
                    className="flex flex-col p-2 rounded-lg hover:bg-background/80 transition-colors group"
                  >
                    <span className="text-xs font-bold text-white group-hover:text-brand transition-colors">Trader Leaderboard</span>
                    <span className="text-[10px] text-muted">On-Chain PnL Standings</span>
                  </Link>
                </div>

              </div>
            )}
          </div>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleToggleNotif}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
            notifGranted
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-panel/80 border-border/80 text-muted hover:text-white hover:border-brand'
          }`}
          title={notifGranted ? 'Browser Desktop Alerts Active' : 'Click to Enable Browser Desktop Alerts'}
        >
          {notifGranted ? <Bell className="w-3.5 h-3.5 text-emerald-400" /> : <BellOff className="w-3.5 h-3.5 text-muted" />}
          <span>{notifGranted ? 'Alerts: On' : 'Alerts: Off'}</span>
        </button>

        {/* 10-Language & Number Formatting Trigger */}
        <button
          onClick={() => setShowLanguageModal(true)}
          className="p-2 rounded-lg border border-border/80 bg-panel/80 hover:bg-panel text-muted hover:text-white hover:border-brand transition-all cursor-pointer"
          title="Language & Number Formatting Settings"
        >
          <Globe className="w-4 h-4 text-cyan-400" />
        </button>

        {/* Trader Preferences & Settings Trigger */}
        <button
          onClick={() => setShowSettingsModal(true)}
          className="p-2 rounded-lg border border-border/80 bg-panel/80 hover:bg-panel text-muted hover:text-white hover:border-brand transition-all cursor-pointer"
          title="Trader Preferences & Settings"
        >
          <Settings className="w-4 h-4 text-brand" />
        </button>

        {!contractConfigured() && (
          <div className="text-sm text-brand font-bold bg-brand/20 px-3 py-1 rounded">
            Contract Not Configured
          </div>
        )}
        <div className="text-sm text-muted">Testnet</div>
        <ConnectWallet {...wallet} />
      </div>

      {/* Language & Number Format Selector Modal */}
      <LanguageModal
        isOpen={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
      />

      {/* Trader Preferences & Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </header>
  );
}
