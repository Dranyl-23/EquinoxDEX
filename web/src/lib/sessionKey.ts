import { Keypair } from '@stellar/stellar-sdk';

const SESSION_KEY_STORAGE_KEY = 'equinox_session_key';

export interface SessionKeyData {
  publicKey: string;
  secretKey: string;
  expiresAt: number;
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
    sessionStorage.setItem(SESSION_KEY_STORAGE_KEY, JSON.stringify(data));
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

    return data;
  } catch {
    return null;
  }
}

export function clearSessionKey() {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    sessionStorage.removeItem(SESSION_KEY_STORAGE_KEY);
  }
}

export function hasActiveSessionKey(): boolean {
  return getSessionKey() !== null;
}
