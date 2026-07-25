'use client';
import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import ConnectWallet from '@/components/ConnectWallet';

export default function Home() {
  const wallet = useWallet();
  const { publicKey } = wallet;
  const [leverage, setLeverage] = useState(10);
  const [positionType, setPositionType] = useState<'Long' | 'Short'>('Long');

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden">
      {/* Top Navbar */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-panel px-4">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold tracking-tight text-white">SmartMargin</h1>
          <nav className="flex gap-4 text-sm font-medium text-muted">
            <a href="#" className="text-white">Trade</a>
            <a href="#" className="hover:text-white transition-colors">Portfolio</a>
            <a href="#" className="hover:text-white transition-colors">Vaults</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted">Testnet</div>
          <ConnectWallet {...wallet} />
        </div>
      </header>

      {/* Main Trading Area */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Side: Chart and Positions */}
        <div className="flex flex-1 flex-col border-r border-border">
          {/* Top: Chart Area Placeholder */}
          <div className="flex-1 bg-background flex flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-panel/50">
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold">BTC-USDC</span>
                <span className="text-xl font-mono text-green-500">$64,230.50</span>
              </div>
              <div className="flex gap-6 text-sm">
                <div className="flex flex-col">
                  <span className="text-muted text-xs">24h Change</span>
                  <span className="text-green-500">+2.45%</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted text-xs">Funding Rate</span>
                  <span className="text-brand">0.01% / 1h</span>
                </div>
              </div>
            </div>
            
            <div className="flex-1 flex items-center justify-center text-muted">
              {/* This is where a TradingView chart would go */}
              <div className="animate-pulse flex flex-col items-center">
                <div className="w-64 h-32 bg-border/20 rounded-lg border border-border/50 flex items-center justify-center">
                  Chart Loading...
                </div>
              </div>
            </div>
          </div>

          {/* Bottom: Positions Dashboard */}
          <div className="h-64 border-t border-border bg-panel flex flex-col">
            <div className="flex gap-4 px-4 py-2 border-b border-border text-sm font-medium">
              <button className="text-white border-b-2 border-brand pb-2 -mb-[9px]">Positions</button>
              <button className="text-muted hover:text-white pb-2">Orders (0)</button>
              <button className="text-muted hover:text-white pb-2">History</button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {publicKey ? (
                <div className="text-sm text-muted flex items-center justify-center h-full border border-dashed border-border rounded">
                  No open positions yet.
                </div>
              ) : (
                <div className="text-sm text-muted flex items-center justify-center h-full">
                  Connect wallet to view positions.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Order Entry Panel */}
        <div className="w-[320px] bg-panel flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <span className="font-semibold">Place Order</span>
            <span className="text-xs text-muted font-mono">Margin: USDC</span>
          </div>
          
          <div className="p-4 flex flex-col gap-6">
            
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

            {/* Order Type */}
            <div className="flex gap-2">
               <button className="flex-1 border border-brand text-brand py-1 text-sm rounded bg-brand/10">Market</button>
               <button className="flex-1 border border-border text-muted hover:text-white py-1 text-sm rounded transition-colors">Limit</button>
            </div>

            {/* Size Input */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs text-muted">
                <span>Size</span>
                <span>Available: {publicKey ? '1,000.00 USDC' : '0.00 USDC'}</span>
              </div>
              <div className="relative">
                <input 
                  type="number" 
                  placeholder="0.00" 
                  className="w-full bg-background border border-border rounded px-3 py-2 text-white outline-none focus:border-brand transition-colors font-mono"
                />
                <span className="absolute right-3 top-2.5 text-sm text-muted">BTC</span>
              </div>
            </div>

            {/* Leverage Slider */}
            <div className="flex flex-col gap-2 mt-2">
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
              <div className="flex justify-between text-xs text-muted mt-1">
                <span>1x</span>
                <span>10x</span>
                <span>25x</span>
                <span>50x</span>
              </div>
            </div>

            {/* Order Summary */}
            <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border text-sm">
              <div className="flex justify-between">
                <span className="text-muted text-xs">Margin Required</span>
                <span className="font-mono text-white">0.00 USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted text-xs">Est. Liq Price</span>
                <span className="font-mono text-white">-</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted text-xs">Fees (0.05%)</span>
                <span className="font-mono text-white">0.00 USDC</span>
              </div>
            </div>

            {/* Submit Button */}
            <button 
              className={`w-full py-3 rounded font-bold text-white transition-colors mt-2
                ${positionType === 'Long' ? 'bg-brand hover:bg-brand-hover' : 'bg-danger hover:bg-danger-hover'}
                ${!publicKey ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              disabled={!publicKey}
            >
              {publicKey 
                ? `${positionType === 'Long' ? 'Buy / Long' : 'Sell / Short'}` 
                : 'Connect Wallet to Trade'
              }
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}
