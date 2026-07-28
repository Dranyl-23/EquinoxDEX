'use client';
import React, { useState } from 'react';
import { Position, Order } from '@/lib/contract';
import { DECIMALS } from '@/lib/constants';
import { useSettings } from '../SettingsProvider';
import { useLanguage } from '../LanguageProvider';

const deriveBaseAsset = (symbol: string): string => {
  if (!symbol) return 'BTC';
  const normalized = symbol.toUpperCase();
  const quoteSuffixes = ['USDT', 'USDC', 'USD', 'EUR', 'GBP'];
  for (const suffix of quoteSuffixes) {
    if (normalized.endsWith(suffix)) {
      return normalized.slice(0, normalized.length - suffix.length);
    }
  }
  return symbol;
};

interface PositionsTableProps {
  publicKey: string | null;
  position?: Position | null;
  positions?: Position[];
  pendingPosition: Position | null;
  limitOrders: Order[];
  currentPrice: number;
  globalFunding: number;
  pnl: number;
  pnlPercent: number;
  fundingPnl: number;
  isSubmitting: boolean;
  onClosePosition: (positionId: number, pct?: number) => Promise<void>;
  onSharePnL: () => void;
  onUpdateTrailingStop?: () => Promise<void>;
  onCancelOrder?: (index: number) => Promise<void>;
}

export const PositionsTable: React.FC<PositionsTableProps> = ({
  publicKey,
  position,
  positions = position ? [position] : [],
  pendingPosition,
  limitOrders,
  currentPrice,
  globalFunding,
  pnl,
  pnlPercent,
  fundingPnl,
  isSubmitting,
  onClosePosition,
  onSharePnL,
  onUpdateTrailingStop,
  onCancelOrder,
}) => {
  const { settings } = useSettings();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history'>('positions');
  const [selectedCloseId, setSelectedCloseId] = useState<number | null>(null);

  const displayPositions = positions.length > 0 ? positions : (position ? [position] : []);
  const activePositionCount = displayPositions.length + (pendingPosition ? 1 : 0);

  const handleClose = (posId?: number, pct?: number) => {
    if (typeof posId === 'number') {
      onClosePosition(posId, pct);
    }
  };

  return (
    <div className="h-72 border-t border-border/50 bg-panel/40 backdrop-blur-md flex flex-col z-10">
      {/* Header Tabs (Hyperliquid Institutional Style) */}
      <div className="flex gap-6 px-6 pt-3 border-b border-border/60 text-sm font-semibold select-none bg-panel/30">
        <button
          onClick={() => setActiveTab('positions')}
          className={`pb-2.5 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'positions'
              ? 'text-white border-brand font-bold'
              : 'text-muted hover:text-white border-transparent'
          }`}
        >
          <span>{t('positions') || 'Positions'}</span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
            activePositionCount > 0 ? 'bg-brand/20 text-brand font-bold' : 'bg-border text-muted'
          }`}>
            {activePositionCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-2.5 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'orders'
              ? 'text-white border-brand font-bold'
              : 'text-muted hover:text-white border-transparent'
          }`}
        >
          <span>{t('openOrders') || 'Open Orders'}</span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
            limitOrders.length > 0 ? 'bg-brand/20 text-brand font-bold' : 'bg-border text-muted'
          }`}>
            {limitOrders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-2.5 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'history'
              ? 'text-white border-brand font-bold'
              : 'text-muted hover:text-white border-transparent'
          }`}
        >
          <span>{t('tradeHistory') || 'Trade History (On-Chain)'}</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden p-2 sm:p-4">
        <div className="w-full border border-border/60 rounded-lg bg-background overflow-auto h-full flex flex-col shadow-inner">
          {activeTab === 'positions' && (
            <table className="w-full text-left text-sm min-w-[800px]">
              <thead className="bg-panel/60 text-muted border-b border-border/60 text-xs uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">{t('market') || 'Market'}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('size') || 'Size'}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('margin') || 'Margin'}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('entryPrice') || 'Entry Price'}</th>
                  <th className="px-4 py-2.5 font-semibold text-danger/90">{t('liqPrice') || 'Liq. Price'}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('editTpSl') || 'TP / SL'}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('pnl') || 'PnL'}</th>
                  <th className="px-4 py-2.5 font-semibold text-right">{t('action') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {!publicKey ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted">
                      Connect wallet to view positions.
                    </td>
                  </tr>
                ) : displayPositions.length === 0 && !pendingPosition ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted">
                      No open positions yet.
                    </td>
                  </tr>
                ) : (
                  <>
                    {displayPositions.map((pos) => {
                      const entryUsd = pos.entry_price / DECIMALS;
                      const rawMargin = pos.margin / DECIMALS;
                      const liqFrac = 0.98 / pos.leverage;
                      const liqPrice = pos.is_long 
                        ? entryUsd * (1 - liqFrac)
                        : entryUsd * (1 + liqFrac);
                      const positionSize = rawMargin * pos.leverage;
                      const priceDiff = pos.is_long ? currentPrice - entryUsd : entryUsd - currentPrice;
                      const pricePnl = entryUsd > 0 ? (priceDiff * positionSize) / entryUsd : 0;
                      const rawCurrentFunding = globalFunding / DECIMALS;
                      const rawEntryFunding = pos.funding_index_at_entry / DECIMALS;
                      const fundingDiff = rawCurrentFunding - rawEntryFunding;
                      const posFundingPnl = pos.is_long
                        ? -(fundingDiff * positionSize) / 10_000_000_000
                        : (fundingDiff * positionSize) / 10_000_000_000;
                      const positionPnl = pricePnl + posFundingPnl;
                      const baseAsset = deriveBaseAsset(pos.symbol || 'BTC');
 
                      return (
                        <tr key={pos.id || pos.symbol} className="hover:bg-panel/30 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-bold text-white">{pos.symbol || 'EQX-PERP'}</span>
                            <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded ${pos.is_long ? 'bg-brand/20 text-brand' : 'bg-danger/20 text-danger'}`}>
                              {pos.leverage}x {pos.is_long ? 'Long' : 'Short'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono">{currentPrice > 0 ? (positionSize / currentPrice).toFixed(4) : '...'} {baseAsset}</td>
                          <td className="px-4 py-3 font-mono">{rawMargin} USDC</td>
                          <td className="px-4 py-3 font-mono">${entryUsd.toLocaleString()}</td>
                          <td className="px-4 py-3 font-mono text-danger font-semibold" title="Cross-Margin Liquidation Trigger Price">
                            ${liqPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted">
                            {pos.take_profit > 0 ? <span className="text-brand">TP: ${(pos.take_profit / DECIMALS).toLocaleString()}</span> : 'No TP'}<br/>
                            {pos.stop_loss > 0 ? <span className="text-danger">SL: ${(pos.stop_loss / DECIMALS).toLocaleString()}</span> : 'No SL'}
                          </td>
                          <td className={`px-4 py-3 font-mono ${positionPnl >= 0 ? 'text-brand' : 'text-danger'}`}>
                            {settings?.hidePnl ? '****.** (****%)' : `${positionPnl >= 0 ? '+' : ''}${positionPnl.toFixed(2)} (${rawMargin > 0 ? ((positionPnl / rawMargin) * 100).toFixed(2) : '0.00'}%)`}
                            <div className="text-xs text-muted font-sans mt-0.5" title="Funding PnL">
                              Funding: {settings?.hidePnl ? '****.**' : `${posFundingPnl >= 0 ? '+' : ''}${posFundingPnl.toFixed(2)}`}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2 items-center">
                              <button 
                                onClick={onSharePnL}
                                className="bg-brand/20 text-brand hover:bg-brand/40 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border border-brand/40 shadow-sm"
                                title="Share your PnL on Twitter/X"
                              >
                                {t('sharePnl') || 'Share PnL'}
                              </button>
                              {pos.trailing_stop_distance > 0 && onUpdateTrailingStop && (
                                <button
                                  onClick={onUpdateTrailingStop}
                                  disabled={isSubmitting}
                                  className="bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/30 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border border-yellow-500/30 disabled:opacity-50"
                                  title={`Trailing stop: ${(pos.trailing_stop_distance / DECIMALS).toFixed(2)} USDC distance`}
                                >
                                  Update Trail
                                </button>
                              )}
                              {selectedCloseId === pos.id ? (
                                <div className="flex gap-1 items-center bg-panel border border-border/80 rounded-md p-1 shadow-lg">
                                  {[25, 50, 75, 100].map(pct => (
                                    <button
                                      key={pct}
                                      onClick={() => {
                                        handleClose(pos.id, pct);
                                        setSelectedCloseId(null);
                                      }}
                                      disabled={isSubmitting}
                                      className="px-2.5 py-1 hover:bg-brand hover:text-white rounded text-xs font-mono font-medium transition-colors"
                                    >
                                      {pct}%
                                    </button>
                                  ))}
                                  <button onClick={() => setSelectedCloseId(null)} className="px-2 py-1 text-danger hover:bg-danger/20 rounded font-bold">✕</button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => setSelectedCloseId(pos.id)}
                                  disabled={isSubmitting}
                                  className="bg-danger/20 text-danger hover:bg-danger hover:text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors border border-danger/40 disabled:opacity-50"
                                >
                                  {t('closePosition') || 'Close Position'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {pendingPosition && (
                      <tr className="bg-panel/30 animate-pulse">
                        <td className="px-4 py-3">
                          <span className="font-bold text-white">EQX-PERP</span>
                          <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded ${pendingPosition.is_long ? 'bg-brand/20 text-brand' : 'bg-danger/20 text-danger'}`}>
                            {pendingPosition.leverage}x {pendingPosition.is_long ? 'Long' : 'Short'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-muted">
                          {currentPrice > 0 ? ((pendingPosition.margin / DECIMALS) * pendingPosition.leverage / currentPrice).toFixed(4) : "..."} BTC
                        </td>
                        <td className="px-4 py-3 font-mono text-muted">{pendingPosition.margin / DECIMALS} USDC</td>
                        <td className="px-4 py-3 font-mono text-muted">Opening...</td>
                        <td className="px-4 py-3 font-mono text-muted text-xs">Computing...</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">
                          {pendingPosition.take_profit > 0 ? <span className="text-brand/50">TP: ${(pendingPosition.take_profit / DECIMALS).toLocaleString()}</span> : 'No TP'}<br/>
                          {pendingPosition.stop_loss > 0 ? <span className="text-danger/50">SL: ${(pendingPosition.stop_loss / DECIMALS).toLocaleString()}</span> : 'No SL'}
                        </td>
                        <td className="px-4 py-3 font-mono text-muted">-</td>
                        <td className="px-4 py-3 text-right text-xs text-muted italic">Pending...</td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'orders' ? (
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead className="bg-panel/60 text-muted border-b border-border/60 text-xs uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Type</th>
                  <th className="px-4 py-2.5 font-semibold">{t('size') || 'Size'}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('limitPrice') || 'Trigger Price'}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('editTpSl') || 'TP / SL'}</th>
                  <th className="px-4 py-2.5 font-semibold text-right">{t('action') || 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {!publicKey ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted">
                      Connect wallet to view limit orders.
                    </td>
                  </tr>
                ) : limitOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted">
                      No open limit orders.
                    </td>
                  </tr>
                ) : (
                  limitOrders.map((order, idx) => (
                    <tr key={idx} className="hover:bg-panel/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${order.is_long ? 'bg-brand/20 text-brand' : 'bg-danger/20 text-danger'}`}>
                          Limit {order.is_long ? 'Long' : 'Short'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">{order.margin / DECIMALS} USDC</td>
                      <td className="px-4 py-3 font-mono">${(order.trigger_price / DECIMALS).toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">
                        {order.take_profit > 0 ? <span className="text-brand">TP: ${(order.take_profit / DECIMALS).toLocaleString()}</span> : 'No TP'}<br/>
                        {order.stop_loss > 0 ? <span className="text-danger">SL: ${(order.stop_loss / DECIMALS).toLocaleString()}</span> : 'No SL'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {onCancelOrder && (
                          <button
                            onClick={() => onCancelOrder(idx)}
                            disabled={isSubmitting}
                            className="bg-panel border border-border/80 hover:bg-danger/20 hover:text-danger hover:border-danger/40 text-xs px-2.5 py-1 rounded transition-colors disabled:opacity-50"
                          >
                            {t('cancelOrder') || 'Cancel'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : activeTab === 'history' ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-sm text-muted">
              <p className="mb-4">Trade history is available on the dedicated history page.</p>
              <a
                href="/history"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand/20 text-brand font-semibold border border-brand/30 hover:bg-brand/30"
              >
                View Trade History
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
