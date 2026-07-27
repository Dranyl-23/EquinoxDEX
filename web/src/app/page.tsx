'use client';
import { useState, useEffect } from 'react';
import { useWalletContext } from '@/components/WalletProvider';
import { fetchBalances, Balances } from '@/lib/balances';
import {
  readPositions,
  readMarketState,
  readLimitOrders,
  readMarginBalance,
  Position,
  Order,
  buildOpenPositionXDR,
  buildClosePositionXDR,
  buildTriggerOrdersXDR,
  buildPlaceLimitOrderXDR,
  buildCancelLimitOrderXDR,
  buildModifyTpSlXDR,
  contractConfigured,
  buildDepositMarginXDR,
  buildWithdrawMarginXDR,
  buildAddSessionKeyXDR,
  buildFundSessionKeyXDR,
} from '@/lib/contract';
import { signAndSubmit } from '@/lib/sign';
import { getSessionKey, generateSessionKey, clearSessionKey, use1ClickEnabled } from '@/lib/sessionKey';
import { initTelegramMiniApp } from '@/lib/telegram';
import { SkewBar } from '@/components/trading/SkewBar';
import { SharePnLModal } from '@/components/SharePnLModal';
import { TradingChart } from '@/components/TradingChart';
import { DECIMALS, RPC_POLL_INTERVAL } from '@/lib/constants';
import { useLivePrice } from '@/hooks/useLivePrice';
import PnLShareCard from '@/components/PnLShareCard';
import { useToast } from '@/components/Toast';

// Modular Trading Components (H12 Refactor)
import { MarketHeader } from '@/components/trading/MarketHeader';
import { PositionsTable } from '@/components/trading/PositionsTable';
import { OrderForm } from '@/components/trading/OrderForm';
import { OrderBook } from '@/components/trading/OrderBook';
import { MarketSelectorModal } from '@/components/trading/MarketSelectorModal';
import { ShortcutsModal } from '@/components/trading/ShortcutsModal';
import { AccountModeModal, AccountMarginMode } from '@/components/trading/AccountModeModal';
import { MARKETS, MarketInfo } from '@/lib/markets';

export default function Home() {
  const wallet = useWalletContext();
  const { publicKey } = wallet;
  const { toast } = useToast();
  const [selectedMarket, setSelectedMarket] = useState<string>('BTCUSDT');
  const [showMarketModal, setShowMarketModal] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [showAccountModeModal, setShowAccountModeModal] = useState<boolean>(false);
  const [accountMode, setAccountMode] = useState<AccountMarginMode>('cross');
  const { price: livePrice, loading: priceLoading, error: priceError } = useLivePrice(selectedMarket);
  const currentPrice = livePrice || 0;

  const [balances, setBalances] = useState<Balances | null>(null);
  const [marginBalance, setMarginBalance] = useState<number>(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [limitOrders, setLimitOrders] = useState<Order[]>([]);
  const [pendingPosition, setPendingPosition] = useState<Position | null>(null);
  const [marketState, setMarketState] = useState({ long_oi: 0, short_oi: 0, global_funding: 0, total_volume: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const is1ClickEnabled = use1ClickEnabled();

  // Task #18 & Shortcuts: Initialize Telegram SDK and Global Pro Hotkeys
  useEffect(() => {
    initTelegramMiniApp();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger hotkeys if user is typing inside an input field
      const targetTag = (e.target as HTMLElement)?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowMarketModal((prev) => !prev);
      } else if (e.key === '?' || (e.shiftKey && e.key === '?')) {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
      } else if (e.key === 'Escape') {
        setShowMarketModal(false);
        setShowShortcutsModal(false);
        setShowShareCard(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Poll for balances, position, and market state
  useEffect(() => {
    if (!publicKey || !contractConfigured()) return;
    const load = async () => {
      try {
        const bal = await fetchBalances(publicKey);
        setBalances(bal);
        const mBal = await readMarginBalance(publicKey);
        setMarginBalance(mBal);
        const posList = await readPositions(publicKey);
        setPositions(posList);
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
    orderTab: 'Market' | 'Limit' | 'Stop Market' | 'Stop Limit';
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
          id: 0,
          symbol: selectedMarket,
          margin: marginScaled,
          leverage: params.leverage,
          entry_price: currentPrice * DECIMALS,
          is_long: isLong,
          take_profit: tpScaled,
          stop_loss: slScaled,
          funding_index_at_entry: marketState.global_funding,
          trailing_stop_distance: trailingScaled,
        });

        const xdr = await buildOpenPositionXDR(caller, publicKey, selectedMarket, marginScaled, params.leverage, isLong, tpScaled, slScaled, trailingScaled);
        await signAndSubmit(xdr, caller === sessionKey?.publicKey ? sessionKey.publicKey : publicKey);
        setPendingPosition(null);
      } else {
        // Limit Order
        const xdr = await buildPlaceLimitOrderXDR(caller, publicKey, marginScaled, params.leverage, isLong, triggerScaled, tpScaled, slScaled, trailingScaled);
        await signAndSubmit(xdr, caller === sessionKey?.publicKey ? sessionKey.publicKey : publicKey);
      }

      // Fast refresh
      const posList = await readPositions(publicKey);
      setPositions(posList);
      const orders = await readLimitOrders(publicKey);
      setLimitOrders(orders);
      const bal = await fetchBalances(publicKey);
      setBalances(bal);
      const mBal = await readMarginBalance(publicKey);
      setMarginBalance(mBal);
      toast('Order Submitted Successfully', 'success', `Opened ${params.positionType} position on ${selectedMarket}`);
    } catch (e: unknown) {
      setPendingPosition(null);
      toast('Order Execution Failed', 'error', e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClosePosition = async (positionId: number, pct: number = 100) => {
    if (!publicKey) return;
    const targetPos = positions.find(p => p.id === positionId);
    if (!targetPos) return;
    setIsSubmitting(true);
    try {
      const sessionKey = getSessionKey();
      const caller = sessionKey ? sessionKey.publicKey : publicKey;
      const marginToClose = (targetPos.margin * pct) / 100;
      const xdr = await buildClosePositionXDR(caller, publicKey, positionId, marginToClose);
      await signAndSubmit(xdr, caller === sessionKey?.publicKey ? sessionKey.publicKey : publicKey);

      const posList = await readPositions(publicKey);
      setPositions(posList);
      const bal = await fetchBalances(publicKey);
      setBalances(bal);
      const mBal = await readMarginBalance(publicKey);
      setMarginBalance(mBal);
      toast('Position Closed', 'success', `Closed ${pct}% of ${targetPos.symbol}`);
    } catch (e: unknown) {
      toast('Close Position Error', 'error', e instanceof Error ? e.message : String(e));
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

      const updatedPosList = await readPositions(publicKey);
      setPositions(updatedPosList);

      const bal = await fetchBalances(publicKey);
      setBalances(bal);
      const mBal = await readMarginBalance(publicKey);
      setMarginBalance(mBal);
      toast('Keeper Trigger Executed', 'success', 'Successfully processed TP/SL & liquidation check!');
    } catch (e: unknown) {
      toast('Keeper Trigger Failed', 'error', e instanceof Error ? e.message : String(e));
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
      await signAndSubmit(xdr, publicKey, true);

      const bal = await fetchBalances(publicKey);
      setBalances(bal);
      const mBal = await readMarginBalance(publicKey);
      setMarginBalance(mBal);
      toast('Deposit Successful', 'success', `Added ${amountStr} USDC to Cross-Margin Balance`);
    } catch (e: unknown) {
      toast('Deposit Error', 'error', e instanceof Error ? e.message : String(e));
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
      await signAndSubmit(xdr, publicKey, true);

      const bal = await fetchBalances(publicKey);
      setBalances(bal);
      const mBal = await readMarginBalance(publicKey);
      setMarginBalance(mBal);
      toast('Withdrawal Successful', 'success', `Withdrew ${amountStr} USDC to Wallet`);
    } catch (e: unknown) {
      toast('Withdraw Error', 'error', e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async (orderIndex: number) => {
    if (!publicKey) return;
    setIsSubmitting(true);
    try {
      const sessionKey = getSessionKey();
      const caller = sessionKey?.publicKey ?? publicKey;
      const xdr = await buildCancelLimitOrderXDR(caller, publicKey, orderIndex);
      await signAndSubmit(xdr, caller === sessionKey?.publicKey ? sessionKey.publicKey : publicKey);

      const orders = await readLimitOrders(publicKey);
      setLimitOrders(orders);
      toast('Order Cancelled', 'info', `Limit order #${orderIndex + 1} has been cancelled`);
    } catch (e: unknown) {
      toast('Cancel Order Error', 'error', e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModifyTpSl = async (positionId: number, tp: number, sl: number, trailing: number) => {
    if (!publicKey) return;
    setIsSubmitting(true);
    try {
      const sessionKey = getSessionKey();
      const caller = sessionKey?.publicKey ?? publicKey;
      const xdr = await buildModifyTpSlXDR(caller, publicKey, positionId, tp, sl, trailing);
      await signAndSubmit(xdr, caller === sessionKey?.publicKey ? sessionKey.publicKey : publicKey);

      const posList = await readPositions(publicKey);
      setPositions(posList);
      toast('TP/SL Updated', 'success', 'Position Take Profit & Stop Loss updated successfully');
    } catch (e: unknown) {
      toast('Modify TP/SL Error', 'error', e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle1Click = async () => {
    if (!publicKey) return;
    if (is1ClickEnabled) {
      clearSessionKey();
      toast('1-Click Trading Disabled', 'info', 'Returned to manual wallet signing mode');
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
        toast('1-Click Trading Enabled', 'success', 'Ephemeral session key authorized for 24h instant execution');
      } catch (e: unknown) {
        clearSessionKey();
        toast('1-Click Setup Failed', 'error', e instanceof Error ? e.message : String(e));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // PnL Calc for active positions
  let pnl = 0;
  let pnlPercent = 0;
  let fundingPnl = 0;

  const firstPos = positions[0] || null;
  if (firstPos) {
    const rawMargin = firstPos.margin / DECIMALS;
    const rawEntry = firstPos.entry_price / DECIMALS;
    const priceDiff = firstPos.is_long ? currentPrice - rawEntry : rawEntry - currentPrice;
    const pricePnl = (priceDiff * rawMargin * firstPos.leverage) / rawEntry;

    const rawCurrentFunding = marketState.global_funding / DECIMALS;
    const rawEntryFunding = firstPos.funding_index_at_entry / DECIMALS;
    const fundingDiff = rawCurrentFunding - rawEntryFunding;
    const positionSize = rawMargin * firstPos.leverage;

    fundingPnl = firstPos.is_long
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

            <MarketHeader 
              currentPrice={currentPrice} 
              marketState={marketState} 
              loading={priceLoading} 
              error={priceError} 
              selectedMarket={selectedMarket}
              onOpenMarketModal={() => setShowMarketModal(true)}
              onOpenShortcutsModal={() => setShowShortcutsModal(true)}
            />
            
            <div className="px-4 py-1.5 border-b border-border/50 bg-panel/20">
              <SkewBar totalLongOi={marketState.long_oi} totalShortOi={marketState.short_oi} />
            </div>

            <div className="flex-1 flex overflow-hidden w-full h-full">
              <OrderBook currentPrice={currentPrice} symbol={selectedMarket} />
              <div className="flex-1 flex items-center justify-center text-muted h-full w-full relative overflow-hidden">
                <TradingChart symbol={selectedMarket} />
              </div>
            </div>
          </div>

          <PositionsTable
            publicKey={publicKey}
            positions={positions}
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
            onCancelOrder={handleCancelOrder}
            onModifyTpSl={handleModifyTpSl}
          />
        </div>

        {/* Right Side: Order Entry Panel */}
        <OrderForm
          publicKey={publicKey}
          balances={balances}
          marginBalance={marginBalance}
          currentPrice={currentPrice}
          position={firstPos}
          pnl={pnl}
          isSubmitting={isSubmitting}
          onOpenPosition={handleOpenPosition}
          onDeposit={handleDeposit}
          onWithdraw={handleWithdraw}
          is1ClickEnabled={is1ClickEnabled}
          onToggle1Click={handleToggle1Click}
          accountMode={accountMode}
          onOpenAccountModeModal={() => setShowAccountModeModal(true)}
        />
      </div>

      <SharePnLModal
        isOpen={showShareCard}
        onClose={() => setShowShareCard(false)}
        publicKey={publicKey}
        position={firstPos}
        pnl={pnl}
        pnlPercent={pnlPercent}
        currentPrice={currentPrice}
      />

      <MarketSelectorModal
        isOpen={showMarketModal}
        onClose={() => setShowMarketModal(false)}
        currentSymbol={selectedMarket}
        onSelectMarket={(market: MarketInfo) => {
          setSelectedMarket(market.symbol);
        }}
      />

      <ShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />

      <AccountModeModal
        isOpen={showAccountModeModal}
        onClose={() => setShowAccountModeModal(false)}
        currentMode={accountMode}
        onSelectMode={(mode) => {
          setAccountMode(mode);
          toast('Account Margin Mode Updated', 'info', `Switched risk mode to ${mode.toUpperCase()} margin`);
        }}
      />
    </main>
  );
}
