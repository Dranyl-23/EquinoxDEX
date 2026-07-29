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

export async function isHapticsEnabled(): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync('equinox_haptics_enabled');
    return val !== 'false';
  } catch {
    return true;
  }
}

/**
 * Light impact feedback for subtle UI interactions (leverage chips, quick % buttons).
 */
export function impactLight() {
  (async () => {
    if (!(await isHapticsEnabled())) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  })();
}

/**
 * Medium impact feedback for major UI switches (Long/Short toggle, Market/Limit tab).
 */
export function impactMedium() {
  (async () => {
    if (!(await isHapticsEnabled())) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  })();
}

/**
 * Success notification feedback (haptic pattern on on-chain transaction confirmation).
 */
export function notificationSuccess() {
  (async () => {
    if (!(await isHapticsEnabled())) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  })();
}

/**
 * Error notification feedback (haptic pattern on rejected transaction or invalid input).
 */
export function notificationError() {
  (async () => {
    if (!(await isHapticsEnabled())) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {}
  })();
}
