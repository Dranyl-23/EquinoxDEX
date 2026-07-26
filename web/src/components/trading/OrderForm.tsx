'use client';
import React, { useState } from 'react';
import { Balances } from '@/lib/balances';
import { Position } from '@/lib/contract';
import { DECIMALS } from '@/lib/constants';

interface OrderFormProps {
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
}

export const OrderForm: React.FC<OrderFormProps> = ({
  publicKey,
  balances,
  marginBalance,
  currentPrice,
  position,
  pnl,
  isSubmitting,
  onOpenPosition,
  onDeposit,
  onWithdraw,
  is1ClickEnabled,
  onToggle1Click,
}) => {
  const [leverage, setLeverage] = useState(10);
  const [orderTab, setOrderTab] = useState<'Market' | 'Limit'>('Market');
  const [positionType, setPositionType] = useState<'Long' | 'Short'>('Long');
  const [marginInput, setMarginInput] = useState('');
  const [triggerInput, setTriggerInput] = useState('');
  const [tpInput, setTpInput] = useState('');
  const [slInput, setSlInput] = useState('');
  const [trailingInput, setTrailingInput] = useState('');
  const [depositAmount, setDepositAmount] = useState('');

  const marginVal = parseFloat(marginInput);
  const isValidMargin = !isNaN(marginVal) && marginVal > 0;
  const sizeVal = isValidMargin ? marginVal * leverage : 0;
  const sizeInBtc = currentPrice > 0 ? (sizeVal / currentPrice).toFixed(4) : "0.0000";

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

  // H7 FIX: Account Equity includes both price PnL and funding PnL (pnl already aggregates both)
  const accountEquity = (marginBalance / DECIMALS) + (position ? pnl : 0);

  // H8 FIX: Prevent NaN/Infinity division by zero when account equity is 0 or negative
  const marginUsagePercent = position && accountEquity > 0
    ? ((position.margin / DECIMALS) / accountEquity) * 100
    : 0;

  const handleSubmitOrder = async () => {
    if (!isOrderValid) return;
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
    // Clear inputs on success
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

  return (
    <div className="w-85 bg-panel/80 backdrop-blur-xl flex flex-col overflow-y-auto border-l border-border/50 z-20 shadow-2xl relative">
      <div className="absolute inset-0 bg-linear-to-b from-brand/5 to-transparent pointer-events-none"></div>
      <div className="p-4 border-b border-border flex justify-between items-center">
        <span className="font-semibold text-white">Place Order</span>
      </div>
      
      <div className="p-4 flex flex-col gap-5">
        
        {/* Order Tab Toggle (Market / Limit) */}
        <div className="flex gap-4 text-sm font-medium border-b border-border pb-2">
          <button 
            onClick={() => setOrderTab('Market')}
            className={`${orderTab === 'Market' ? 'text-brand border-b-2 border-brand pb-2 -mb-2.25' : 'text-muted hover:text-white'}`}
          >
            Market
          </button>
          <button 
            onClick={() => setOrderTab('Limit')}
            className={`${orderTab === 'Limit' ? 'text-brand border-b-2 border-brand pb-2 -mb-2.25' : 'text-muted hover:text-white'}`}
          >
            Limit
          </button>
        </div>

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

        {orderTab === 'Limit' && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-muted">
              <span>Trigger Price</span>
            </div>
            <div className="relative">
              <input 
                type="number" 
                placeholder="Market Price" 
                value={triggerInput}
                onChange={(e) => setTriggerInput(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 text-white outline-none focus:border-brand transition-colors font-mono"
              />
              <span className="absolute right-3 top-2.5 text-sm text-muted">$</span>
            </div>
          </div>
        )}

        {/* Margin Input */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-muted">
            <span>Margin (USDC)</span>
            <span>Available: {balances ? balances.usdc : '0.00'}</span>
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
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs text-muted">
              <span>Take Profit Price</span>
            </div>
            <div className="relative">
              <input 
                type="number" 
                placeholder="0.00" 
                value={tpInput}
                onChange={(e) => setTpInput(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 text-white outline-none focus:border-brand transition-colors font-mono"
              />
              <span className="absolute right-3 top-2.5 text-sm text-muted">$</span>
            </div>
          </div>

          {/* Stop Loss */}
          <div className="flex flex-col gap-2 mt-3">
            <div className="flex justify-between text-xs text-muted">
              <span>Stop Loss Price</span>
            </div>
            <div className="relative">
              <input 
                type="number" 
                placeholder="0.00" 
                value={slInput}
                onChange={(e) => setSlInput(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 text-white outline-none focus:border-brand transition-colors font-mono"
              />
              <span className="absolute right-3 top-2.5 text-sm text-muted">$</span>
            </div>
          </div>

          {/* Trailing Stop Distance */}
          <div className="flex flex-col gap-2 mt-3">
            <div className="flex justify-between text-xs text-muted">
              <span>Trailing Stop Distance</span>
            </div>
            <div className="relative">
              <input 
                type="number" 
                placeholder="0" 
                value={trailingInput}
                onChange={(e) => setTrailingInput(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 text-white outline-none focus:border-brand transition-colors font-mono"
              />
              <span className="absolute right-3 top-2.5 text-sm text-muted">$</span>
            </div>
          </div>
        </div>

        {/* Cross-Margin Account Management */}
        <div className="border-t border-border/50 pt-4 mt-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold text-muted">Cross-Margin Account</span>
            <span className="text-sm font-mono font-bold text-white">{(marginBalance / DECIMALS).toFixed(2)} USDC</span>
          </div>
          
          {/* Account Equity & Margin Usage */}
          <div className="flex justify-between items-center mb-2 px-2 py-1.5 bg-background rounded border border-border/50">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted">Account Equity</span>
              <span className="text-xs font-mono font-bold text-brand">
                {accountEquity.toFixed(2)} USDC
              </span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-muted">Margin Usage</span>
              <span className="text-xs font-mono font-bold text-warning">
                {marginUsagePercent.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="flex gap-2 mb-3">
            <input 
              type="number" 
              placeholder="Amount" 
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-1/2 bg-background border border-border rounded px-2 py-1 text-sm text-white outline-none focus:border-brand transition-colors font-mono"
            />
            <button 
              onClick={handleDepositClick}
              disabled={!publicKey || !isValidDeposit || isSubmitting}
              className="w-1/4 bg-border hover:bg-border/80 text-white text-xs rounded transition-colors disabled:opacity-50"
            >
              Deposit
            </button>
            <button 
              onClick={handleWithdrawClick}
              disabled={!publicKey || !isValidDeposit || isSubmitting}
              className="w-1/4 bg-border hover:bg-border/80 text-white text-xs rounded transition-colors disabled:opacity-50"
            >
              Withdraw
            </button>
          </div>

          {/* 1-Click Trading Toggle */}
          <div className="flex items-center justify-between bg-panel/50 p-2 rounded border border-border/50">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white flex items-center gap-1">
                ⚡ 1-Click Trading
              </span>
              <span className="text-[10px] text-muted">Trade instantly, no wallet popups.</span>
            </div>
            <button
              onClick={onToggle1Click}
              disabled={!publicKey || isSubmitting}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                is1ClickEnabled ? 'bg-brand' : 'bg-muted'
              }`}
            >
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                is1ClickEnabled ? 'translate-x-5' : 'translate-x-1'
              }`} />
            </button>
          </div>
          {is1ClickEnabled && (
            <p className="text-[10px] text-brand/80 mt-1 leading-tight">
              Session key active. Trades will execute instantly using your Internal Margin.
            </p>
          )}
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
        <div className="relative mt-2">
          <div className={`absolute inset-0 blur-md opacity-50 ${positionType === 'Long' ? 'bg-brand' : 'bg-danger'}`}></div>
          <button 
            onClick={handleSubmitOrder}
            disabled={!publicKey || !isOrderValid || isSubmitting || position !== null}
            className={`relative w-full py-4 rounded-lg font-bold text-white transition-all transform hover:scale-[1.02] active:scale-[0.98]
              ${positionType === 'Long' ? 'bg-linear-to-r from-brand to-brand-hover shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-linear-to-r from-danger to-danger-hover shadow-[0_0_20px_rgba(239,68,68,0.3)]'}
              ${(!publicKey || !isOrderValid || isSubmitting || position !== null) ? 'opacity-50 cursor-not-allowed transform-none' : ''}
            `}
          >
          {isSubmitting ? 'Processing...' : 
           !publicKey ? 'Connect Wallet' : 
           position !== null ? 'Position Already Open' :
           !isValidMargin ? 'Enter Margin' :
           !isValidTrigger ? 'Enter Valid Trigger Price' :
           !isValidTp || !isValidSl || !isValidTrailing ? 'Invalid Advanced Inputs' :
           `${positionType === 'Long' ? 'Buy / Long' : 'Sell / Short'}`}
          </button>
        </div>
      </div>
    </div>
  );
};
