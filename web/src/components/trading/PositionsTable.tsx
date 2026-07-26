'use client';
import React, { useState } from 'react';
import { Position, Order } from '@/lib/contract';
import { DECIMALS } from '@/lib/constants';

interface PositionsTableProps {
  publicKey: string | null;
  position: Position | null;
  pendingPosition: Position | null;
  limitOrders: Order[];
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  fundingPnl: number;
  isSubmitting: boolean;
  onClosePosition: (pct?: number) => Promise<void>;
  onTriggerKeeper: () => Promise<void>;
  onSharePnL: () => void;
}

export const PositionsTable: React.FC<PositionsTableProps> = ({
  publicKey,
  position,
  pendingPosition,
  limitOrders,
  currentPrice,
  pnl,
  pnlPercent,
  fundingPnl,
  isSubmitting,
  onClosePosition,
  onTriggerKeeper,
  onSharePnL,
}) => {
  const [showCloseModal, setShowCloseModal] = useState(false);

  return (
    <div className="h-72 border-t border-border/50 bg-panel/40 backdrop-blur-md flex flex-col z-10">
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
                  <td className="px-4 py-3 font-mono">{currentPrice > 0 ? ((position.margin / DECIMALS) * position.leverage / currentPrice).toFixed(4) : "..."} BTC</td>
                  <td className="px-4 py-3 font-mono">{position.margin / DECIMALS} USDC</td>
                  <td className="px-4 py-3 font-mono">${(position.entry_price / DECIMALS).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {position.take_profit > 0 ? <span className="text-brand">TP: ${(position.take_profit / DECIMALS).toLocaleString()}</span> : 'No TP'}<br/>
                    {position.stop_loss > 0 ? <span className="text-danger">SL: ${(position.stop_loss / DECIMALS).toLocaleString()}</span> : 'No SL'}
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
                        onClick={onSharePnL}
                        className="bg-brand/20 text-brand hover:bg-brand/40 px-3 py-1.5 rounded text-xs transition-colors border border-brand/50"
                        title="Share your PnL on Twitter/X"
                      >
                        Share PnL
                      </button>
                      <button 
                        onClick={onTriggerKeeper}
                        disabled={isSubmitting}
                        className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/40 px-3 py-1.5 rounded text-xs transition-colors disabled:opacity-50"
                        title="Simulate a Keeper Bot checking TP/SL targets"
                      >
                        Simulate Keeper
                      </button>
                      {showCloseModal ? (
                        <div className="flex gap-1 items-center bg-background border border-border rounded p-1">
                          {[25, 50, 75, 100].map(pct => (
                            <button
                              key={pct}
                              onClick={() => {
                                onClosePosition(pct);
                                setShowCloseModal(false);
                              }}
                              disabled={isSubmitting}
                              className="px-2 py-1 hover:bg-panel rounded text-xs"
                            >
                              {pct}%
                            </button>
                          ))}
                          <button onClick={() => setShowCloseModal(false)} className="px-2 py-1 text-danger hover:bg-danger/20 rounded">✕</button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setShowCloseModal(true)}
                          disabled={isSubmitting}
                          className="bg-border hover:bg-border/80 text-white px-3 py-1.5 rounded text-xs transition-colors disabled:opacity-50"
                        >
                          Close Position
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {pendingPosition && (
                <tr className="border-b border-border/50 last:border-0 bg-panel/30 animate-pulse">
                  <td className="px-4 py-3">
                    <span className="font-bold text-white">BTC-USDC</span>
                    <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded ${pendingPosition.is_long ? 'bg-brand/20 text-brand' : 'bg-danger/20 text-danger'}`}>
                      {pendingPosition.leverage}x {pendingPosition.is_long ? 'Long' : 'Short'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted">
                    {currentPrice > 0 ? ((pendingPosition.margin / DECIMALS) * pendingPosition.leverage / currentPrice).toFixed(4) : "..."} BTC
                  </td>
                  <td className="px-4 py-3 font-mono text-muted">{pendingPosition.margin / DECIMALS} USDC</td>
                  <td className="px-4 py-3 font-mono text-muted">Opening...</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {pendingPosition.take_profit > 0 ? <span className="text-brand/50">TP: ${(pendingPosition.take_profit / DECIMALS).toLocaleString()}</span> : 'No TP'}<br/>
                    {pendingPosition.stop_loss > 0 ? <span className="text-danger/50">SL: ${(pendingPosition.stop_loss / DECIMALS).toLocaleString()}</span> : 'No SL'}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted">-</td>
                  <td className="px-4 py-3 text-right text-xs text-muted italic">Pending...</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Open Orders Table */}
          <div className="mt-4 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold mb-2 text-white px-4">Open Orders</h3>
            <table className="w-full text-left text-sm">
              <thead className="bg-panel/50 text-muted border-b border-border">
                <tr>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Size</th>
                  <th className="px-4 py-2 font-medium">Trigger Price</th>
                  <th className="px-4 py-2 font-medium">TP / SL</th>
                </tr>
              </thead>
              <tbody>
                {limitOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-sm text-muted">
                      No open limit orders.
                    </td>
                  </tr>
                ) : (
                  limitOrders.map((order, idx) => (
                    <tr key={idx} className="border-b border-border/50 last:border-0 hover:bg-panel/30 transition-colors">
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
};
