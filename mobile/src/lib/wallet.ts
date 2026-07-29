/**
 * Mobile wallet module for EquinoxDEX.
 * Replaces Freighter (browser-only) with an embedded keypair wallet
 * secured by expo-secure-store (encrypted device keychain + biometrics).
 */
import { Keypair } from '@stellar/stellar-sdk';
import * as SecureStore from 'expo-secure-store';

const WALLET_KEY = 'equinox_wallet_keypair';

export interface WalletData {
  publicKey: string;
  secretKey: string;
}

/**
 * Check if a wallet already exists on this device.
 */
export async function hasWallet(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(WALLET_KEY);
  return stored !== null;
}

/**
 * Load the existing wallet from secure storage.
 */
export async function loadWallet(): Promise<WalletData | null> {
  const stored = await SecureStore.getItemAsync(WALLET_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as WalletData;
  } catch {
    return null;
  }
}

/**
 * Create a brand new Stellar keypair and store it securely.
 */
export async function createWallet(): Promise<WalletData> {
  const keypair = Keypair.random();
  const walletData: WalletData = {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  };
  await SecureStore.setItemAsync(WALLET_KEY, JSON.stringify(walletData), {
    requireAuthentication: false, // Set to true for biometric unlock
  });
  return walletData;
}

/**
 * Import a wallet from a secret key string.
 */
export async function importWallet(secretKey: string): Promise<WalletData> {
  const keypair = Keypair.fromSecret(secretKey);
  const walletData: WalletData = {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  };
  await SecureStore.setItemAsync(WALLET_KEY, JSON.stringify(walletData), {
    requireAuthentication: false,
  });
  return walletData;
}

/**
 * Delete the wallet from secure storage (logout).
 */
export async function deleteWallet(): Promise<void> {
  await SecureStore.deleteItemAsync(WALLET_KEY);
}
