'use client';
import { useState, useEffect } from 'react';
import { useWalletContext } from '@/components/WalletProvider';
import { readTradeHistory, TradeRecord, contractConfigured } from '@/lib/contract';
import { DECIMALS } from '@/lib/constants';
import { useLanguage } from '@/components/LanguageProvider';

export default function TradeHistoryPage() {
  const { t, formatNum } = useLanguage();
  const wallet = useWalletContext();
  const { publicKey } = wallet;

  const [history, setHistory] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<string>('ALL');

  useEffect(() => {
    if (!publicKey || !contractConfigured()) return;
    setLoading(true);
    readTradeHistory(publicKey)
      .then(setHistory)
      .finally(() => setLoading(false));
  }, [publicKey]);

  // Derived stats from real on-chain data
  const totalTrades = history.length;
  const winningTrades = history.filter((h) => h.pnl > 0).length;
  const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : '0.0';
  const totalRealizedPnl = history.reduce((acc, curr) => acc + curr.pnl / DECIMALS, 0);

  // Get unique markets from history for filter
  const markets = ['ALL', ...Array.from(new Set(history.map((h) => `POS-${h.positionId}`)))];
  const filteredHistory =
    selectedMarket === 'ALL'
      ? history
      : history.filter((h) => `POS-${h.positionId}` === selectedMarket);

  const formatTimestamp = (ts: number) => {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleString();
  };

  const truncateHash = (hash: string) => {
    if (!hash) return '—';
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  return (
    <main className="flex min-h-screen w-full flex-col bg-background">
      <div className="flex flex-col flex-1 p-6 lg:p-10 max-w-400 mx-auto w-full">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-2">
          <h2 className="text-3xl font-bold text-white">{t('tradeLog')}</h2>
          <p className="text-muted">
            Complete on-chain record of all your closed positions. Data is read directly from Soroban contract events.
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-panel border border-border rounded-lg p-5">
            <div className="text-sm text-muted mb-1">{t('realizedPnl')}</div>
            <div className={`text-2xl font-mono font-bold ${totalRealizedPnl >= 0 ? 'text-brand' : 'text-danger'}`}>
              {totalRealizedPnl >= 0 ? '+' : ''}{formatNum(totalRealizedPnl, 2)}{' '}
              <span className="text-sm text-muted font-sans font-normal">USDC</span>
            </div>
          </div>

          <div className="bg-panel border border-border rounded-lg p-5">
            <div className="text-sm text-muted mb-1">{t('winRate')}</div>
            <div className="text-2xl font-mono font-bold text-white">{winRate}%</div>
            <div className="text-xs text-muted mt-1">{winningTrades}/{totalTrades} trades</div>
          </div>

          <div className="bg-panel border border-border rounded-lg p-5">
            <div className="text-sm text-muted mb-1">{t('totalTrades')}</div>
            <div className="text-2xl font-mono font-bold text-white">{totalTrades}</div>
            <div className="text-xs text-muted mt-1">Closed positions</div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs text-muted">{t('filterByMarket')}:</span>
          {markets.slice(0, 6).map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMarket(m)}
              className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-colors border ${
                selectedMarket === m
                  ? 'bg-brand/20 border-brand text-brand'
                  : 'border-border text-muted hover:text-white hover:border-brand/50'
              }`}
            >
              {m === 'ALL' ? t('allMarkets') : m}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background/60 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-muted font-semibold uppercase tracking-wider">Position ID</th>
                <th className="px-4 py-3 text-left text-xs text-muted font-semibold uppercase tracking-wider">Margin Closed</th>
                <th className="px-4 py-3 text-left text-xs text-muted font-semibold uppercase tracking-wider">{t('exitPrice')}</th>
                <th className="px-4 py-3 text-left text-xs text-muted font-semibold uppercase tracking-wider">Realized PnL</th>
                <th className="px-4 py-3 text-left text-xs text-muted font-semibold uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-left text-xs text-muted font-semibold uppercase tracking-wider">{t('txHash')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted">
                    Loading trade history...
                  </td>
                </tr>
              ) : !publicKey ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted">
                    Connect wallet to view your trade history
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted">
                    No closed trades yet. Close a position to see history here.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((trade) => {
                  const pnlUsdc = trade.pnl / DECIMALS;
                  const marginUsdc = trade.marginClosed / DECIMALS;
                  return (
                    <tr key={trade.id} className="hover:bg-panel/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-white font-bold">#{trade.positionId}</td>
                      <td className="px-4 py-3 font-mono">{formatNum(marginUsdc, 2)} USDC</td>
                      <td className="px-4 py-3 font-mono text-muted">—</td>
                      <td className={`px-4 py-3 font-mono font-semibold ${pnlUsdc >= 0 ? 'text-brand' : 'text-danger'}`}>
                        {pnlUsdc >= 0 ? '+' : ''}{formatNum(pnlUsdc, 2)} USDC
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{formatTimestamp(trade.timestamp)}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {trade.txHash ? (
                          <a
                            href={`https://stellar.expert/explorer/testnet/tx/${trade.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand hover:underline"
                          >
                            {truncateHash(trade.txHash)}
                          </a>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>
    </main>
  );
}
