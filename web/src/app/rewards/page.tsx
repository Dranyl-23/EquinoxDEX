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
    <main className="flex min-h-screen w-full flex-col bg-background text-white">
      <div className="flex flex-col flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full gap-8">
        
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/20 text-black font-extrabold text-lg">
              🎁
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                Referrals & Fee Discount Rewards
                <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">
                  VIP Kickbacks
                </span>
              </h1>
              <p className="text-sm text-muted mt-1">
                Invite friends to EquinoxDEX. Earn 20% of their trading fees forever and unlock up to 15% fee discounts.
              </p>
            </div>
          </div>
        </div>

        {/* Hero Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left 2 Cols: Referral Link Generator */}
          <div className="md:col-span-2 bg-panel/70 border border-border/60 rounded-2xl p-6 backdrop-blur-xl flex flex-col gap-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white">Your Unique Referral Link</h2>

            <div className="flex flex-col gap-3">
              <label className="text-xs text-muted font-mono">Share this link to earn 20% fee rebate on every trade:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={refUrl}
                  className="flex-1 bg-background border border-border/70 rounded-xl px-4 py-3 text-white outline-none font-mono text-sm"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-6 py-3 bg-linear-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20"
                >
                  {copied ? '✓ Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>

            {/* Earnings Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/60 text-center font-mono">
              <div className="bg-background/80 p-4 rounded-xl border border-border/50">
                <div className="text-xs text-muted">Referred Traders</div>
                <div className="text-xl font-bold text-white mt-1">{totalReferred}</div>
              </div>

              <div className="bg-background/80 p-4 rounded-xl border border-border/50">
                <div className="text-xs text-muted">Unclaimed Kickback</div>
                <div className="text-xl font-bold text-emerald-400 mt-1">${unclaimedKickback.toFixed(2)} USDC</div>
              </div>

              <div className="bg-background/80 p-4 rounded-xl border border-border/50">
                <div className="text-xs text-muted">Lifetime Earned</div>
                <div className="text-xl font-bold text-white mt-1">${lifetimeEarnings.toFixed(2)} USDC</div>
              </div>
            </div>

            {/* Claim Button */}
            {claimed && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-xs font-mono text-center">
                ✓ Successfully claimed ${unclaimedKickback.toFixed(2)} USDC kickback to your Cross-Margin Account!
              </div>
            )}

            <button
              onClick={handleClaimRewards}
              disabled={!publicKey || unclaimedKickback <= 0}
              className={`w-full py-3.5 rounded-xl font-bold text-xs transition-all text-center border shadow-lg ${
                !publicKey || unclaimedKickback <= 0
                  ? 'bg-panel text-muted/60 border-border/60 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold border-emerald-400/30 shadow-emerald-500/25 active:scale-[0.99]'
              }`}
            >
              {!publicKey ? 'Connect Wallet to Claim' : `Claim $${unclaimedKickback.toFixed(2)} USDC Kickback`}
            </button>
          </div>

          {/* Right Col: VIP Fee Discount Tier Matrix */}
          <div className="bg-panel/70 border border-border/60 rounded-2xl p-6 backdrop-blur-xl flex flex-col gap-5 shadow-xl">
            <h2 className="text-base font-bold text-white flex items-center justify-between">
              <span>VIP Fee Discount Tiers</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
                Tier 2 Active
              </span>
            </h2>

            <div className="flex flex-col gap-3 font-mono text-xs">
              <div className="bg-background/80 border border-border/50 rounded-xl p-3.5 flex justify-between items-center">
                <div>
                  <div className="font-bold text-white">Tier 1 (Base)</div>
                  <div className="text-[10px] text-muted">$0 - $50k 30d Vol</div>
                </div>
                <div className="text-muted font-bold">5% Off</div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3.5 flex justify-between items-center text-amber-300">
                <div>
                  <div className="font-bold text-amber-300">Tier 2 (Pro) ✓</div>
                  <div className="text-[10px] text-amber-300/70">$50k - $250k 30d Vol</div>
                </div>
                <div className="font-bold text-emerald-400">10% Off</div>
              </div>

              <div className="bg-background/80 border border-border/50 rounded-xl p-3.5 flex justify-between items-center">
                <div>
                  <div className="font-bold text-white">Tier 3 (Institutional)</div>
                  <div className="text-[10px] text-muted">$250k+ 30d Vol</div>
                </div>
                <div className="text-emerald-400 font-bold">15% Off</div>
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
