'use client';
import { useEffect, useState } from 'react';
import { buildRegisterReferralXDR, contractConfigured } from '@/lib/contract';
import { signAndSubmit } from '@/lib/sign';

const REF_KEY = 'equinox_ref_code';

export function useReferral(publicKey: string | null) {
  const [referrerCode, setReferrerCode] = useState<string | null>(null);

  // 1. Capture ?ref= from URL and save to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const refParam = urlParams.get('ref');
    if (refParam) {
      localStorage.setItem(REF_KEY, refParam);
      setReferrerCode(refParam);
    } else {
      const saved = localStorage.getItem(REF_KEY);
      if (saved) setReferrerCode(saved);
    }
  }, []);

  // 2. Auto-register on-chain when user connects wallet
  useEffect(() => {
    if (!publicKey || !referrerCode || !contractConfigured()) return;
    // Don't register if code is invalid or matches self
    if (referrerCode === publicKey || referrerCode.length < 56) return;

    const registeredKey = `equinox_ref_registered_${publicKey}`;
    if (localStorage.getItem(registeredKey)) return;

    const registerOnChain = async () => {
      try {
        const xdr = await buildRegisterReferralXDR(publicKey, referrerCode);
        await signAndSubmit(xdr, publicKey, true);
        localStorage.setItem(registeredKey, 'true');
      } catch {
        // Silently swallow if already registered or failed
      }
    };
    registerOnChain();
  }, [publicKey, referrerCode]);

  return { referrerCode };
}
