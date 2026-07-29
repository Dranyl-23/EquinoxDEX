import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { WalletProvider } from './src/providers/WalletProvider';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/theme';
import { requestNotificationPermissions } from './src/lib/notifications';
import { BiometricLockProvider } from './src/components/BiometricLockModal';
import NetworkBanner from './src/components/NetworkBanner';
import AnimatedSplashScreen from './src/components/AnimatedSplashScreen';

// Keep splash screen visible while loading resources
SplashScreen.preventAutoHideAsync().catch(() => {});

const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.brand,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.brand,
  },
};

export default function App() {
  const [showAnimatedSplash, setShowAnimatedSplash] = React.useState(true);

  useEffect(() => {
    (async () => {
      try {
        await requestNotificationPermissions();
      } catch {
        // Ignore
      } finally {
        // Smoothly hide native splash screen immediately so our animated splash takes over
        await SplashScreen.hideAsync().catch(() => {});
      }
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <WalletProvider>
          <BiometricLockProvider>
            <NavigationContainer theme={DarkTheme}>
              <StatusBar barStyle="light-content" backgroundColor={colors.background} />
              {showAnimatedSplash && (
                <AnimatedSplashScreen onFinish={() => setShowAnimatedSplash(false)} />
              )}
              <NetworkBanner />
              <AppNavigator />
            </NavigationContainer>
          </BiometricLockProvider>
        </WalletProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
