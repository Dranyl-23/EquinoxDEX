'use client';
import { useState } from 'react';
import type { WalletState } from '@/hooks/useWallet';

export default function ConnectWallet({
  publicKey,
  connecting,
  error,
  connect,
  disconnect,
}: WalletState) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (publicKey) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={copy}
          title="Copy full address"
          className="rounded bg-panel hover:bg-border text-white border border-border/50 px-3 py-1 font-mono text-sm transition-colors"
        >
          {copied ? 'Copied!' : `${publicKey.slice(0, 6)}…${publicKey.slice(-6)}`}
        </button>

        <button
          onClick={disconnect}
          className="text-sm text-red-500 hover:underline"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="text-right">
      <button
        onClick={connect}
        disabled={connecting}
        className="rounded bg-brand px-4 py-2 text-white font-bold transition-colors hover:bg-brand-hover disabled:opacity-50 text-sm"
      >
        {connecting ? 'Connecting…' : 'Connect Freighter'}
      </button>
      {error && <p className="mt-2 max-w-xs text-sm text-red-500">{error}</p>}
    </div>
  );
}
