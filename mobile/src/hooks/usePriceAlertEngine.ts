import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PriceAlert,
  loadPriceAlerts,
  savePriceAlerts,
  addPriceAlert as addAlertStorage,
  removePriceAlert as removeAlertStorage,
  clearTriggeredAlerts as clearTriggeredStorage,
} from '../lib/priceAlerts';
import { sendPriceAlertNotification, sendLiquidationWarningNotification } from '../lib/notifications';
import { notificationSuccess, notificationError } from '../lib/haptics';
import { soundEngine } from '../lib/audio';
import { useWalletContext } from '../providers/WalletProvider';
import { readPositions, Position } from '../lib/contract';
import { DECIMALS } from '../lib/constants';

export function usePriceAlertEngine(symbol: string, currentPrice: number) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const prevPriceRef = useRef<number>(currentPrice);
  const { wallet } = useWalletContext();
  const notifiedLiquidations = useRef<Set<number>>(new Set());

  // Initial load from storage
  const reloadAlerts = useCallback(async () => {
    const list = await loadPriceAlerts();
    setAlerts(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    reloadAlerts();
  }, [reloadAlerts]);

  // Evaluate alerts on every 1-second price tick
  useEffect(() => {
    if (currentPrice <= 0 || alerts.length === 0) return;

    let hasChanges = false;
    const updatedAlerts = alerts.map((alert) => {
      if (alert.triggered || alert.symbol !== symbol) return alert;

      let isHit = false;
      if (alert.condition === 'ABOVE' && currentPrice >= alert.targetPrice) {
        isHit = true;
      } else if (alert.condition === 'BELOW' && currentPrice <= alert.targetPrice) {
        isHit = true;
      }

      if (isHit) {
        hasChanges = true;
        // Fire OS Notification, Haptic, and Audio
        sendPriceAlertNotification(alert.symbol, alert.condition, alert.targetPrice, currentPrice);
        notificationSuccess();
        soundEngine.playOrderSubmitted();

        return { ...alert, triggered: true };
      }

      return alert;
    });

    if (hasChanges) {
      setAlerts(updatedAlerts);
      savePriceAlerts(updatedAlerts);
    }

    prevPriceRef.current = currentPrice;
  }, [currentPrice, symbol, alerts]);

  // Liquidation Monitoring loop
  useEffect(() => {
    if (!wallet?.publicKey || currentPrice <= 0) return;

    let isSubscribed = true;

    const checkLiquidations = async () => {
      try {
        const posList = await readPositions(wallet.publicKey);
        if (!isSubscribed) return;

        posList.forEach((pos) => {
          if (pos.symbol && pos.symbol !== symbol) return; // Only check current market for simplicity, or we can assume livePrices for others later

          const entryPrice = pos.entry_price / DECIMALS;
          let liqPrice = 0;
          let isDanger = false;

          if (pos.is_long) {
            // Margin wiped out when price drops by 1/Leverage
            liqPrice = entryPrice * (1 - 1 / pos.leverage);
            // Danger if current price is within 5% of liquidation price (from above)
            if (currentPrice <= liqPrice * 1.05) {
              isDanger = true;
            }
          } else {
            // SHORT: Margin wiped out when price rises by 1/Leverage
            liqPrice = entryPrice * (1 + 1 / pos.leverage);
            // Danger if current price is within 5% of liquidation price (from below)
            if (currentPrice >= liqPrice * 0.95) {
              isDanger = true;
            }
          }

          if (isDanger && !notifiedLiquidations.current.has(pos.id)) {
            // Trigger OS Notification
            sendLiquidationWarningNotification(pos.symbol, pos.is_long, pos.leverage);
            notificationError();
            soundEngine.playError(); // Assuming playError exists, or use a specific alert sound
            notifiedLiquidations.current.add(pos.id);
          } else if (!isDanger) {
            // Remove from notified set if the danger subsides
            notifiedLiquidations.current.delete(pos.id);
          }
        });
      } catch (e) {
        // Silently ignore network failures in background loop
      }
    };

    checkLiquidations();
    const interval = setInterval(checkLiquidations, 10000); // Check every 10 seconds

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [wallet?.publicKey, currentPrice, symbol]);

  const addAlert = async (targetPrice: number, condition: 'ABOVE' | 'BELOW') => {
    const list = await addAlertStorage(symbol, targetPrice, condition);
    setAlerts(list);
  };

  const removeAlert = async (id: string) => {
    const list = await removeAlertStorage(id);
    setAlerts(list);
  };

  const clearTriggered = async () => {
    const list = await clearTriggeredStorage();
    setAlerts(list);
  };

  const activeAlertsCount = alerts.filter((a) => !a.triggered).length;

  return {
    alerts,
    loading,
    addAlert,
    removeAlert,
    clearTriggered,
    reloadAlerts,
    activeAlertsCount,
  };
}
