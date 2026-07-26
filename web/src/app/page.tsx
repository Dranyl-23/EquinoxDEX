'use client';
import { useState, useEffect } from 'react';
import { useWalletContext } from '@/components/WalletProvider';
import { fetchBalances, Balances } from '@/lib/balances';
import {
  readPosition,
  readMarketState,
  readLimitOrders,
  readMarginBalance,
  Position,
  Order,
  buildOpenPositionXDR,
  buildClosePositionXDR,
  buildTriggerOrdersXDR,
  buildPlaceLimitOrderXDR,
  contractConfigured,
  buildDepositMarginXDR,
  buildWithdrawMarginXDR,
  buildAddSessionKeyXDR,
  buildFundSessionKeyXDR,
} from '@/lib/contract';
import { signAndSubmit } from '@/lib/sign';
import { getSessionKey, generateSessionKey, clearSessionKey, use1ClickEnabled } from '@/lib/sessionKey';
import { TradingChart } from '@/components/TradingChart';
import { DECIMALS, RPC_POLL_INTERVAL } from '@/lib/constants';
import { useLivePrice } from '@/hooks/useLivePrice';
import PnLShareCard from '@/components/PnLShareCard';

// Modular Trading Components (H12 Refactor)
import { MarketHeader } from '@/components/trading/MarketHeader';
import { PositionsTable } from '@/components/trading/PositionsTable';
import { OrderForm } from '@/components/trading/OrderForm';

export default function Home() {
  const wallet = useWalletContext();
  const { publicKey } = wallet;
  const { price: livePrice, loading: priceLoading, error: priceError } = useLivePrice('BTCUSDT');
  const currentPrice = livePrice || 0;

  const [balances, setBalances] = useState<Balances | null>(null);
  const [marginBalance, setMarginBalance] = useState<number>(0);
  const [position, setPosition] = useState<Position | null>(null);
  const [limitOrders, setLimitOrders] = useState<Order[]>([]);
  const [pendingPosition, setPendingPosition] = useState<Position | null>(null);
  const [marketState, setMarketState] = useState({ long_oi: 0, short_oi: 0, global_funding: 0, total_volume: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const is1ClickEnabled = use1ClickEnabled();

  // Poll for balances, position, and market state
  useEffect(() => {
    if (!publicKey || !contractConfigured()) return;
    const load = async () => {
      try {
        const bal = await fetchBalances(publicKey);
        setBalances(bal);
        const mBal = await readMarginBalance(publicKey);
        setMarginBalance(mBal);
        const pos = await readPosition(publicKey);
        setPosition(pos);
        const orders = await readLimitOrders(publicKey);
        setLimitOrders(orders);
        const state = await readMarketState();
        setMarketState(state);
      } catch {
        // Silently swallow background RPC network polling glitches
      }
    };
    load();
    const interval = setInterval(load, RPC_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [publicKey]);

  const handleOpenPosition = async (params: {
    orderTab: 'Market' | 'Limit';
    positionType: 'Long' | 'Short';
    marginInput: string;
    leverage: number;
    triggerInput: string;
    tpInput: string;
    slInput: string;
    trailingInput: string;
  }) => {
    if (!publicKey || !params.marginInput) return;
    setIsSubmitting(true);
    try {
      const marginScaled = parseFloat(params.marginInput) * DECIMALS;
      const tpScaled = params.tpInput ? parseFloat(params.tpInput) * DECIMALS : 0;
      const slScaled = params.slInput ? parseFloat(params.slInput) * DECIMALS : 0;
      const trailingScaled = params.trailingInput ? parseFloat(params.trailingInput) * DECIMALS : 0;
      const triggerScaled = params.triggerInput ? parseFloat(params.triggerInput) * DECIMALS : 0;
      const isLong = params.positionType === 'Long';

      const sessionKey = getSessionKey();
      const caller = sessionKey ? sessionKey.publicKey : publicKey;

      if (params.orderTab === 'Market') {
        // Optimistic UI: Set pending position
        setPendingPosition({
          margin: marginScaled,
          leverage: params.leverage,
          entry_price: currentPrice * DECIMALS,
          is_long: isLong,
          take_profit: tpScaled,
          stop_loss: slScaled,
          funding_index_at_entry: marketState.global_funding,
          trailing_stop_distance: trailingScaled,
        });

        const xdr = await buildOpenPositionXDR(caller, publicKey, marginScaled, params.leverage, isLong, tpScaled, slScaled, trailingScaled);
        await signAndSubmit(xdr, caller === sessionKey?.publicKey ? sessionKey.publicKey : publicKey);
        setPendingPosition(null);
      } else {
        // Limit Order
        const xdr = await buildPlaceLimitOrderXDR(caller, publicKey, marginScaled, params.leverage, isLong, triggerScaled, tpScaled, slScaled, trailingScaled);
        await signAndSubmit(xdr, caller === sessionKey?.publicKey ? sessionKey.publicKey : publicKey);
      }

      // Fast refresh
      const pos = await readPosition(publicKey);
      setPosition(pos);
      const orders = await readLimitOrders(publicKey);
      setLimitOrders(orders);
      const bal = await fetchBalances(publicKey);
      setBalances(bal);
      const mBal = await readMarginBalance(publicKey);
      setMarginBalance(mBal);
    } catch (e: unknown) {
      setPendingPosition(null);
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClosePosition = async (pct: number = 100) => {
    if (!publicKey || !position) return;
    setIsSubmitting(true);
    try {
      const sessionKey = getSessionKey();
      const caller = sessionKey ? sessionKey.publicKey : publicKey;
      const marginToClose = (position.margin * pct) / 100;
      const xdr = await buildClosePositionXDR(caller, publicKey, marginToClose);
      await signAndSubmit(xdr, caller === sessionKey?.publicKey ? sessionKey.publicKey : publicKey);

      // Fast refresh
      if (pct === 100) {
        setPosition(null);
      } else {
        const pos = await readPosition(publicKey);
        setPosition(pos);
      }
      const bal = await fetchBalances(publicKey);
      setBalances(bal);
      const mBal = await readMarginBalance(publicKey);
      setMarginBalance(mBal);
    } catch (e: unknown) {
      alert(`Close Error: ${e instanceof Error ? e.message : String(e)}`);
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

      // H10 FIX: Fetch real state instead of blindly calling setPosition(null)
      const updatedPos = await readPosition(publicKey);
      setPosition(updatedPos);

      const bal = await fetchBalances(publicKey);
      setBalances(bal);
      const mBal = await readMarginBalance(publicKey);
      setMarginBalance(mBal);
      alert('Keeper successfully triggered TP/SL or liquidation check!');
    } catch (e: unknown) {
      alert(`Keeper Trigger Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeposit = async (amountStr: string) => {
    if (!publicKey || !amountStr) return;
    setIsSubmitting(true);
    try {
      const amtScaled = parseFloat(amountStr) * DECIMALS;
      const xdr = await buildDepositMarginXDR(publicKey, amtScaled);
      await signAndSubmit(xdr, publicKey);

      const bal = await fetchBalances(publicKey);
      setBalances(bal);
      const mBal = await readMarginBalance(publicKey);
      setMarginBalance(mBal);
    } catch (e: unknown) {
      alert(`Deposit Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async (amountStr: string) => {
    if (!publicKey || !amountStr) return;
    setIsSubmitting(true);
    try {
      const amtScaled = parseFloat(amountStr) * DECIMALS;
      // H4 FIX ALIGNMENT: Withdrawals require direct user authentication (publicKey), not session keys
      const xdr = await buildWithdrawMarginXDR(publicKey, publicKey, amtScaled);
      await signAndSubmit(xdr, publicKey);

      const bal = await fetchBalances(publicKey);
      setBalances(bal);
      const mBal = await readMarginBalance(publicKey);
      setMarginBalance(mBal);
    } catch (e: unknown) {
      alert(`Withdraw Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle1Click = async () => {
    if (!publicKey) return;
    if (is1ClickEnabled) {
      clearSessionKey();
    } else {
      setIsSubmitting(true);
      try {
        const session = generateSessionKey();
        try {
          const fundXdr = await buildFundSessionKeyXDR(publicKey, session.publicKey);
          await signAndSubmit(fundXdr, publicKey, true);
        } catch {
          // Ignore if account exists
        }
        const xdr = await buildAddSessionKeyXDR(publicKey, session.publicKey);
        await signAndSubmit(xdr, publicKey, true);
      } catch (e: unknown) {
        clearSessionKey();
        alert(`Failed to enable 1-Click Trading: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // PnL Calc for active position
  let pnl = 0;
  let pnlPercent = 0;
  let fundingPnl = 0;

  if (position) {
    const rawMargin = position.margin / DECIMALS;
    const rawEntry = position.entry_price / DECIMALS;
    const priceDiff = position.is_long ? currentPrice - rawEntry : rawEntry - currentPrice;
    const pricePnl = (priceDiff * rawMargin * position.leverage) / rawEntry;

    // Funding Rate PnL
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
          <div className="flex-1 bg-background flex flex-col relative overflow-hidden">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand/10 blur-[100px] rounded-full pointer-events-none"></div>
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand/5 blur-[100px] rounded-full pointer-events-none"></div>

            <MarketHeader currentPrice={currentPrice} marketState={marketState} loading={priceLoading} error={priceError} />

            <div className="flex-1 flex items-center justify-center text-muted h-full w-full">
              <TradingChart />
            </div>
          </div>

          <PositionsTable
            publicKey={publicKey}
            position={position}
            pendingPosition={pendingPosition}
            limitOrders={limitOrders}
            currentPrice={currentPrice}
            pnl={pnl}
            pnlPercent={pnlPercent}
            fundingPnl={fundingPnl}
            isSubmitting={isSubmitting}
            onClosePosition={handleClosePosition}
            onTriggerKeeper={handleTriggerKeeper}
            onSharePnL={() => setShowShareCard(true)}
          />
        </div>

        {/* Right Side: Order Entry Panel */}
        <OrderForm
          publicKey={publicKey}
          balances={balances}
          marginBalance={marginBalance}
          currentPrice={currentPrice}
          position={position}
          pnl={pnl}
          isSubmitting={isSubmitting}
          onOpenPosition={handleOpenPosition}
          onDeposit={handleDeposit}
          onWithdraw={handleWithdraw}
          is1ClickEnabled={is1ClickEnabled}
          onToggle1Click={handleToggle1Click}
        />
      </div>

      {showShareCard && position && (
        <PnLShareCard
          asset="BTC"
          isLong={position.is_long}
          leverage={position.leverage}
          entryPrice={Number(position.entry_price)}
          pnlUsd={pnl}
          onClose={() => setShowShareCard(false)}
        />
      )}
    </main>
  );
}
