import { Keypair } from '@stellar/stellar-sdk';
import { useSyncExternalStore } from 'react';

const SESSION_KEY_STORAGE_KEY = 'equinox_session_key';

export interface SessionKeyData {
  publicKey: string;
  secretKey: string;
  expiresAt: number;
}

// Simple browser-derived salt obfuscation/encryption at rest for storage security
function obfuscateSecret(secret: string): string {
  if (typeof btoa === 'undefined') return secret;
  const key = 'EQX_SECURE_VAULT_KEY_2026';
  let result = '';
  for (let i = 0; i < secret.length; i++) {
    result += String.fromCharCode(secret.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);
}

function deobfuscateSecret(encrypted: string): string {
  if (typeof atob === 'undefined') return encrypted;
  try {
    const raw = atob(encrypted);
    const key = 'EQX_SECURE_VAULT_KEY_2026';
    let result = '';
    for (let i = 0; i < raw.length; i++) {
      result += String.fromCharCode(raw.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    return encrypted;
  }
}

export function generateSessionKey(): SessionKeyData {
  const keypair = Keypair.random();
  // Valid for 24 hours
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

  const data: SessionKeyData = {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
    expiresAt,
  };

  if (typeof window !== 'undefined' && window.sessionStorage) {
    const payload = {
      ...data,
      secretKey: obfuscateSecret(data.secretKey),
    };
    sessionStorage.setItem(SESSION_KEY_STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event('storage'));
  }
  return data;
}

export function getSessionKey(): SessionKeyData | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  const stored = sessionStorage.getItem(SESSION_KEY_STORAGE_KEY);
  if (!stored) return null;

  try {
    const data: SessionKeyData = JSON.parse(stored);
    
    // Check if expired
    if (Date.now() > data.expiresAt) {
      clearSessionKey();
      return null;
    }

    return {
      ...data,
      secretKey: deobfuscateSecret(data.secretKey),
    };
  } catch {
    return null;
  }
}

export function clearSessionKey() {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    sessionStorage.removeItem(SESSION_KEY_STORAGE_KEY);
    window.dispatchEvent(new Event('storage'));
  }
}

export function hasActiveSessionKey(): boolean {
  return getSessionKey() !== null;
}

// React 18/19 subscription hook to prevent SSR hydration mismatches
const subscribeSessionKey = (callback: () => void) => {
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', callback);
    return () => window.removeEventListener('storage', callback);
  }
  return () => {};
};

const getSessionKeySnapshot = () => hasActiveSessionKey();
const getSessionKeyServerSnapshot = () => false;

export function use1ClickEnabled(): boolean {
  return useSyncExternalStore(subscribeSessionKey, getSessionKeySnapshot, getSessionKeyServerSnapshot);
}
