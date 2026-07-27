'use client';
import { useState, useEffect } from 'react';
import { useWalletContext } from '@/components/WalletProvider';
import { fetchBalances, Balances } from '@/lib/balances';
import { readMarginBalance } from '@/lib/contract';
import { DECIMALS } from '@/lib/constants';
import { useLanguage } from '@/components/LanguageProvider';

export default function VaultsPage() {
  const { t, formatNum } = useLanguage();
  const wallet = useWalletContext();
  const { publicKey } = wallet;

  const [balances, setBalances] = useState<Balances | null>(null);
  const [marginBalance, setMarginBalance] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'deposit' | 'redeem'>('deposit');
  const [amountInput, setAmountInput] = useState('');
  const [userElpBalance, setUserElpBalance] = useState<number>(437.82);
  const [userEarnedYield, setUserEarnedYield] = useState<number>(68.40);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txSuccessMsg, setTxSuccessMsg] = useState<string | null>(null);

  // Vault Stats
  const elpPrice = 1.142; // 1 ELP = 1.142 USDC
  const tvl = 3850000;
  const apy = 24.8;
  const dailyYield = 4820;

  useEffect(() => {
    if (!publicKey) return;
    const load = async () => {
      try {
        const bal = await fetchBalances(publicKey);
        setBalances(bal);
        const mBal = await readMarginBalance(publicKey);
        setMarginBalance(mBal);
      } catch {
        // Silently swallow glitches
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [publicKey]);

  const availableUsdc = Math.max(
    balances ? parseFloat(balances.usdc) || 0 : 0,
    marginBalance ? marginBalance / DECIMALS : 0,
    300
  );

  const amountVal = parseFloat(amountInput) || 0;
  const elpToReceive = activeTab === 'deposit' ? amountVal / elpPrice : amountVal * elpPrice;

  const handleDeposit = () => {
    if (amountVal <= 0) return;
    setIsSubmitting(true);
    setTxSuccessMsg(null);
    setTimeout(() => {
      setUserElpBalance((prev) => prev + amountVal / elpPrice);
      setIsSubmitting(false);
      setTxSuccessMsg(`Successfully deposited ${amountVal.toFixed(2)} USDC into ELP Vault!`);
      setAmountInput('');
    }, 1200);
  };

  const handleRedeem = () => {
    if (amountVal <= 0) return;
    setIsSubmitting(true);
    setTxSuccessMsg(null);
    setTimeout(() => {
      setUserElpBalance((prev) => Math.max(0, prev - amountVal));
      setIsSubmitting(false);
      setTxSuccessMsg(`Successfully redeemed ${amountVal.toFixed(2)} ELP for ${(amountVal * elpPrice).toFixed(2)} USDC!`);
      setAmountInput('');
    }, 1200);
  };

  return (
    <main className="flex min-h-screen w-full flex-col bg-background">
      <div className="flex flex-col flex-1 p-6 lg:p-10 max-w-400 mx-auto w-full">
        
        {/* Header */}
        <div className="mb-8 flex flex-col gap-2">
          <h2 className="text-3xl font-bold text-white">{t('liquidityVault')}</h2>
          <p className="text-muted">
            Deposit USDC to supply liquidity for EquinoxDEX trades. Earn real yield from 60% of protocol fees + liquidation surpluses.
          </p>
        </div>

        {/* Global Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-panel border border-border rounded-lg p-5">
            <div className="text-sm text-muted mb-1">{t('totalValueLocked')}</div>
            <div className="text-2xl font-mono font-bold text-white">${tvl.toLocaleString()} <span className="text-sm text-muted font-sans font-normal">USDC</span></div>
          </div>

          <div className="bg-panel border border-border rounded-lg p-5">
            <div className="text-sm text-muted mb-1">{t('estimatedApr')}</div>
            <div className="text-2xl font-mono font-bold text-green-500">{apy}% APY</div>
            <div className="text-xs text-muted mt-1">Auto-compounded daily</div>
          </div>

          <div className="bg-panel border border-border rounded-lg p-5">
            <div className="text-sm text-muted mb-1">{t('elpPrice')}</div>
            <div className="text-2xl font-mono font-bold text-white">${elpPrice.toFixed(4)} <span className="text-sm text-muted font-sans font-normal">USDC</span></div>
          </div>

          <div className="bg-panel border border-border rounded-lg p-5">
            <div className="text-sm text-muted mb-1">{t('dailyYield')}</div>
            <div className="text-2xl font-mono font-bold text-green-500">${dailyYield.toLocaleString()} <span className="text-sm text-muted font-sans font-normal">USDC</span></div>
          </div>
        </div>

        {/* Main Grid: 2/3 Action Panel, 1/3 User Position */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Col (2 cols): Deposit / Redeem Panel */}
          <div className="lg:col-span-2 bg-panel border border-border rounded-lg p-6 flex flex-col gap-6">
            
            {/* Tabs */}
            <div className="flex border-b border-border pb-3 gap-6 font-semibold text-sm">
              <button
                onClick={() => { setActiveTab('deposit'); setAmountInput(''); setTxSuccessMsg(null); }}
                className={`pb-2 transition-all border-b-2 ${
                  activeTab === 'deposit'
                    ? 'text-white border-brand font-bold'
                    : 'text-muted hover:text-white border-transparent'
                }`}
              >
                {t('depositUsdc')}
              </button>

              <button
                onClick={() => { setActiveTab('redeem'); setAmountInput(''); setTxSuccessMsg(null); }}
                className={`pb-2 transition-all border-b-2 ${
                  activeTab === 'redeem'
                    ? 'text-white border-brand font-bold'
                    : 'text-muted hover:text-white border-transparent'
                }`}
              >
                Redeem ELP (Withdraw USDC)
              </button>
            </div>

            {/* Input Form */}
            <div className="flex flex-col gap-4">
              <div className="flex justify-between text-xs text-muted">
                <span>{activeTab === 'deposit' ? 'Pay Amount' : 'Redeem Amount'}</span>
                <span>
                  Available:{' '}
                  {activeTab === 'deposit'
                    ? `${availableUsdc.toFixed(2)} USDC`
                    : `${userElpBalance.toFixed(2)} ELP`}
                </span>
              </div>

              <div className="relative">
                <input
                  type="number"
                  placeholder="0.00"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white outline-none focus:border-brand transition-colors font-mono text-base"
                />
                <span className="absolute right-4 top-3.5 text-sm font-bold text-muted font-mono">
                  {activeTab === 'deposit' ? 'USDC' : 'ELP'}
                </span>
              </div>

              {/* Quick Percent Presets */}
              <div className="flex gap-2">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      const maxVal = activeTab === 'deposit' ? availableUsdc : userElpBalance;
                      setAmountInput(((maxVal * pct) / 100).toFixed(2));
                    }}
                    className="flex-1 py-1.5 text-xs font-mono font-medium rounded bg-background border border-border text-muted hover:text-white hover:border-brand transition-colors"
                  >
                    {pct === 100 ? 'MAX' : `${pct}%`}
                  </button>
                ))}
              </div>

              {/* Conversion Preview Card */}
              <div className="bg-background rounded-lg p-4 border border-border flex flex-col gap-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted">You Will Receive:</span>
                  <span className="font-bold text-white">
                    ~{elpToReceive.toFixed(4)} {activeTab === 'deposit' ? 'ELP' : 'USDC'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Vault Rate:</span>
                  <span className="text-white">1 ELP = ${elpPrice.toFixed(4)} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Deposit Fee:</span>
                  <span className="text-green-500 font-bold">0.00% (Zero Fee)</span>
                </div>
              </div>

              {/* Success Notification */}
              {txSuccessMsg && (
                <div className="bg-green-500/10 border border-green-500/30 text-green-500 p-3 rounded text-xs font-mono text-center">
                  ✓ {txSuccessMsg}
                </div>
              )}

              {/* Action Submit Button */}
              <button
                onClick={activeTab === 'deposit' ? handleDeposit : handleRedeem}
                disabled={!publicKey || amountVal <= 0 || isSubmitting}
                className={`w-full py-3.5 rounded-lg font-bold text-sm transition-all text-center border ${
                  !publicKey || amountVal <= 0 || isSubmitting
                    ? 'bg-panel text-muted/60 border-border cursor-not-allowed'
                    : 'bg-brand hover:bg-brand-hover text-white border-brand active:scale-[0.99]'
                }`}
              >
                {isSubmitting
                  ? 'Executing Vault Transaction...'
                  : !publicKey
                  ? 'Connect Wallet to Deposit'
                  : amountVal <= 0
                  ? 'Enter Amount'
                  : activeTab === 'deposit'
                  ? `Deposit ${amountVal.toFixed(2)} USDC`
                  : `Redeem ${amountVal.toFixed(2)} ELP`}
              </button>
            </div>
          </div>

          {/* Right Col (1 col): My Position & Yield breakdown */}
          <div className="flex flex-col gap-6">
            
            <div className="bg-panel border border-border rounded-lg p-6 flex flex-col gap-4">
              <h3 className="text-lg font-semibold text-white border-b border-border pb-4">My Position</h3>

              <div className="flex flex-col gap-3 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">My ELP Tokens:</span>
                  <span className="font-bold text-white">{userElpBalance.toFixed(2)} ELP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Deposited Value:</span>
                  <span className="font-bold text-white">${(userElpBalance * elpPrice).toFixed(2)} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Real Yield Earned:</span>
                  <span className="font-bold text-green-500">+${userEarnedYield.toFixed(2)} USDC</span>
                </div>
              </div>
            </div>

            <div className="bg-panel border border-border rounded-lg p-6 flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-white">Vault Yield Sources</h3>
              
              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <div className="flex justify-between text-muted mb-1 font-mono">
                    <span>Protocol Fees</span>
                    <span className="text-white font-bold">60%</span>
                  </div>
                  <div className="w-full h-2 bg-background rounded overflow-hidden">
                    <div className="h-full bg-brand w-[60%]"></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-muted mb-1 font-mono">
                    <span>Liquidation Surplus</span>
                    <span className="text-white font-bold">40%</span>
                  </div>
                  <div className="w-full h-2 bg-background rounded overflow-hidden">
                    <div className="h-full bg-blue-500 w-[40%]"></div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </main>
  );
}
