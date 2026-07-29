import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PriceAlert,
  loadPriceAlerts,
  savePriceAlerts,
  addPriceAlert as addAlertStorage,
  removePriceAlert as removeAlertStorage,
  clearTriggeredAlerts as clearTriggeredStorage,
} from '../lib/priceAlerts';
import { sendPriceAlertNotification } from '../lib/notifications';
import { notificationSuccess } from '../lib/haptics';
import { soundEngine } from '../lib/audio';

export function usePriceAlertEngine(symbol: string, currentPrice: number) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const prevPriceRef = useRef<number>(currentPrice);

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
