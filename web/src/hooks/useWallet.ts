'use client';
import { useState, useCallback, useSyncExternalStore } from 'react';

const TIMEOUT_MS = 3000;

function withTimeout<T>(p: Promise<T>, fallback: T, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export interface WalletState {
  publicKey: string | null;
  connecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
}

// React 18/19 idiom for subscribing to localStorage without SSR hydration mismatch or ESLint warnings
const emptySubscribe = (callback: () => void) => {
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', callback);
    return () => window.removeEventListener('storage', callback);
  }
  return () => {};
};

const getSnapshot = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('freighterPublicKey');
  }
  return null;
};

const getServerSnapshot = () => null;

export function useWallet(): WalletState {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicKey = useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const freighter = await import('@stellar/freighter-api');

      const connected = await withTimeout(freighter.isConnected(), {
        isConnected: false,
      });

      if (!connected.isConnected) {
        setError('Freighter wallet extension is not installed.');
        return;
      }

      const res = await withTimeout(
        freighter.getAddress(),
        { address: '', error: '' }
      );

      const address = typeof res === 'string' ? res : res?.address;

      if (address) {
        localStorage.setItem('freighterPublicKey', address);
        window.dispatchEvent(new Event('storage'));
      } else {
        setError('Failed to fetch public key from Freighter.');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem('freighterPublicKey');
    window.dispatchEvent(new Event('storage'));
  }, []);

  return { publicKey, connecting, error, connect, disconnect };
}
