'use client';
import { useState } from 'react';
import { useWalletContext } from '@/components/WalletProvider';

export default function RewardsPage() {
  const wallet = useWalletContext();
  const { publicKey } = wallet;
  const [copied, setCopied] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const refCode = publicKey ? `${publicKey.slice(0, 6)}REF` : 'EQUINOXVIP';
  const refUrl = `https://equinoxdex.io/r/${refCode}`;

  const totalReferred = 12;
  const unclaimedKickback = 142.50;
  const lifetimeEarnings = 480.20;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(refUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClaimRewards = () => {
    setClaimed(true);
    setTimeout(() => setClaimed(false), 3000);
  };

  return (
    <main className="flex min-h-screen w-full flex-col bg-background">
      <div className="flex flex-col flex-1 p-6 lg:p-10 max-w-400 mx-auto w-full">
        
        {/* Header */}
        <div className="mb-8 flex flex-col gap-2">
          <h2 className="text-3xl font-bold text-white">Referrals & Rewards</h2>
          <p className="text-muted">
            Invite friends to EquinoxDEX. Earn 20% of their trading fees forever and unlock up to 15% fee discounts.
          </p>
        </div>

        {/* Global Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-panel border border-border rounded-lg p-5">
            <div className="text-sm text-muted mb-1">Referred Traders</div>
            <div className="text-2xl font-mono font-bold text-white">{totalReferred}</div>
          </div>

          <div className="bg-panel border border-border rounded-lg p-5">
            <div className="text-sm text-muted mb-1">Unclaimed Fee Kickback</div>
            <div className="text-2xl font-mono font-bold text-green-500">${unclaimedKickback.toFixed(2)} <span className="text-sm text-muted font-sans font-normal">USDC</span></div>
          </div>

          <div className="bg-panel border border-border rounded-lg p-5">
            <div className="text-sm text-muted mb-1">Lifetime Earned</div>
            <div className="text-2xl font-mono font-bold text-white">${lifetimeEarnings.toFixed(2)} <span className="text-sm text-muted font-sans font-normal">USDC</span></div>
          </div>
        </div>

        {/* Main Grid: 2/3 Referral Link Generator, 1/3 VIP Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Col (2 cols): Referral Generator */}
          <div className="lg:col-span-2 bg-panel border border-border rounded-lg p-6 flex flex-col gap-6">
            <h3 className="text-lg font-semibold text-white border-b border-border pb-4">Your Unique Referral Link</h3>

            <div className="flex flex-col gap-3">
              <label className="text-xs text-muted font-mono">Share this link to earn 20% fee rebate on every trade:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={refUrl}
                  className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-white outline-none font-mono text-sm"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-6 py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg text-xs transition-all shadow-sm"
                >
                  {copied ? '✓ Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>

            {/* Claim Notification */}
            {claimed && (
              <div className="bg-green-500/10 border border-green-500/30 text-green-500 p-3 rounded text-xs font-mono text-center">
                ✓ Successfully claimed ${unclaimedKickback.toFixed(2)} USDC kickback to your Cross-Margin Account!
              </div>
            )}

            {/* Claim Button */}
            <button
              onClick={handleClaimRewards}
              disabled={!publicKey || unclaimedKickback <= 0}
              className={`w-full py-3.5 rounded-lg font-bold text-xs transition-all text-center border ${
                !publicKey || unclaimedKickback <= 0
                  ? 'bg-panel text-muted/60 border-border cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-400 text-black font-bold border-green-400 shadow-sm active:scale-[0.99]'
              }`}
            >
              {!publicKey ? 'Connect Wallet to Claim' : `Claim $${unclaimedKickback.toFixed(2)} USDC Kickback`}
            </button>
          </div>

          {/* Right Col: VIP Fee Discount Tier Matrix */}
          <div className="bg-panel border border-border rounded-lg p-6 flex flex-col gap-5">
            <h3 className="text-lg font-semibold text-white border-b border-border pb-4 flex items-center justify-between">
              <span>VIP Fee Tiers</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-brand/20 text-brand border border-brand/30">
                Tier 2 Active
              </span>
            </h3>

            <div className="flex flex-col gap-3 font-mono text-xs">
              <div className="bg-background rounded-lg p-3.5 border border-border flex justify-between items-center">
                <div>
                  <div className="font-bold text-white">Tier 1 (Base)</div>
                  <div className="text-[10px] text-muted">$0 - $50k 30d Vol</div>
                </div>
                <div className="text-muted font-bold">5% Off</div>
              </div>

              <div className="bg-brand/10 border border-brand/40 rounded-lg p-3.5 flex justify-between items-center text-brand">
                <div>
                  <div className="font-bold text-brand">Tier 2 (Pro) ✓</div>
                  <div className="text-[10px] text-brand/70">$50k - $250k 30d Vol</div>
                </div>
                <div className="font-bold text-green-500">10% Off</div>
              </div>

              <div className="bg-background rounded-lg p-3.5 border border-border flex justify-between items-center">
                <div>
                  <div className="font-bold text-white">Tier 3 (Institutional)</div>
                  <div className="text-[10px] text-muted">$250k+ 30d Vol</div>
                </div>
                <div className="text-green-500 font-bold">15% Off</div>
              </div>
            </div>

            <p className="text-[11px] text-muted leading-relaxed">
              Trading fee discounts are applied automatically at order execution time based on your 30-day trading volume.
            </p>
          </div>

        </div>

      </div>
    </main>
  );
}
