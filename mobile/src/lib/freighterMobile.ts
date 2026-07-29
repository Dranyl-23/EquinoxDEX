import { Linking, Platform } from 'react-native';

const FREIGHTER_DEEP_LINK_SCHEME = 'freighter://';
const FREIGHTER_WEBSITE_URL = 'https://www.freighter.app/';
const FREIGHTER_APP_STORE_URL = 'https://apps.apple.com/app/freighter-wallet/id1658428987';

/**
 * Check if the Freighter Mobile App is installed on this device.
 */
export async function isFreighterInstalled(): Promise<boolean> {
  try {
    return await Linking.canOpenURL(FREIGHTER_DEEP_LINK_SCHEME);
  } catch {
    return false;
  }
}

/**
 * Open the official website or App Store page for Freighter Wallet.
 */
export async function openFreighterStorePage() {
  const storeUrl = Platform.OS === 'ios' ? FREIGHTER_APP_STORE_URL : FREIGHTER_WEBSITE_URL;
  try {
    await Linking.openURL(storeUrl);
  } catch {
    // Ignore link errors
  }
}

/**
 * Initiate 1-tap deep link connection to the Freighter Mobile App on this phone.
 */
export async function connectFreighterMobileApp(): Promise<{ success: boolean; error?: string }> {
  try {
    const supported = await Linking.canOpenURL(FREIGHTER_DEEP_LINK_SCHEME);

    if (supported) {
      // Launch Freighter Mobile App via deep link scheme
      await Linking.openURL(`${FREIGHTER_DEEP_LINK_SCHEME}connect?dapp=EquinoxDEX`);
      return { success: true };
    } else {
      // If deep link scheme is not installed, open official website/store page
      await openFreighterStorePage();
      return { success: false, error: 'Freighter App not detected. Redirecting to official download page...' };
    }
  } catch (err: any) {
    try {
      await openFreighterStorePage();
      return { success: false, error: 'Could not open Freighter App.' };
    } catch {
      return { success: false, error: 'Link error' };
    }
  }
}
