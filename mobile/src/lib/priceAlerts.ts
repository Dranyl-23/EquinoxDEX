import * as SecureStore from 'expo-secure-store';

const PRICE_ALERTS_KEY = 'equinox_price_alerts';

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  triggered: boolean;
  createdAt: number;
}

/**
 * Load saved price alerts from device SecureStore.
 */
export async function loadPriceAlerts(): Promise<PriceAlert[]> {
  try {
    const raw = await SecureStore.getItemAsync(PRICE_ALERTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Save price alerts array to device SecureStore.
 */
export async function savePriceAlerts(alerts: PriceAlert[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(PRICE_ALERTS_KEY, JSON.stringify(alerts));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Add a new price alert.
 */
export async function addPriceAlert(
  symbol: string,
  targetPrice: number,
  condition: 'ABOVE' | 'BELOW'
): Promise<PriceAlert[]> {
  const current = await loadPriceAlerts();
  const newAlert: PriceAlert = {
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    symbol,
    targetPrice,
    condition,
    triggered: false,
    createdAt: Date.now(),
  };
  const updated = [newAlert, ...current];
  await savePriceAlerts(updated);
  return updated;
}

/**
 * Remove a price alert by ID.
 */
export async function removePriceAlert(alertId: string): Promise<PriceAlert[]> {
  const current = await loadPriceAlerts();
  const updated = current.filter((a) => a.id !== alertId);
  await savePriceAlerts(updated);
  return updated;
}

/**
 * Clear all triggered alerts.
 */
export async function clearTriggeredAlerts(): Promise<PriceAlert[]> {
  const current = await loadPriceAlerts();
  const updated = current.filter((a) => !a.triggered);
  await savePriceAlerts(updated);
  return updated;
}
