/**
 * Wallet context provider for React Native.
 * Manages wallet state across the app.
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { loadWallet, createWallet, importWallet, deleteWallet, WalletData } from '../lib/wallet';
import { fetchBalances, Balances } from '../lib/balances';
import { fundTestnetAccount } from '../lib/stellar';

export interface WalletContextType {
  wallet: WalletData | null;
  balances: Balances | null;
  loading: boolean;
  connected: boolean;
  connect: () => Promise<void>;
  importKey: (secretKey: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalances: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [loading, setLoading] = useState(true);

  // Load existing wallet on mount
  useEffect(() => {
    (async () => {
      const existing = await loadWallet();
      if (existing) {
        setWallet(existing);
        const bal = await fetchBalances(existing.publicKey);
        setBalances(bal);
      }
      setLoading(false);
    })();
  }, []);

  const connect = async () => {
    setLoading(true);
    const newWallet = await createWallet();
    // Fund via Friendbot on testnet
    try {
      await fundTestnetAccount(newWallet.publicKey);
    } catch {
      // Account may already be funded
    }
    setWallet(newWallet);
    const bal = await fetchBalances(newWallet.publicKey);
    setBalances(bal);
    setLoading(false);
  };

  const importKey = async (secretKey: string) => {
    setLoading(true);
    const imported = await importWallet(secretKey);
    setWallet(imported);
    const bal = await fetchBalances(imported.publicKey);
    setBalances(bal);
    setLoading(false);
  };

  const disconnect = async () => {
    await deleteWallet();
    setWallet(null);
    setBalances(null);
  };

  const refreshBalances = async () => {
    if (!wallet) return;
    const bal = await fetchBalances(wallet.publicKey);
    setBalances(bal);
  };

  return (
    <WalletContext.Provider
      value={{
        wallet,
        balances,
        loading,
        connected: wallet !== null,
        connect,
        importKey,
        disconnect,
        refreshBalances,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within a WalletProvider');
  }
  return context;
}
