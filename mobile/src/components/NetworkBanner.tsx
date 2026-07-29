import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff, Wifi } from 'lucide-react-native';
import { colors, spacing, fontSize, borderRadius } from '../theme';

export default function NetworkBanner() {
  const netInfo = useNetInfo();
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);
  const translateY = useRef(new Animated.Value(-100)).current;

  // Track previous state to know when we've just reconnected
  const prevConnected = useRef(true);

  useEffect(() => {
    // NetInfo might be null initially
    if (netInfo.isConnected === null) return;

    const currentlyConnected = netInfo.isConnected === true;

    if (!currentlyConnected && prevConnected.current) {
      // Just went offline
      setIsOffline(true);
      setShowRestored(false);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 12,
      }).start();
    } else if (currentlyConnected && !prevConnected.current) {
      // Just came back online
      setIsOffline(false);
      setShowRestored(true);
      
      // Hide the "Restored" banner after 3 seconds
      setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowRestored(false);
        });
      }, 3000);
    }

    prevConnected.current = currentlyConnected;
  }, [netInfo.isConnected, translateY]);

  if (!isOffline && !showRestored) {
    return null; // Don't render anything if everything is fine
  }

  const isRestored = !isOffline && showRestored;

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.xs },
        isRestored ? styles.containerRestored : styles.containerOffline,
        { transform: [{ translateY }] },
      ]}
    >
      <View style={styles.content}>
        {isRestored ? (
          <Wifi size={16} color="#ffffff" />
        ) : (
          <WifiOff size={16} color="#ffffff" />
        )}
        <Text style={styles.text}>
          {isRestored
            ? 'Back Online. Trading enabled.'
            : 'No Internet Connection. Trading Disabled.'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999, // Extremely high z-index to stay on top
    elevation: 9999,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  containerOffline: {
    backgroundColor: colors.danger,
  },
  containerRestored: {
    backgroundColor: colors.success,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  text: {
    color: '#ffffff',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
