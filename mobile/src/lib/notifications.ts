import { Platform } from 'react-native';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

let Notifications: typeof import('expo-notifications') | null = null;

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    Notifications?.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    // Restricted environment
  }
}

/**
 * Request OS system notification permissions and configure Android Notification Channels.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (isExpoGo || !Notifications) {
    return true;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('trading_alerts', {
        name: 'Trading Execution Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10b981',
        sound: 'default',
      });
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Trigger a native system push notification banner when an order is executed.
 */
export async function sendOrderExecutedNotification(
  symbol: string,
  isLong: boolean,
  margin: number,
  leverage: number
) {
  if (isExpoGo || !Notifications) return;

  try {
    const sideText = isLong ? 'BUY / LONG' : 'SELL / SHORT';
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🚀 Order Executed — ${symbol}`,
        body: `${sideText} ${leverage}x | Margin: $${margin.toFixed(2)} USDC`,
        data: { symbol, isLong, margin, leverage },
        sound: 'default',
      },
      trigger: null,
    });
  } catch {
    // Graceful fallback
  }
}

/**
 * Trigger a native system push notification banner when a Take Profit or Stop Loss triggers.
 */
export async function sendTpSlTriggeredNotification(
  symbol: string,
  type: 'TP' | 'SL',
  pnl: number
) {
  if (isExpoGo || !Notifications) return;

  try {
    const isProfit = pnl >= 0;
    const title = type === 'TP' ? `🎯 Take Profit Hit — ${symbol}` : `⚠️ Stop Loss Triggered — ${symbol}`;
    const pnlFormatted = `${isProfit ? '+' : ''}$${pnl.toFixed(2)}`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: `Closed ${symbol} Position | Realized PnL: ${pnlFormatted}`,
        data: { symbol, type, pnl },
        sound: 'default',
      },
      trigger: null,
    });
  } catch {
    // Graceful fallback
  }
}

/**
 * Trigger a native system push notification warning when a position is near liquidation.
 */
export async function sendLiquidationWarningNotification(symbol: string, isLong: boolean, leverage: number) {
  if (isExpoGo || !Notifications) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🔴 DANGER: Liquidation Risk Alert`,
        body: `Your ${isLong ? 'LONG' : 'SHORT'} ${leverage}x position on ${symbol} is within 5% of liquidation! Add margin or close position.`,
        sound: 'default',
      },
      trigger: null,
    });
  } catch {
    // Graceful fallback
  }
}

/**
 * Trigger a native system push notification banner when a target price alert is hit.
 */
export async function sendPriceAlertNotification(
  symbol: string,
  condition: 'ABOVE' | 'BELOW',
  targetPrice: number,
  currentPrice: number
) {
  if (isExpoGo || !Notifications) return;

  try {
    const conditionStr = condition === 'ABOVE' ? 'Rises Above ↗' : 'Drops Below ↘';
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🔔 Price Alert Triggered — ${symbol}`,
        body: `${symbol} has ${conditionStr} $${targetPrice.toLocaleString()} (Current: $${currentPrice.toLocaleString()})`,
        data: { symbol, condition, targetPrice, currentPrice },
        sound: 'default',
      },
      trigger: null,
    });
  } catch {
    // Graceful fallback
  }
}
