import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';

let hapticsEnabledCache = true;

// Initialize cache on launch
(async () => {
  try {
    const val = await SecureStore.getItemAsync('equinox_haptics_enabled');
    if (val === 'false') hapticsEnabledCache = false;
  } catch {
    // Default to true
  }
})();

export function updateHapticsCache(enabled: boolean) {
  hapticsEnabledCache = enabled;
  SecureStore.setItemAsync('equinox_haptics_enabled', enabled ? 'true' : 'false').catch(() => {});
}

export function isHapticsEnabled(): boolean {
  return hapticsEnabledCache;
}

/**
 * Light impact feedback for subtle UI interactions (leverage chips, quick % buttons).
 */
export function impactLight() {
  if (!hapticsEnabledCache) return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

/**
 * Medium impact feedback for major UI switches (Long/Short toggle, Market/Limit tab).
 */
export function impactMedium() {
  if (!hapticsEnabledCache) return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
}

/**
 * Success notification feedback (haptic pattern on on-chain transaction confirmation).
 */
export function notificationSuccess() {
  if (!hapticsEnabledCache) return;
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}

/**
 * Error notification feedback (haptic pattern on rejected transaction or invalid input).
 */
export function notificationError() {
  if (!hapticsEnabledCache) return;
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {}
}
