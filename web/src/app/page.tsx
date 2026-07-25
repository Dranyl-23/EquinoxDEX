'use client';
import { useState, useEffect } from 'react';
import { useWalletContext } from '@/components/WalletProvider';
import { fetchBalances, Balances } from '@/lib/balances';
import { readPosition, readMarketState, Position, buildOpenPositionXDR, buildClosePositionXDR, buildTriggerOrdersXDR, contractConfigured } from '@/lib/contract';
import { signAndSubmit } from '@/lib/sign';
import { TradingChart } from '@/components/TradingChart';
import { MOCK_PRICE, DECIMALS, RPC_POLL_INTERVAL } from '@/lib/constants';

export default function Home() {
  const wallet = useWalletContext();
  const { publicKey} = wallet;
  const [leverage, setLeverage] = useState(10);
  const [positionType, setPositionType] = useState<'Long' | 'Short'>('Long');
  const [marginInput, setMarginInput] = useState('');
  const [tpInput, setTpInput] = useState('');
  const [slInput, setSlInput] = useState('');
  
  const [balances, setBalances] = useState<Balances | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [marketState, setMarketState] = useState({ long_oi: 0, short_oi: 0, global_funding: 0, total_volume: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Poll for balances, position, and market state
  useEffect(() => {
    if (!publicKey || !contractConfigured()) return;
    const load = async () => {
      try {
        const bal = await fetchBalances(publicKey);
        setBalances(bal);
        const pos = await readPosition(publicKey);
        setPosition(pos);
        const state = await readMarketState();
        setMarketState(state);
      } catch (e) {
        console.error(e);
      }
    };
    load();
    const interval = setInterval(load, RPC_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [publicKey]);

  const handleOpenPosition = async () => {
    if (!publicKey || !marginInput) return;
    setIsSubmitting(true);
    try {
      const marginScaled = parseFloat(marginInput) * DECIMALS;
      const tpScaled = tpInput ? parseFloat(tpInput) * DECIMALS : 0;
      const slScaled = slInput ? parseFloat(slInput) * DECIMALS : 0;
      
      const isLong = positionType === 'Long';
      const xdr = await buildOpenPositionXDR(publicKey, marginScaled, leverage, isLong, tpScaled, slScaled);
      await signAndSubmit(xdr, publicKey);
      
      setMarginInput('');
      setTpInput('');
      setSlInput('');
      
      // Fast refresh
      const pos = await readPosition(publicKey);
      setPosition(pos);
      const bal = await fetchBalances(publicKey);
      setBalances(bal);
      
    } catch (e: unknown) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClosePosition = async () => {
    if (!publicKey) return;
    setIsSubmitting(true);
    try {
      const xdr = await buildClosePositionXDR(publicKey);
      await signAndSubmit(xdr, publicKey);
      
      // Fast refresh
      setPosition(null);
      const bal = await fetchBalances(publicKey);
      setBalances(bal);
      
    } catch (e: unknown) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriggerKeeper = async () => {
    if (!publicKey) return;
    setIsSubmitting(true);
    try {
      const xdr = await buildTriggerOrdersXDR(publicKey, publicKey);
      await signAndSubmit(xdr, publicKey);
      
      setPosition(null);
      const bal = await fetchBalances(publicKey);
      setBalances(bal);
      alert('Keeper successfully triggered TP/SL! Position Closed.');
    } catch (e: unknown) {
      alert(`Keeper Trigger Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const marginVal = parseFloat(marginInput) || 0;
  const sizeVal = marginVal * leverage;
  const sizeInBtc = (sizeVal / MOCK_PRICE).toFixed(4);
  
  // Funding Skew Display Math
  const skew = marketState.long_oi - marketState.short_oi;
  const skewDisplay = (skew / DECIMALS).toLocaleString();
  const isSkewLong = skew > 0;
  const isSkewShort = skew < 0;
  
  // PnL Calc for active position
  let pnl = 0;
  let pnlPercent = 0;
  let fundingPnl = 0;
  
  if (position) {
    const rawMargin = position.margin / DECIMALS;
    const rawEntry = position.entry_price / DECIMALS;
    const priceDiff = position.is_long ? MOCK_PRICE - rawEntry : rawEntry - MOCK_PRICE;
    const pricePnl = (priceDiff * rawMargin * position.leverage) / rawEntry;
    
    // Funding Rate PnL (scaled by position size, matching contract math)
    const rawCurrentFunding = marketState.global_funding / DECIMALS;
    const rawEntryFunding = position.funding_index_at_entry / DECIMALS;
    const fundingDiff = rawCurrentFunding - rawEntryFunding;
    const positionSize = rawMargin * position.leverage;
    
    fundingPnl = position.is_long 
      ? -(fundingDiff * positionSize) / 1000 
      : (fundingDiff * positionSize) / 1000;
    
    pnl = pricePnl + fundingPnl;
    pnlPercent = (pnl / rawMargin) * 100;
  }

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden">
      {/* Main Trading Area */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Side: Chart and Positions */}
        <div className="flex flex-1 flex-col border-r border-border">
          {/* Top: Chart Area Placeholder */}
          <div className="flex-1 bg-background flex flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-panel/50">
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold">BTC-USDC</span>
                <span className="text-xl font-mono text-green-500">${MOCK_PRICE.toLocaleString()}</span>
              </div>
              <div className="text-xs text-muted flex gap-4 bg-background px-3 py-1.5 rounded-lg border border-border">
                <div className="flex flex-col border-r border-border pr-3">
                  <span className="text-muted/70 mb-0.5">Total Volume</span>
                  <span className="font-mono text-white">${(marketState.total_volume / DECIMALS).toLocaleString()}</span>
                </div>
                <div className="flex flex-col border-r border-border pr-3 pl-1">
                  <span className="text-muted/70 mb-0.5">Global Skew</span>
                  <span className={`font-mono font-bold ${isSkewLong ? 'text-brand' : isSkewShort ? 'text-danger' : 'text-white'}`}>
                    {skew === 0 ? 'Balanced' : `${isSkewLong ? 'Long' : 'Short'} $${Math.abs(Number(skewDisplay))}`}
                  </span>
                </div>
                <div className="flex flex-col pl-1">
                  <span className="text-muted/70 mb-0.5">Acc. Funding Index</span>
                  <span className="font-mono text-white">{marketState.global_funding / DECIMALS} USDC / Unit</span>
                </div>
              </div>
            </div>
            
            <div className="flex-1 flex items-center justify-center text-muted h-full w-full">
              <TradingChart />
            </div>
          </div>

          {/* Bottom: Positions Dashboard */}
          <div className="h-64 border-t border-border bg-panel flex flex-col">
            <div className="flex gap-4 px-4 py-2 border-b border-border text-sm font-medium">
              <button className="text-white border-b-2 border-brand pb-2 -mb-2.25">Positions</button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="w-full border border-border rounded-lg bg-background overflow-hidden h-full flex flex-col">
                <table className="w-full text-left text-sm">
                  <thead className="bg-panel/50 text-muted border-b border-border">
                    <tr>
                      <th className="px-4 py-2 font-medium">Market</th>
                      <th className="px-4 py-2 font-medium">Size</th>
                      <th className="px-4 py-2 font-medium">Margin</th>
                      <th className="px-4 py-2 font-medium">Entry Price</th>
                      <th className="px-4 py-2 font-medium">TP / SL</th>
                      <th className="px-4 py-2 font-medium">PnL</th>
                      <th className="px-4 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!publicKey ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
                          Connect wallet to view positions.
                        </td>
                      </tr>
                    ) : !position ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
                          No open positions yet.
                        </td>
                      </tr>
                    ) : (
                      <tr className="border-b border-border/50 last:border-0 hover:bg-panel/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-bold text-white">BTC-USDC</span>
                          <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded ${position.is_long ? 'bg-brand/20 text-brand' : 'bg-danger/20 text-danger'}`}>
                            {position.leverage}x {position.is_long ? 'Long' : 'Short'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono">{((position.margin/10000000) * position.leverage / MOCK_PRICE).toFixed(4)} BTC</td>
                        <td className="px-4 py-3 font-mono">{position.margin / 10000000} USDC</td>
                        <td className="px-4 py-3 font-mono">${(position.entry_price / 10000000).toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">
                          {position.take_profit > 0 ? <span className="text-brand">TP: ${(position.take_profit/10000000).toLocaleString()}</span> : 'No TP'}<br/>
                          {position.stop_loss > 0 ? <span className="text-danger">SL: ${(position.stop_loss/10000000).toLocaleString()}</span> : 'No SL'}
                        </td>
                        <td className={`px-4 py-3 font-mono ${pnl >= 0 ? 'text-brand' : 'text-danger'}`}>
                          {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({pnlPercent.toFixed(2)}%)
                          <div className="text-xs text-muted font-sans mt-0.5" title="Funding PnL">
                            Funding: {fundingPnl >= 0 ? '+' : ''}{fundingPnl.toFixed(2)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={handleTriggerKeeper}
                              disabled={isSubmitting}
                              className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/40 px-3 py-1.5 rounded text-xs transition-colors disabled:opacity-50"
                              title="Simulate a Keeper Bot checking TP/SL targets"
                            >
                              Simulate Keeper
                            </button>
                            <button 
                              onClick={handleClosePosition}
                              disabled={isSubmitting}
                              className="bg-border hover:bg-border/80 text-white px-3 py-1.5 rounded text-xs transition-colors disabled:opacity-50"
                            >
                              Close
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Order Entry Panel */}
        <div className="w-[320px] bg-panel flex flex-col overflow-y-auto border-l border-border">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <span className="font-semibold">Place Order</span>
          </div>
          
          <div className="p-4 flex flex-col gap-5">
            
            {/* Long / Short Toggle */}
            <div className="flex bg-background rounded p-1 gap-1">
              <button 
                onClick={() => setPositionType('Long')}
                className={`flex-1 py-1.5 text-sm font-semibold rounded transition-colors ${positionType === 'Long' ? 'bg-brand text-white' : 'text-muted hover:text-white'}`}
              >
                Long
              </button>
              <button 
                onClick={() => setPositionType('Short')}
                className={`flex-1 py-1.5 text-sm font-semibold rounded transition-colors ${positionType === 'Short' ? 'bg-danger text-white' : 'text-muted hover:text-white'}`}
              >
                Short
              </button>
            </div>

            {/* Margin Input */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs text-muted">
                <span>Margin (USDC)</span>
                <span>Available: {balances ? balances.xlm : '0.00'}</span>
              </div>
              <div className="relative">
                <input 
                  type="number" 
                  placeholder="0.00" 
                  value={marginInput}
                  onChange={(e) => setMarginInput(e.target.value)}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-white outline-none focus:border-brand transition-colors font-mono"
                />
                <span className="absolute right-3 top-2.5 text-sm text-muted">USDC</span>
              </div>
            </div>

            {/* Leverage Slider */}
            <div className="flex flex-col gap-1.5 mt-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Leverage</span>
                <span className="text-white font-mono">{leverage}x</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="50" 
                value={leverage} 
                onChange={(e) => setLeverage(parseInt(e.target.value))}
                className="w-full accent-brand"
              />
            </div>
            
            <div className="border-t border-border/50 pt-4 mt-2">
              <span className="text-xs font-semibold text-muted mb-2 block">Advanced Orders (Optional)</span>
              
              {/* Take Profit */}
              <div className="flex flex-col gap-1.5 mb-3">
                <div className="flex justify-between text-xs text-muted">
                  <span>Take Profit Price</span>
                </div>
                <div className="relative">
                  <input 
                    type="number" 
                    placeholder="None" 
                    value={tpInput}
                    onChange={(e) => setTpInput(e.target.value)}
                    className="w-full bg-background border border-border rounded px-3 py-2 text-white outline-none focus:border-brand transition-colors font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-sm text-muted">$</span>
                </div>
              </div>

              {/* Stop Loss */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs text-muted">
                  <span>Stop Loss Price</span>
                </div>
                <div className="relative">
                  <input 
                    type="number" 
                    placeholder="None" 
                    value={slInput}
                    onChange={(e) => setSlInput(e.target.value)}
                    className="w-full bg-background border border-border rounded px-3 py-2 text-white outline-none focus:border-brand transition-colors font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-sm text-muted">$</span>
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border text-sm">
              <div className="flex justify-between">
                <span className="text-muted text-xs">Position Size</span>
                <span className="font-mono text-white">{sizeInBtc} BTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted text-xs">Value</span>
                <span className="font-mono text-white">${sizeVal.toLocaleString()}</span>
              </div>
            </div>

            {/* Submit Button */}
            <button 
              onClick={handleOpenPosition}
              disabled={!publicKey || !marginVal || isSubmitting || position !== null}
              className={`w-full py-3 rounded font-bold text-white transition-colors mt-2
                ${positionType === 'Long' ? 'bg-brand hover:bg-brand-hover' : 'bg-danger hover:bg-danger-hover'}
                ${(!publicKey || !marginVal || isSubmitting || position !== null) ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {isSubmitting ? 'Processing...' : 
               !publicKey ? 'Connect Wallet' : 
               position !== null ? 'Position Already Open' :
               `${positionType === 'Long' ? 'Buy / Long' : 'Sell / Short'}`}
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}
