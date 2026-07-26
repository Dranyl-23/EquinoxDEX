'use client';
import { useState, useEffect } from 'react';
import { useWalletContext } from '@/components/WalletProvider';
import { fetchBalances, Balances } from '@/lib/balances';
import { readPoolState, buildAddLiquidityXDR, buildRemoveLiquidityXDR, contractConfigured } from '@/lib/contract';
import { signAndSubmit } from '@/lib/sign';
import { USDC_TOKEN_ID, XLM_TOKEN_ID } from '@/lib/stellar';
import { DECIMALS, RPC_POLL_INTERVAL } from '@/lib/constants';

export default function Portfolio() {
  const wallet = useWalletContext();
  const { publicKey } = wallet;
  
  const [balances, setBalances] = useState<Balances | null>(null);
  const [poolState, setPoolState] = useState({ totalPool: 0, totalShares: 0, userShares: 0 });
  
  const [selectedAsset, setSelectedAsset] = useState<'USDC' | 'XLM'>('USDC');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<'deposit' | 'withdraw' | null>(null);

  // Poll for balances and pool state
  useEffect(() => {
    if (!contractConfigured()) return;
    const load = async () => {
      try {
        if (publicKey) {
          const bal = await fetchBalances(publicKey);
          setBalances(bal);
        }
        const state = await readPoolState(publicKey || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');
        setPoolState(state);
      } catch (e) {
        console.error(e);
      }
    };
    load();
    const interval = setInterval(load, RPC_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [publicKey]);

  const handleDeposit = async () => {
    if (!publicKey || !depositAmount) return;
    setIsSubmitting(true);
    try {
      setPendingAction('deposit');
      const scaledAmount = parseFloat(depositAmount) * DECIMALS;
      const tokenAddress = selectedAsset === 'USDC' ? USDC_TOKEN_ID : XLM_TOKEN_ID;
      const xdr = await buildAddLiquidityXDR(publicKey, tokenAddress, scaledAmount);
      await signAndSubmit(xdr, publicKey);
      setDepositAmount('');
      
      const bal = await fetchBalances(publicKey);
      setBalances(bal);
      const state = await readPoolState(publicKey);
      setPoolState(state);
      setPendingAction(null);
      alert('Deposit successful!');
    } catch (e: unknown) {
      setPendingAction(null);
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!publicKey || !withdrawAmount) return;
    setIsSubmitting(true);
    try {
      setPendingAction('withdraw');
      // Calculate how many shares they are trying to withdraw based on USDC input
      // USDC = (shares * totalPool) / totalShares  =>  shares = (USDC * totalShares) / totalPool
      const usdcScaled = parseFloat(withdrawAmount) * DECIMALS;
      let sharesToWithdraw = usdcScaled;
      
      if (poolState.totalPool > 0 && poolState.totalShares > 0) {
        sharesToWithdraw = (usdcScaled * poolState.totalShares) / poolState.totalPool;
      }
      
      const tokenAddress = selectedAsset === 'USDC' ? USDC_TOKEN_ID : XLM_TOKEN_ID;
      const xdr = await buildRemoveLiquidityXDR(publicKey, tokenAddress, sharesToWithdraw);
      await signAndSubmit(xdr, publicKey);
      setWithdrawAmount('');
      
      const bal = await fetchBalances(publicKey);
      setBalances(bal);
      const state = await readPoolState(publicKey);
      setPoolState(state);
      setPendingAction(null);
      alert('Withdrawal successful!');
    } catch (e: unknown) {
      setPendingAction(null);
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculations
  const tvl = poolState.totalPool / DECIMALS;
  
  let userStakedUsdc = 0;
  if (poolState.totalShares > 0 && poolState.totalPool > 0) {
    userStakedUsdc = (poolState.userShares * poolState.totalPool) / poolState.totalShares / DECIMALS;
  }
  
  const userSharePercent = poolState.totalShares > 0 ? (poolState.userShares / poolState.totalShares) * 100 : 0;

  // UI State for Tabs
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');

  return (
    <main className="flex min-h-screen w-full flex-col bg-background">
      {/* Main Portfolio Content */}
      <div className="flex flex-col flex-1 p-6 lg:p-10 max-w-400 mx-auto w-full">
        
        {/* Header Section */}
        <div className="mb-8 flex flex-col gap-2">
          <h2 className="text-3xl font-bold text-white">Liquidity Provider Vault</h2>
          <p className="text-muted">Stake USDC to earn yield from trader losses, liquidations, and global funding rates.</p>
        </div>

        {/* Global Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-panel border border-border rounded-lg p-5">
            <div className="text-sm text-muted mb-1">Total Value Locked (TVL)</div>
            <div className="text-2xl font-mono font-bold text-white">${tvl.toLocaleString()} <span className="text-sm text-muted font-sans font-normal">USD</span></div>
          </div>
          <div className="bg-panel border border-border rounded-lg p-5">
            <div className="text-sm text-muted mb-1">Estimated APR</div>
            <div className="text-2xl font-mono font-bold text-green-500">TBD</div>
            <div className="text-xs text-muted mt-1">Based on 7-day average</div>
          </div>
          <div className="bg-panel border border-border rounded-lg p-5">
            <div className="text-sm text-muted mb-1">Total Shares Minted</div>
            <div className="text-2xl font-mono font-bold text-white">{(poolState.totalShares / DECIMALS).toLocaleString()}</div>
          </div>
          <div className="bg-panel border border-border rounded-lg p-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-brand/5 blur-xl"></div>
            <div className="relative">
              <div className="text-sm text-brand font-semibold mb-1">Your Pool Share</div>
              <div className="text-2xl font-mono font-bold text-brand">{userSharePercent.toFixed(4)}%</div>
            </div>
          </div>
        </div>

        {/* Main Grid: 2/3 Content, 1/3 Action Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Col: User Stats & Info */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            <div className="bg-panel border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-6 border-b border-border pb-4">My Position</h3>
              
              {!publicKey ? (
                <div className="flex items-center justify-center text-muted border border-dashed border-border rounded p-12 text-center">
                  Connect your wallet to view your staked liquidity.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  <div className="bg-background rounded-lg p-5 border border-border flex flex-col justify-center">
                    <div className="text-sm text-muted mb-2">My Staked USDC</div>
                    <div className="text-3xl font-mono text-white">${userStakedUsdc.toFixed(2)}</div>
                    <div className="text-xs text-brand mt-2">+ TBD PnL (Session)</div>
                  </div>

                  <div className="bg-background rounded-lg p-5 border border-border flex flex-col gap-4">
                    <div className="flex justify-between items-center text-sm border-b border-border/50 pb-2">
                      <span className="text-muted">Wallet Balance</span>
                      <span className="font-mono text-white">{balances ? balances.usdc : '0.00'} USDC</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-border/50 pb-2">
                      <span className="text-muted">LP Tokens Owned</span>
                      <span className="font-mono text-white">{(poolState.userShares / DECIMALS).toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted">Current Share Price</span>
                      <span className="font-mono text-white">
                        ${poolState.totalShares > 0 ? (tvl / (poolState.totalShares / DECIMALS)).toFixed(4) : '1.0000'}
                      </span>
                    </div>
                  </div>
                  
                </div>
              )}
            </div>

            {/* Explainer Box */}
            <div className="bg-panel border border-border rounded-lg p-6 text-sm text-muted leading-relaxed">
              <h4 className="text-white font-semibold mb-2">How it works</h4>
              <p className="mb-2">
                By depositing USDC into the Liquidity Provider Vault, you act as the counterparty to all traders on the exchange. 
                When traders open positions, your capital secures their trades.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>If traders lose money (liquidations, bad trades), those funds are added to the vault, increasing your share value.</li>
                <li>When the global funding rate is positive (Longs paying Shorts), the vault accrues the net difference if the skew is unbalanced.</li>
                <li>Your LP Tokens automatically appreciate in value. You can withdraw your initial deposit plus yield at any time.</li>
              </ul>
            </div>
          </div>

          {/* Right Col: Order-Entry Style Action Panel */}
          <div className="bg-panel border border-border rounded-lg overflow-hidden sticky top-6 shadow-2xl">
            
            {/* Tabs */}
            <div className="flex border-b border-border bg-background/50">
              <button 
                onClick={() => setActiveTab('deposit')}
                className={`flex-1 py-4 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'deposit' ? 'border-brand text-white bg-panel' : 'border-transparent text-muted hover:text-white'}`}
              >
                Deposit
              </button>
              <button 
                onClick={() => setActiveTab('withdraw')}
                className={`flex-1 py-4 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'withdraw' ? 'border-brand text-white bg-panel' : 'border-transparent text-muted hover:text-white'}`}
              >
                Withdraw
              </button>
            </div>

            <div className="p-6">
              {activeTab === 'deposit' ? (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted">Asset</span>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <button 
                        onClick={() => setSelectedAsset('USDC')}
                        className={`flex-1 py-2 rounded border text-sm font-semibold transition-colors ${selectedAsset === 'USDC' ? 'bg-brand/20 border-brand text-brand' : 'border-border text-muted hover:border-brand/50'}`}
                      >
                        USDC
                      </button>
                      <button 
                        onClick={() => setSelectedAsset('XLM')}
                        className={`flex-1 py-2 rounded border text-sm font-semibold transition-colors ${selectedAsset === 'XLM' ? 'bg-brand/20 border-brand text-brand' : 'border-border text-muted hover:border-brand/50'}`}
                      >
                        XLM
                      </button>
                    </div>

                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted">Amount to Deposit</span>
                      <span className="text-muted">Balance: <span className="text-white font-mono">{balances ? balances[selectedAsset.toLowerCase() as keyof typeof balances] : '0.00'}</span></span>
                    </div>
                    <div className="relative">
                      <input 
                        type="number" 
                        placeholder="0.00" 
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="w-full bg-background border border-border rounded px-4 py-3 text-lg text-white outline-none focus:border-brand transition-colors font-mono"
                      />
                      <span className="absolute right-4 top-3.5 font-bold text-muted">{selectedAsset}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 text-xs text-muted bg-background/50 p-4 rounded border border-border/50">
                    <div className="flex justify-between">
                      <span>Expected LP Tokens</span>
                      <span className="font-mono text-white">
                        {depositAmount && poolState.totalPool > 0 && poolState.totalShares > 0 
                          ? ((parseFloat(depositAmount) * poolState.totalShares) / poolState.totalPool).toFixed(4)
                          : depositAmount || '0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Entry Fee</span>
                      <span className="font-mono text-green-500">0.00%</span>
                    </div>
                  </div>

                  <button 
                    onClick={handleDeposit}
                    disabled={!publicKey || !depositAmount || isSubmitting}
                    className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-3.5 rounded transition-colors disabled:opacity-50 mt-2"
                  >
                    {pendingAction === 'deposit' ? 'Processing...' : !publicKey ? 'Connect Wallet' : `Deposit ${selectedAsset}`}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted">Asset to Receive</span>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <button 
                        onClick={() => setSelectedAsset('USDC')}
                        className={`flex-1 py-2 rounded border text-sm font-semibold transition-colors ${selectedAsset === 'USDC' ? 'bg-brand/20 border-brand text-brand' : 'border-border text-muted hover:border-brand/50'}`}
                      >
                        USDC
                      </button>
                      <button 
                        onClick={() => setSelectedAsset('XLM')}
                        className={`flex-1 py-2 rounded border text-sm font-semibold transition-colors ${selectedAsset === 'XLM' ? 'bg-brand/20 border-brand text-brand' : 'border-border text-muted hover:border-brand/50'}`}
                      >
                        XLM
                      </button>
                    </div>

                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted">Amount to Withdraw (in USD value)</span>
                      <span className="text-muted">Max: <span className="text-white font-mono">{userStakedUsdc.toFixed(2)}</span></span>
                    </div>
                    <div className="relative">
                      <input 
                        type="number" 
                        placeholder="0.00" 
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="w-full bg-background border border-border rounded px-4 py-3 text-lg text-white outline-none focus:border-brand transition-colors font-mono"
                      />
                      <span className="absolute right-4 top-3.5 font-bold text-muted">{selectedAsset} (USD)</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 text-xs text-muted bg-background/50 p-4 rounded border border-border/50">
                    <div className="flex justify-between">
                      <span>Shares Burned</span>
                      <span className="font-mono text-danger">
                        {withdrawAmount && poolState.totalPool > 0 && poolState.totalShares > 0 
                          ? ((parseFloat(withdrawAmount) * poolState.totalShares) / poolState.totalPool).toFixed(4)
                          : '0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Exit Fee</span>
                      <span className="font-mono text-green-500">0.00%</span>
                    </div>
                  </div>

                  <button 
                    onClick={handleWithdraw}
                    disabled={!publicKey || !withdrawAmount || isSubmitting || userStakedUsdc <= 0}
                    className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-3.5 rounded transition-colors disabled:opacity-50 mt-2"
                  >
                    {pendingAction === 'withdraw' ? 'Processing...' : !publicKey ? 'Connect Wallet' : `Withdraw ${selectedAsset}`}
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}
