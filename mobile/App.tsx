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
  useEffect(() => {
    (async () => {
      try {
        await requestNotificationPermissions();
      } catch {
        // Ignore
      } finally {
        // Smoothly hide splash screen once app resources are ready
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
              <AppNavigator />
            </NavigationContainer>
          </BiometricLockProvider>
        </WalletProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
