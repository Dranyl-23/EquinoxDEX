'use client';

import { useState, useEffect } from 'react';
import { useWalletContext } from '@/components/WalletProvider';
import {
  readReferralStats,
  readMarketState,
  buildClaimReferralKickbackXDR,
  contractConfigured,
} from '@/lib/contract';
import { signAndSubmit } from '@/lib/sign';
import { useToast } from '@/components/Toast';
import { useLanguage } from '@/components/LanguageProvider';

export default function RewardsPage() {
  const { t, formatNum } = useLanguage();
  const wallet = useWalletContext();
  const { publicKey } = wallet;
  const { toast } = useToast();

  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [customAlias, setCustomAlias] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('equinox_custom_alias') ?? '';
  });

  const activeCode = customAlias.trim() ? customAlias.trim().toUpperCase() : publicKey || '';

  // On-chain Referral State
  const [unclaimedKickback, setUnclaimedKickback] = useState<number>(0);
  const [lifetimeEarnings, setLifetimeEarnings] = useState<number>(0);
  const [referredCount, setReferredCount] = useState<number>(0);
  const [tradingVolume30d, setTradingVolume30d] = useState<number>(0);

  useEffect(() => {
    if (!publicKey || !contractConfigured()) return;

    const loadStats = async () => {
      try {
        const [stats, market] = await Promise.all([
          readReferralStats(publicKey),
          readMarketState()
        ]);
        setUnclaimedKickback(stats.kickback);
        setLifetimeEarnings(stats.lifetime);
        setReferredCount(stats.count);
        setTradingVolume30d(market.total_volume / 10000000);
      } catch {
        // Silently swallow polling glitches
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, [publicKey, customAlias]);

  const originUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://equinoxdex.io';
  const refUrl = `${originUrl}/?ref=${activeCode || 'EQUINOXVIP'}`;

  // Dynamic VIP Fee Tier Calculation
  const getVipTier = (vol: number) => {
    if (vol >= 250000)
      return {
        tier: 3,
        name: 'Tier 3 (Institutional)',
        discount: '15% Off',
        nextThreshold: 250000,
        target: 250000,
      };
    if (vol >= 50000)
      return {
        tier: 2,
        name: 'Tier 2 (Pro)',
        discount: '10% Off',
        nextThreshold: 250000,
        target: 250000,
      };
    return {
      tier: 1,
      name: 'Tier 1 (Base)',
      discount: '5% Off',
      nextThreshold: 50000,
      target: 50000,
    };
  };

  const vipInfo = getVipTier(tradingVolume30d);
  const progressPct = Math.min(
    100,
    Math.max(0, (tradingVolume30d / vipInfo.target) * 100)
  );

  const handleCopyLink = () => {
    navigator.clipboard.writeText(refUrl);
    setCopied(true);
    toast('Referral Link Copied', 'info', refUrl);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateCustomAlias = () => {
    if (!customAlias.trim()) return;
    const cleanCode = customAlias.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (typeof window !== 'undefined') {
      localStorage.setItem('equinox_custom_alias', cleanCode);
    }
    setCustomAlias(cleanCode);
    toast('Custom Referral Code Created', 'success', `Your referral alias is set to ${cleanCode}`);
  };

  const handleClaimRewards = async () => {
    if (!publicKey || unclaimedKickback <= 0) return;
    setClaiming(true);

    try {
      const xdr = await buildClaimReferralKickbackXDR(publicKey);
      await signAndSubmit(xdr, publicKey);

      const stats = await readReferralStats(publicKey);
      setUnclaimedKickback(stats.kickback);
      setLifetimeEarnings(stats.lifetime);

      toast(
        'Kickback Claimed Successfully',
        'success',
        `Credited to your Cross-Margin balance on-chain!`
      );
    } catch (err: unknown) {
      toast('Claim Failed', 'error', err instanceof Error ? err.message : String(err));
    } finally {
      setClaiming(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full flex-col bg-background">
      <div className="flex flex-col flex-1 p-6 lg:p-10 max-w-400 mx-auto w-full">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-2">
          <h2 className="text-3xl font-bold text-white">{t('referralProgram')}</h2>
          <p className="text-muted">
            Invite friends to EquinoxDEX. Earn 20% of their trading fees forever and unlock up to 15% fee discounts.
          </p>
        </div>

        {/* Global Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-panel border border-border/80 rounded-xl p-5 shadow-lg">
            <div className="text-xs text-muted font-semibold mb-1">{t('referredTraders')}</div>
            <div className="text-2xl font-mono font-bold text-white">{referredCount}</div>
            <div className="text-[10px] text-muted mt-1">Active referred accounts</div>
          </div>

          <div className="bg-panel border border-border/80 rounded-xl p-5 shadow-lg">
            <div className="text-xs text-muted font-semibold mb-1">{t('unclaimedKickback')}</div>
            <div className="text-2xl font-mono font-bold text-emerald-400">
              ${formatNum(unclaimedKickback, 2)}{' '}
              <span className="text-xs text-muted font-sans font-normal">USDC</span>
            </div>
            <div className="text-[10px] text-muted mt-1">On-chain kickback ready to claim</div>
          </div>

          <div className="bg-panel border border-border/80 rounded-xl p-5 shadow-lg">
            <div className="text-xs text-muted font-semibold mb-1">{t('lifetimeEarnings')}</div>
            <div className="text-2xl font-mono font-bold text-white">
              ${formatNum(lifetimeEarnings, 2)}{' '}
              <span className="text-xs text-muted font-sans font-normal">USDC</span>
            </div>
            <div className="text-[10px] text-muted mt-1">Total referral payouts accrued</div>
          </div>

          <div className="bg-panel border border-border/80 rounded-xl p-5 shadow-lg">
            <div className="text-xs text-muted font-semibold mb-1">{t('tradingVolume30d')}</div>
            <div className="text-2xl font-mono font-bold text-cyan-400">
              ${formatNum(tradingVolume30d, 0)}{' '}
              <span className="text-xs text-muted font-sans font-normal">USDC</span>
            </div>
            <div className="text-[10px] text-muted mt-1">{vipInfo.discount} Active</div>
          </div>
        </div>

        {/* Main Grid: 2/3 Referral Link Generator, 1/3 VIP Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Col (2 cols): Referral Generator & Custom Code */}
          <div className="lg:col-span-2 bg-panel border border-border/80 rounded-2xl p-6 shadow-2xl flex flex-col gap-6">
            <div className="border-b border-border/60 pb-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Your Unique Referral Link</h3>
              {publicKey && (
                <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md font-bold">
                  Connected
                </span>
              )}
            </div>

            {/* Custom Alias Input */}
            <div className="flex flex-col gap-2 bg-background/60 p-4 rounded-xl border border-border/60">
              <label className="text-xs text-white font-bold">
                Create Custom Referral Alias (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. EQUINOXPRO"
                  value={customAlias}
                  onChange={(e) => setCustomAlias(e.target.value)}
                  className="flex-1 bg-background border border-border/80 rounded-lg px-3.5 py-2 text-white outline-none font-mono text-xs focus:border-brand transition-all uppercase"
                />
                <button
                  onClick={handleCreateCustomAlias}
                  className="px-4 py-2 bg-panel hover:bg-panel/80 border border-border/80 text-white font-semibold rounded-lg text-xs transition-all cursor-pointer"
                >
                  Set Alias
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs text-muted font-mono">
                Share this link to earn 20% fee rebate on every trade:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={refUrl}
                  className="flex-1 bg-background border border-border/80 rounded-xl px-4 py-3 text-white outline-none font-mono text-xs"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-6 py-3 bg-brand hover:bg-brand/90 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer"
                >
                  {copied ? '✓ Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>

            {/* Claim Kickback Action Card */}
            <div className="bg-background/80 border border-border/80 rounded-xl p-5 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-white">Unclaimed Referral Kickback</span>
                <span className="text-lg font-mono font-bold text-emerald-400">
                  ${formatNum(unclaimedKickback, 2)} USDC
                </span>
              </div>

              <button
                onClick={handleClaimRewards}
                disabled={!publicKey || unclaimedKickback <= 0 || claiming}
                className={`w-full py-3.5 rounded-xl font-bold text-xs transition-all text-center border shadow-md cursor-pointer ${
                  !publicKey || unclaimedKickback <= 0
                    ? 'bg-panel text-muted/60 border-border cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-black font-bold border-emerald-400 shadow-emerald-500/20 active:scale-[0.99]'
                }`}
              >
                {!publicKey
                  ? 'Connect Wallet to Claim'
                  : claiming
                  ? 'Claiming Kickback to Cross-Margin...'
                  : unclaimedKickback <= 0
                  ? 'No Kickback Available'
                  : `Claim $${formatNum(unclaimedKickback, 2)} USDC Kickback on-chain`}
              </button>
            </div>
          </div>

          {/* Right Col: VIP Fee Discount Tier Matrix & Progress */}
          <div className="bg-panel border border-border/80 rounded-2xl p-6 shadow-2xl flex flex-col gap-5">
            <div className="border-b border-border/60 pb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">VIP Fee Tiers</h3>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-brand/20 text-brand border border-brand/40">
                {vipInfo.name} Active
              </span>
            </div>

            {/* Live Tier Progress Bar */}
            <div className="flex flex-col gap-2 bg-background/60 p-4 rounded-xl border border-border/60">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted">30d Progress</span>
                <span className="text-white font-bold">
                  ${tradingVolume30d.toLocaleString()} / ${vipInfo.target.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-2.5 bg-background rounded-full overflow-hidden border border-border/60">
                <div
                  className="h-full bg-brand rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 font-mono text-xs">
              <div
                className={`rounded-xl p-3.5 border transition-all ${
                  vipInfo.tier === 1
                    ? 'bg-brand/10 border-brand text-brand'
                    : 'bg-background border-border/60'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-white">
                      Tier 1 (Base) {vipInfo.tier === 1 && '✓'}
                    </div>
                    <div className="text-[10px] text-muted">$0 - $50k 30d Vol</div>
                  </div>
                  <div className="font-bold text-emerald-400">5% Off</div>
                </div>
              </div>

              <div
                className={`rounded-xl p-3.5 border transition-all ${
                  vipInfo.tier === 2
                    ? 'bg-brand/10 border-brand text-brand'
                    : 'bg-background border-border/60'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-white">
                      Tier 2 (Pro) {vipInfo.tier === 2 && '✓'}
                    </div>
                    <div className="text-[10px] text-muted">$50k - $250k 30d Vol</div>
                  </div>
                  <div className="font-bold text-emerald-400">10% Off</div>
                </div>
              </div>

              <div
                className={`rounded-xl p-3.5 border transition-all ${
                  vipInfo.tier === 3
                    ? 'bg-brand/10 border-brand text-brand'
                    : 'bg-background border-border/60'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-white">
                      Tier 3 (Institutional) {vipInfo.tier === 3 && '✓'}
                    </div>
                    <div className="text-[10px] text-muted">$250k+ 30d Vol</div>
                  </div>
                  <div className="font-bold text-emerald-400">15% Off</div>
                </div>
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
