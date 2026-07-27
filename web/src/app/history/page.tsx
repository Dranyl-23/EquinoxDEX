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

import { useLanguage } from '@/components/LanguageProvider';

export default function TradeHistoryPage() {
  const { t, formatNum } = useLanguage();
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
    <main className="flex min-h-screen w-full flex-col bg-background">
      <div className="flex flex-col flex-1 p-6 lg:p-10 max-w-400 mx-auto w-full">
        
        {/* Header */}
        <div className="mb-8 flex flex-col gap-2">
          <h2 className="text-3xl font-bold text-white">{t('tradeLog')}</h2>
          <p className="text-muted">
            Lifetime trade audit logs, execution fill history, and performance statistics on EquinoxDEX.
          </p>
        </div>

        {/* Global Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-panel border border-border rounded-lg p-5">
            <div className="text-sm text-muted mb-1">{t('realizedPnl')}</div>
            <div className="text-2xl font-mono font-bold text-green-500">+${totalRealizedPnl.toFixed(2)} <span className="text-sm text-muted font-sans font-normal">USDC</span></div>
          </div>

          <div className="bg-panel border border-border rounded-lg p-5">
            <div className="text-sm text-muted mb-1">{t('winRate')}</div>
            <div className="text-2xl font-mono font-bold text-white">{winRate}%</div>
            <div className="text-xs text-muted mt-1">{winningTrades} of {totalTrades} winning trades</div>
          </div>

          <div className="bg-panel border border-border rounded-lg p-5">
            <div className="text-sm text-muted mb-1">{t('totalTrades')}</div>
            <div className="text-2xl font-mono font-bold text-white">{totalTrades}</div>
          </div>

          <div className="bg-panel border border-border rounded-lg p-5">
            <div className="text-sm text-muted mb-1">Average Profit / Trade</div>
            <div className="text-2xl font-mono font-bold text-green-500">+${(totalRealizedPnl / totalTrades).toFixed(2)} <span className="text-sm text-muted font-sans font-normal">USDC</span></div>
          </div>
        </div>

        {/* Trade Logs Table Card */}
        <div className="bg-panel border border-border rounded-lg overflow-hidden flex flex-col">
          
          {/* Table Filters */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-background/50">
            <h3 className="text-base font-semibold text-white">Execution Logs</h3>
            <div className="flex gap-2">
              {['ALL', 'EQX-PERP', 'XLM-PERP', 'BTC-PERP'].map((asset) => (
                <button
                  key={asset}
                  onClick={() => setSelectedAsset(asset)}
                  className={`px-3 py-1 text-xs font-mono font-semibold rounded transition-all ${
                    selectedAsset === asset
                      ? 'bg-brand text-white shadow-sm'
                      : 'bg-background text-muted hover:text-white border border-border'
                  }`}
                >
                  {asset}
                </button>
              ))}
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50 text-muted text-xs uppercase tracking-wider font-mono">
                  <th className="py-4 px-6 font-semibold">Date & Time</th>
                  <th className="py-4 px-6 font-semibold">{t('market')}</th>
                  <th className="py-4 px-6 font-semibold">Type</th>
                  <th className="py-4 px-6 font-semibold">Entry / Exit</th>
                  <th className="py-4 px-6 font-semibold">{t('margin')}</th>
                  <th className="py-4 px-6 font-semibold">{t('realizedPnl')}</th>
                  <th className="py-4 px-6 font-semibold text-right">Soroban TX</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 font-mono">
                {!publicKey ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted text-sm font-sans">
                      Connect wallet to view trade history.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((row) => (
                    <tr key={row.id} className="hover:bg-background/40 transition-colors">
                      <td className="py-4 px-6 text-xs text-muted">{row.timestamp}</td>
                      <td className="py-4 px-6 font-bold text-white">{row.market}</td>
                      <td className="py-4 px-6">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          row.type === 'Long' ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-danger/20 text-danger border border-danger/30'
                        }`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-xs text-white">
                        ${row.entryPrice.toLocaleString()} → ${row.exitPrice.toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-white">${row.marginUsdc} USDC</td>
                      <td className="py-4 px-6 font-bold text-green-500">
                        +${row.pnlUsdc.toFixed(2)} ({row.pnlPercent.toFixed(2)}%)
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className="text-xs text-brand hover:underline cursor-pointer">
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
