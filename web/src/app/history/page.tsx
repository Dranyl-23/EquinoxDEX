'use client';
import { useState } from 'react';
import { useWalletContext } from '@/components/WalletProvider';

interface TradeLog {
  id: string;
  market: string;
  type: 'Long' | 'Short';
  sizeBtc: string;
  marginUsdc: number;
  entryPrice: number;
  exitPrice: number;
  pnlUsdc: number;
  pnlPercent: number;
  feePaid: number;
  timestamp: string;
  txHash: string;
}

const MOCK_HISTORY: TradeLog[] = [
  {
    id: '1',
    market: 'EQX-PERP',
    type: 'Long',
    sizeBtc: '0.0229',
    marginUsdc: 150,
    entryPrice: 60000,
    exitPrice: 65370,
    pnlUsdc: 140.09,
    pnlPercent: 93.40,
    feePaid: 0.45,
    timestamp: '2026-07-27 14:10',
    txHash: 'a89c...41e2',
  },
  {
    id: '2',
    market: 'XLM-PERP',
    type: 'Long',
    sizeBtc: '0.0500',
    marginUsdc: 100,
    entryPrice: 64100,
    exitPrice: 64850,
    pnlUsdc: 58.50,
    pnlPercent: 58.50,
    feePaid: 0.30,
    timestamp: '2026-07-26 18:24',
    txHash: 'f412...91ab',
  },
  {
    id: '3',
    market: 'BTC-PERP',
    type: 'Short',
    sizeBtc: '0.0150',
    marginUsdc: 50,
    entryPrice: 65800,
    exitPrice: 65200,
    pnlUsdc: 45.00,
    pnlPercent: 90.00,
    feePaid: 0.15,
    timestamp: '2026-07-25 11:15',
    txHash: 'c701...12ef',
  },
];

export default function TradeHistoryPage() {
  const wallet = useWalletContext();
  const { publicKey } = wallet;
  const [selectedAsset, setSelectedAsset] = useState<string>('ALL');

  const filteredHistory = selectedAsset === 'ALL'
    ? MOCK_HISTORY
    : MOCK_HISTORY.filter((h) => h.market === selectedAsset);

  const totalTrades = MOCK_HISTORY.length;
  const winningTrades = MOCK_HISTORY.filter((h) => h.pnlUsdc > 0).length;
  const winRate = ((winningTrades / totalTrades) * 100).toFixed(1);
  const totalRealizedPnl = MOCK_HISTORY.reduce((acc, curr) => acc + curr.pnlUsdc, 0);

  return (
    <main className="flex min-h-screen w-full flex-col bg-background text-white">
      <div className="flex flex-col flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full gap-8">
        
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4l3 3" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                Trade History & Analytics
                <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                  On-Chain Verified
                </span>
              </h1>
              <p className="text-sm text-muted mt-1">
                Lifetime trade audit logs, execution fill history, and performance statistics on EquinoxDEX.
              </p>
            </div>
          </div>
        </div>

        {/* Analytics Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-panel/70 border border-border/60 rounded-xl p-5 backdrop-blur-md">
            <div className="text-xs text-muted font-medium uppercase tracking-wider">Total Realized PnL</div>
            <div className="text-2xl font-mono font-bold text-emerald-400 mt-2">+${totalRealizedPnl.toFixed(2)} USDC</div>
            <div className="text-[11px] text-muted font-mono mt-1">Net Lifetime Profits</div>
          </div>

          <div className="bg-panel/70 border border-border/60 rounded-xl p-5 backdrop-blur-md">
            <div className="text-xs text-muted font-medium uppercase tracking-wider">Win Rate</div>
            <div className="text-2xl font-mono font-bold text-white mt-2">{winRate}%</div>
            <div className="text-[11px] text-emerald-400 font-mono mt-1">{winningTrades} of {totalTrades} Winning Trades</div>
          </div>

          <div className="bg-panel/70 border border-border/60 rounded-xl p-5 backdrop-blur-md">
            <div className="text-xs text-muted font-medium uppercase tracking-wider">Total Trades Executed</div>
            <div className="text-2xl font-mono font-bold text-white mt-2">{totalTrades}</div>
            <div className="text-[11px] text-purple-300 font-mono mt-1">100% 1-Click Execution</div>
          </div>

          <div className="bg-panel/70 border border-border/60 rounded-xl p-5 backdrop-blur-md">
            <div className="text-xs text-muted font-medium uppercase tracking-wider">Average Profit / Trade</div>
            <div className="text-2xl font-mono font-bold text-emerald-400 mt-2">+${(totalRealizedPnl / totalTrades).toFixed(2)} USDC</div>
            <div className="text-[11px] text-muted font-mono mt-1">Per Closed Position</div>
          </div>
        </div>

        {/* Trade Logs Table Card */}
        <div className="bg-panel/70 border border-border/60 rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl flex flex-col">
          
          {/* Table Filters */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-border/60 bg-panel/30">
            <h2 className="text-base font-bold text-white">Execution Logs</h2>
            <div className="flex gap-2">
              {['ALL', 'EQX-PERP', 'XLM-PERP', 'BTC-PERP'].map((asset) => (
                <button
                  key={asset}
                  onClick={() => setSelectedAsset(asset)}
                  className={`px-3 py-1 text-xs font-mono font-semibold rounded-lg transition-all ${
                    selectedAsset === asset
                      ? 'bg-brand text-white shadow-sm'
                      : 'bg-background text-muted hover:text-white border border-border/60'
                  }`}
                >
                  {asset}
                </button>
              ))}
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel/60 text-muted border-b border-border/60 text-xs uppercase tracking-wider font-mono">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Date & Time</th>
                  <th className="px-6 py-3.5 font-semibold">Market</th>
                  <th className="px-6 py-3.5 font-semibold">Type</th>
                  <th className="px-6 py-3.5 font-semibold">Entry / Exit</th>
                  <th className="px-6 py-3.5 font-semibold">Margin Used</th>
                  <th className="px-6 py-3.5 font-semibold">Realized PnL</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Soroban TX</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {!publicKey ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-muted text-sm font-sans">
                      Connect wallet to view trade history.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((row) => (
                    <tr key={row.id} className="hover:bg-panel/40 transition-colors">
                      <td className="px-6 py-4 text-xs text-muted">{row.timestamp}</td>
                      <td className="px-6 py-4 font-bold text-white">{row.market}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded ${
                          row.type === 'Long' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-white">
                        ${row.entryPrice.toLocaleString()} → ${row.exitPrice.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-white">${row.marginUsdc} USDC</td>
                      <td className="px-6 py-4 font-bold text-emerald-400">
                        +${row.pnlUsdc.toFixed(2)} ({row.pnlPercent.toFixed(2)}%)
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-xs text-purple-400 hover:text-purple-300 underline cursor-pointer">
                          {row.txHash} ↗
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>
    </main>
  );
}
