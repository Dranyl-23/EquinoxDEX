'use client';
import { useEffect, useState } from 'react';
import { buildRegisterReferralXDR, contractConfigured } from '@/lib/contract';
import { signAndSubmit } from '@/lib/sign';

const REF_KEY = 'equinox_ref_code';

export function useReferral(publicKey: string | null) {
  const [referrerCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const urlParams = new URLSearchParams(window.location.search);
    const refParam = urlParams.get('ref');
    if (refParam) {
      localStorage.setItem(REF_KEY, refParam);
      return refParam;
    }
    return localStorage.getItem(REF_KEY);
  });

  // 2. Auto-register on-chain when user connects wallet
  useEffect(() => {
    if (!publicKey || !referrerCode || !contractConfigured()) return;
    // Only register valid Stellar public keys and skip self-referrals
    const isValidStellarAddress = /^G[A-Z2-7]{55}$/.test(referrerCode);
    if (referrerCode === publicKey || !isValidStellarAddress) return;

    const registeredKey = `equinox_ref_registered_${publicKey}`;
    if (localStorage.getItem(registeredKey)) return;

    const registerOnChain = async () => {
      try {
        const xdr = await buildRegisterReferralXDR(publicKey, referrerCode);
        await signAndSubmit(xdr, publicKey, false);
        localStorage.setItem(registeredKey, 'true');
      } catch {
        // Silently swallow if already registered or failed
      }
    };
    registerOnChain();
  }, [publicKey, referrerCode]);

  return { referrerCode };
}
