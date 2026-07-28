import { Keypair } from '@stellar/stellar-sdk';
import { useSyncExternalStore } from 'react';

const SESSION_KEY_STORAGE_KEY = 'equinox_session_key';
const ENCRYPTION_PASSPHRASE = 'EQX_SECURE_VAULT_KEY_2026';

export interface SessionKeyData {
  publicKey: string;
  secretKey: string;
  expiresAt: number;
}

let sessionKeyCache: SessionKeyData | null = null;

const encodeUtf8 = (value: string) => new TextEncoder().encode(value);
const decodeUtf8 = (data: ArrayBuffer) => new TextDecoder().decode(data);
const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};
const base64ToArrayBuffer = (base64: string) => {
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer.buffer;
};

const deriveCryptoKey = async (passphrase: string, salt: Uint8Array): Promise<CryptoKey> => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encodeUtf8(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

const encryptSecret = async (secret: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveCryptoKey(ENCRYPTION_PASSPHRASE, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encodeUtf8(secret),
  );

  return {
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer),
    salt: arrayBufferToBase64(salt.buffer),
  };
};

const decryptSecret = async (payload: {
  ciphertext: string;
  iv: string;
  salt: string;
}) => {
  const salt = new Uint8Array(base64ToArrayBuffer(payload.salt) as ArrayBuffer);
  const iv = new Uint8Array(base64ToArrayBuffer(payload.iv) as ArrayBuffer);
  const key = await deriveCryptoKey(ENCRYPTION_PASSPHRASE, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    base64ToArrayBuffer(payload.ciphertext),
  );
  return decodeUtf8(decrypted);
};

const getStoredSessionItem = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  const stored = sessionStorage.getItem(SESSION_KEY_STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export async function generateSessionKey(): Promise<SessionKeyData> {
  const keypair = Keypair.random();
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

  const data: SessionKeyData = {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
    expiresAt,
  };

  if (typeof window !== 'undefined' && window.sessionStorage) {
    const encrypted = await encryptSecret(data.secretKey);
    const payload = {
      publicKey: data.publicKey,
      expiresAt: data.expiresAt,
      secretKey: encrypted.ciphertext,
      iv: encrypted.iv,
      salt: encrypted.salt,
    };
    sessionStorage.setItem(SESSION_KEY_STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event('storage'));
  }

  sessionKeyCache = data;
  return data;
}

export async function getSessionKey(): Promise<SessionKeyData | null> {
  if (sessionKeyCache) {
    if (Date.now() > sessionKeyCache.expiresAt) {
      clearSessionKey();
      return null;
    }
    return sessionKeyCache;
  }

  const stored = getStoredSessionItem();
  if (!stored) return null;

  if (typeof stored.expiresAt !== 'number' || typeof stored.publicKey !== 'string') {
    clearSessionKey();
    return null;
  }

  if (Date.now() > stored.expiresAt) {
    clearSessionKey();
    return null;
  }

  if (
    typeof stored.secretKey !== 'string' ||
    typeof stored.iv !== 'string' ||
    typeof stored.salt !== 'string'
  ) {
    clearSessionKey();
    return null;
  }

  try {
    const secretKey = await decryptSecret({
      ciphertext: stored.secretKey,
      iv: stored.iv,
      salt: stored.salt,
    });

    sessionKeyCache = {
      publicKey: stored.publicKey,
      secretKey,
      expiresAt: stored.expiresAt,
    };
    return sessionKeyCache;
  } catch {
    clearSessionKey();
    return null;
  }
}

export function clearSessionKey() {
  sessionKeyCache = null;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    sessionStorage.removeItem(SESSION_KEY_STORAGE_KEY);
    window.dispatchEvent(new Event('storage'));
  }
}

export function hasActiveSessionKey(): boolean {
  const stored = getStoredSessionItem();
  if (!stored) return false;
  if (typeof stored.expiresAt !== 'number') return false;
  return Date.now() <= stored.expiresAt;
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
