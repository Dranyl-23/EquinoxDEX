'use client';
import React, { useState } from 'react';
import { Position } from '@/lib/contract';
import { Balances } from '@/lib/balances';
import { DECIMALS } from '@/lib/constants';
import { playOrderPlacedSound, playTradeExecutedSound } from '@/lib/sound';
import { useLanguage } from '../LanguageProvider';

export interface OrderFormProps {
  publicKey: string | null;
  balances: Balances | null;
  marginBalance: number;
  currentPrice: number;
  position: Position | null;
  pnl: number;
  isSubmitting: boolean;
  onOpenPosition: (params: {
    orderTab: 'Market' | 'Limit';
    positionType: 'Long' | 'Short';
    marginInput: string;
    leverage: number;
    triggerInput: string;
    tpInput: string;
    slInput: string;
    trailingInput: string;
  }) => Promise<void>;
  onDeposit: (amount: string) => Promise<void>;
  onWithdraw: (amount: string) => Promise<void>;
  is1ClickEnabled: boolean;
  onToggle1Click: () => Promise<void>;
  accountMode?: 'cross' | 'isolated' | 'portfolio';
  onOpenAccountModeModal?: () => void;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  balances,
  marginBalance,
  currentPrice,
  isSubmitting,
  onOpenPosition,
  onDeposit,
  onWithdraw,
  is1ClickEnabled,
  onToggle1Click,
  accountMode = 'cross',
  onOpenAccountModeModal,
}) => {
  const { t } = useLanguage();
  const [leverage, setLeverage] = useState(10);
  const [orderTab, setOrderTab] = useState<'Market' | 'Limit'>('Market');
  const [positionType, setPositionType] = useState<'Long' | 'Short'>('Long');
  const [marginInput, setMarginInput] = useState('');
  const [triggerInput, setTriggerInput] = useState('');
  const [tpInput, setTpInput] = useState('');
  const [slInput, setSlInput] = useState('');
  const [trailingInput, setTrailingInput] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [showTpSl, setShowTpSl] = useState(false);
  const [showCollateralDrawer, setShowCollateralDrawer] = useState(false);
  const [collateralTab, setCollateralTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [slippage, setSlippage] = useState<number>(0.5);

  const marginVal = parseFloat(marginInput);
  const isValidMargin = !isNaN(marginVal) && marginVal > 0;
  const sizeVal = isValidMargin ? marginVal * leverage : 0;
  const sizeInBtc = currentPrice > 0 ? (sizeVal / currentPrice).toFixed(4) : "0.0000";

  // Real-Time Price Impact Estimation (<0.01% for normal size, scaling linearly with order size)
  const priceImpactPercent = sizeVal > 0 ? Math.min((sizeVal / 500000) * 100, 2.5) : 0.01;

  // Estimated Liquidation Price Calculation
  const estEntryPrice = orderTab === 'Market' ? currentPrice : (parseFloat(triggerInput) || currentPrice);
  const liqFrac = 0.98 / leverage;
  const estLiqPrice = positionType === 'Long'
    ? estEntryPrice * (1 - liqFrac)
    : estEntryPrice * (1 + liqFrac);

  const triggerVal = parseFloat(triggerInput);
  const isValidTrigger = orderTab === 'Market' || (!isNaN(triggerVal) && triggerVal > 0);

  const tpVal = parseFloat(tpInput);
  const isValidTp = tpInput === '' || (!isNaN(tpVal) && tpVal > 0);

  const slVal = parseFloat(slInput);
  const isValidSl = slInput === '' || (!isNaN(slVal) && slVal > 0);

  const trailingVal = parseFloat(trailingInput);
  const isValidTrailing = trailingInput === '' || (!isNaN(trailingVal) && trailingVal > 0);

  const depositVal = parseFloat(depositAmount);
  const isValidDeposit = !isNaN(depositVal) && depositVal > 0;

  const isOrderValid = isValidMargin && isValidTrigger && isValidTp && isValidSl && isValidTrailing;

  const handleSubmitOrder = async () => {
    if (!isOrderValid) return;
    playOrderPlacedSound();
    await onOpenPosition({
      orderTab,
      positionType,
      marginInput,
      leverage,
      triggerInput,
      tpInput,
      slInput,
      trailingInput,
    });
    playTradeExecutedSound();
    setMarginInput('');
    setTriggerInput('');
    setTpInput('');
    setSlInput('');
    setTrailingInput('');
  };

  const handleDepositClick = async () => {
    if (!isValidDeposit) return;
    await onDeposit(depositAmount);
    setDepositAmount('');
  };

  const handleWithdrawClick = async () => {
    if (!isValidDeposit) return;
    await onWithdraw(depositAmount);
    setDepositAmount('');
  };

  const availableUsdc = Math.max(
    balances ? parseFloat(balances.usdc) || 0 : 0,
    marginBalance ? marginBalance / DECIMALS : 0,
  );

  return (
    <div className="w-full lg:w-85 bg-panel/80 backdrop-blur-xl flex flex-col overflow-y-auto border-l border-border/50 z-20 shadow-2xl relative shrink-0">
      <div className="absolute inset-0 bg-linear-to-b from-brand/5 to-transparent pointer-events-none"></div>
      
      {/* Header Bar */}
      <div className="p-4 border-b border-border flex justify-between items-center">
        <span className="font-semibold text-white">{t('placeOrder') || 'Place Order'}</span>
        <button
          type="button"
          onClick={onOpenAccountModeModal}
          className="flex items-center gap-1 bg-background/80 hover:bg-background border border-border/80 hover:border-brand px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer shadow-xs"
          title="Click to change Account Margin Mode"
        >
          <span className={accountMode === 'cross' ? 'text-brand' : accountMode === 'isolated' ? 'text-warning' : 'text-cyan-400'}>
            {accountMode === 'cross' ? 'Cross' : accountMode === 'isolated' ? 'Isolated' : 'Portfolio'}
          </span>
          <span className="text-white">{leverage}x</span>
          <span className="text-[10px] text-muted ml-0.5">▼</span>
        </button>
      </div>
      
      <div className="p-4 flex flex-col gap-4">
        {/* Order Tab Toggle (Market / Limit) */}
        <div className="flex gap-2 text-xs font-semibold border-b border-border/60 pb-2 overflow-x-auto">
          {(['Market', 'Limit'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setOrderTab(tab)}
              className={`px-2 py-1 rounded transition-colors whitespace-nowrap ${
                orderTab === tab ? 'bg-brand text-white font-bold' : 'text-muted hover:text-white bg-background/50'
              }`}
            >
              {tab === 'Market' ? (t('market') || 'Market') : (t('limit') || 'Limit')}
            </button>
          ))}
        </div>

        {/* Long / Short Toggle */}
        <div className="flex bg-background rounded p-1 gap-1">
          <button 
            onClick={() => setPositionType('Long')}
            className={`flex-1 py-1.5 text-sm font-semibold rounded transition-colors ${positionType === 'Long' ? 'bg-brand text-white' : 'text-muted hover:text-white'}`}
          >
            {t('buyLong') || 'Buy / Long'}
          </button>
          <button 
            onClick={() => setPositionType('Short')}
            className={`flex-1 py-1.5 text-sm font-semibold rounded transition-colors ${positionType === 'Short' ? 'bg-danger text-white' : 'text-muted hover:text-white'}`}
          >
            {t('sellShort') || 'Sell / Short'}
          </button>
        </div>

        {orderTab !== 'Market' && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-muted">
              <span>{orderTab.includes('Stop') ? (t('stopTriggerPrice') || 'Stop Trigger Price') : (t('limitPrice') || 'Limit Price')}</span>
            </div>
            <div className="relative">
              <input 
                type="number" 
                placeholder="Target Price" 
                value={triggerInput}
                onChange={(e) => setTriggerInput(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 text-white outline-none focus:border-brand transition-colors font-mono text-sm"
              />
              <span className="absolute right-3 top-2.5 text-sm text-muted">$</span>
            </div>
          </div>
        )}

        {/* Margin Input */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-muted">
            <span>{t('margin') || 'Margin'} (USDC)</span>
            <span>
              Available:{' '}
              {availableUsdc.toFixed(2)} USDC
            </span>
          </div>
          <div className="relative">
            <input 
              type="number" 
              placeholder="0.00" 
              value={marginInput}
              onChange={(e) => setMarginInput(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 text-white outline-none focus:border-brand transition-colors font-mono text-sm"
            />
            <span className="absolute right-3 top-2.5 text-sm text-muted">USDC</span>
          </div>
          {/* Quick Margin Preset Buttons */}
          <div className="flex gap-1.5 mt-1">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => {
                  setMarginInput(((availableUsdc * pct) / 100).toFixed(2));
                }}
                className="flex-1 py-1 text-[10px] font-mono font-medium rounded bg-background border border-border/60 text-muted hover:text-white hover:border-brand/50 transition-colors"
              >
                {pct === 100 ? 'MAX' : `${pct}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Leverage Slider */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted">{t('leverage') || 'Leverage'}</span>
            <span className="text-white font-mono">{leverage}x</span>
          </div>
          <input 
            type="range" 
            min="1" 
            max="50" 
            value={leverage} 
            onChange={(e) => setLeverage(parseInt(e.target.value))}
            className="w-full accent-brand cursor-pointer"
          />
        </div>

        {/* TP / SL Collapsible Trigger */}
        <div className="border-t border-border/40 pt-3">
          <button
            type="button"
            onClick={() => setShowTpSl(!showTpSl)}
            className="flex items-center justify-between w-full text-xs font-semibold text-muted hover:text-white transition-colors py-1 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <span>Take Profit / Stop Loss</span>
            </span>
            <span className="text-[10px]">{showTpSl ? '▲ Hide' : '▼ Expand'}</span>
          </button>

          {showTpSl && (
            <div className="flex flex-col gap-2.5 mt-2.5 bg-background/50 p-2.5 rounded-lg border border-border/50 animate-fadeIn">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-muted">Take Profit (TP Price)</span>
                <input
                  type="number"
                  placeholder="Optional TP Price"
                  value={tpInput}
                  onChange={(e) => setTpInput(e.target.value)}
                  className="w-full bg-background border border-border/70 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-brand font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-muted">Stop Loss (SL Price)</span>
                <input
                  type="number"
                  placeholder="Optional SL Price"
                  value={slInput}
                  onChange={(e) => setSlInput(e.target.value)}
                  className="w-full bg-background border border-border/70 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-brand font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-muted">Trailing Stop Distance ($)</span>
                <input
                  type="number"
                  placeholder="Optional Trailing Distance"
                  value={trailingInput}
                  onChange={(e) => setTrailingInput(e.target.value)}
                  className="w-full bg-background border border-border/70 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-brand font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Order Summary & Metrics Breakdown */}
        <div className="bg-background/60 rounded-xl p-3 border border-border/50 flex flex-col gap-1.5 text-xs font-mono select-none">
          <div className="flex justify-between items-center text-muted">
            <span>Order Size</span>
            <span className="text-white font-semibold">{sizeInBtc} BTC (${sizeVal.toFixed(2)})</span>
          </div>
          <div className="flex justify-between items-center text-muted">
            <span>Est. Liq Price</span>
            <span className="text-danger font-semibold">
              {sizeVal > 0 ? `$${estLiqPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
            </span>
          </div>
          <div className="flex justify-between items-center text-muted">
            <span>Price Impact</span>
            <span className="text-emerald-400 font-semibold">{priceImpactPercent.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between items-center text-muted">
            <span>Max Slippage</span>
            <div className="flex items-center gap-1">
              {[0.1, 0.5, 1.0].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlippage(s)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    slippage === s ? 'bg-brand text-white' : 'bg-background text-muted hover:text-white'
                  }`}
                >
                  {s}%
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between items-center text-muted pt-1 border-t border-border/30">
            <span>Est. Trading Fee (0.02%)</span>
            <span className="text-white">${(sizeVal * 0.0002).toFixed(4)}</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleSubmitOrder}
          disabled={!isOrderValid || isSubmitting}
          className={`w-full py-3 rounded-lg font-bold text-white transition-all shadow-lg cursor-pointer ${
            !isOrderValid || isSubmitting
              ? 'bg-border/50 text-muted cursor-not-allowed opacity-50'
              : positionType === 'Long'
              ? 'bg-brand hover:bg-brand/90 shadow-brand/20'
              : 'bg-danger hover:bg-danger/90 shadow-danger/20'
          }`}
        >
          {isSubmitting ? 'Submitting...' : positionType === 'Long' ? (t('buyLong') || 'Buy / Long') : (t('sellShort') || 'Sell / Short')}
        </button>

        {/* Collateral Deposit/Withdraw Drawer Trigger */}
        <div className="border-t border-border/40 pt-3">
          <button
            type="button"
            onClick={() => setShowCollateralDrawer(!showCollateralDrawer)}
            className="flex items-center justify-between w-full text-xs font-semibold text-muted hover:text-white transition-colors py-1 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <span>Deposit / Withdraw Collateral</span>
            </span>
            <span className="text-[10px]">{showCollateralDrawer ? '▲ Hide' : '▼ Manage'}</span>
          </button>

          {showCollateralDrawer && (
            <div className="flex flex-col gap-2.5 mt-2 bg-background/60 p-3 rounded-xl border border-border/60 animate-fadeIn">
              <div className="flex bg-panel rounded p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCollateralTab('deposit')}
                  className={`flex-1 py-1 rounded transition-colors ${collateralTab === 'deposit' ? 'bg-brand text-white font-bold' : 'text-muted'}`}
                >
                  Deposit
                </button>
                <button
                  type="button"
                  onClick={() => setCollateralTab('withdraw')}
                  className={`flex-1 py-1 rounded transition-colors ${collateralTab === 'withdraw' ? 'bg-brand text-white font-bold' : 'text-muted'}`}
                >
                  Withdraw
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="USDC Amount"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="flex-1 bg-background border border-border/80 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-brand font-mono"
                />
                <button
                  type="button"
                  onClick={collateralTab === 'deposit' ? handleDepositClick : handleWithdrawClick}
                  disabled={!isValidDeposit || isSubmitting}
                  className="bg-brand text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-brand/90 disabled:opacity-50 transition-colors"
                >
                  {collateralTab === 'deposit' ? 'Deposit' : 'Withdraw'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 1-Click Session Keys Fast Order Toggle */}
        <div className="flex items-center justify-between bg-panel/60 p-2.5 rounded-xl border border-border/50 text-xs">
          <div className="flex flex-col">
            <span className="font-semibold text-white flex items-center gap-1">
              1-Click Session Keys
            </span>
            <span className="text-[10px] text-muted">Skip Wallet Signatures</span>
          </div>
          <button
            type="button"
            onClick={onToggle1Click}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
              is1ClickEnabled ? 'bg-emerald-500 justify-end' : 'bg-border justify-start'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};
