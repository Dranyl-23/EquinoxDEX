import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { Fingerprint, Lock, ShieldCheck, Delete, Sparkles, Check } from 'lucide-react-native';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { impactLight, impactMedium, notificationSuccess, notificationError } from '../lib/haptics';
import { soundEngine } from '../lib/audio';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_KEY = 'equinox_biometric_enabled';
const PIN_KEY = 'equinox_security_pin';
const DEFAULT_PIN = '123456'; // Default security PIN

export interface BiometricLockProps {
  children: React.ReactNode;
}

export function BiometricLockProvider({ children }: BiometricLockProps) {
  const insets = useSafeAreaInsets();
  const [isLocked, setIsLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [storedPin, setStoredPin] = useState(DEFAULT_PIN);

  // Check if biometric is enabled on device
  useEffect(() => {
    (async () => {
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_KEY);
      if (enabled === 'true') {
        const pin = await SecureStore.getItemAsync(PIN_KEY);
        if (pin) setStoredPin(pin);
        
        setBiometricEnabled(true);
        setIsLocked(true);
      }
    })();
  }, []);

  // Lock app when returning from background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && biometricEnabled) {
        setIsLocked(true);
        triggerHardwareBiometrics();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [biometricEnabled]);

  // Hardware Biometric Authentication Trigger
  const triggerHardwareBiometrics = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        setAuthenticating(true);
        const res = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock EquinoxDEX Secure Wallet',
          fallbackLabel: 'Use Security PIN',
          cancelLabel: 'Cancel',
          disableDeviceFallback: false,
        });

        if (res.success) {
          handleUnlockSuccess();
        } else {
          notificationError();
        }
      }
    } catch {
      // Fall back to PIN
    } finally {
      setAuthenticating(false);
    }
  };

  const handleUnlockSuccess = () => {
    notificationSuccess();
    soundEngine.playOrderSubmitted();
    setIsLocked(false);
    setPinInput('');
    setPinError(false);
  };

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Custom PIN Input Handler
  const handlePinPress = (digit: string) => {
    impactLight();
    setPinError(false);
    if (pinInput.length < 6) {
      const nextPin = pinInput + digit;
      setPinInput(nextPin);

      if (nextPin.length === 6) {
        if (nextPin === storedPin) {
          handleUnlockSuccess();
        } else {
          notificationError();
          setPinError(true);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            setPinInput('');
            setPinError(false);
          }, 800);
        }
      }
    }
  };

  const handleBackspace = () => {
    impactLight();
    setPinError(false);
    setPinInput((prev) => prev.slice(0, -1));
  };

  return (
    <>
      {children}

      {/* Custom Biometric & PIN Security Lock Screen Modal */}
      <Modal
        visible={isLocked}
        animationType="fade"
        transparent={false}
        statusBarTranslucent={true}
      >
        <SafeAreaView style={styles.lockContainer} edges={['top', 'bottom']}>
          <View style={styles.lockHeader}>
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoText}>EQ</Text>
              </View>
              <Text style={styles.brandTitle}>EQUINOX DEX</Text>
            </View>
            <View style={styles.securityTag}>
              <ShieldCheck size={12} color={colors.brand} />
              <Text style={styles.securityTagText}>HARDWARE ENCLAVE SECURED</Text>
            </View>
          </View>

          {/* Central Pulsing Biometric Ring */}
          <View style={styles.centralSection}>
            <TouchableOpacity
              style={styles.biometricRingOuter}
              onPress={triggerHardwareBiometrics}
              disabled={authenticating}
            >
              <View style={styles.biometricRingInner}>
                <Fingerprint size={48} color={colors.brand} />
              </View>
            </TouchableOpacity>

            <Text style={styles.lockStatusText}>
              {authenticating ? 'Authenticating...' : 'Touch Sensor or Scan Face to Unlock'}
            </Text>

            {/* PIN Indicator Dots */}
            <View style={styles.dotsRow}>
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const filled = pinInput.length > idx;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.dot,
                      filled && styles.dotFilled,
                      pinError && styles.dotError,
                    ]}
                  />
                );
              })}
            </View>
            {pinError && (
              <Text style={styles.errorText}>Invalid Security PIN. Try again.</Text>
            )}
          </View>

          {/* Custom 6-Digit PIN Keypad */}
          <View style={[styles.keypad, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
            ].map((row, rIdx) => (
              <View key={`row-${rIdx}`} style={styles.keypadRow}>
                {row.map((digit) => (
                  <TouchableOpacity
                    key={digit}
                    style={styles.keyBtn}
                    onPress={() => handlePinPress(digit)}
                  >
                    <Text style={styles.keyText}>{digit}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            <View style={styles.keypadRow}>
              <TouchableOpacity
                style={styles.keyBtnIcon}
                onPress={triggerHardwareBiometrics}
              >
                <Fingerprint size={22} color={colors.brand} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.keyBtn}
                onPress={() => handlePinPress('0')}
              >
                <Text style={styles.keyText}>0</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.keyBtnIcon}
                onPress={handleBackspace}
              >
                <Delete size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  lockContainer: { flex: 1, backgroundColor: '#07080c', justifyContent: 'space-between', paddingHorizontal: spacing.xl },
  lockHeader: { alignItems: 'center', paddingTop: spacing.xl },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  logoBadge: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  brandTitle: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '900', letterSpacing: 1.5 },
  securityTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16, 185, 129, 0.12)', paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: borderRadius.full, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
  securityTagText: { color: colors.brand, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  centralSection: { alignItems: 'center', marginVertical: spacing.xl },
  biometricRingOuter: { width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(16, 185, 129, 0.08)', borderWidth: 2, borderColor: colors.brand, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg, shadowColor: colors.brand, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 10 },
  biometricRingInner: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  lockStatusText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600', marginBottom: spacing.xl },

  dotsRow: { flexDirection: 'row', gap: spacing.md },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.border, backgroundColor: 'transparent' },
  dotFilled: { backgroundColor: colors.brand, borderColor: colors.brand },
  dotError: { backgroundColor: colors.danger, borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: fontSize.xs, fontWeight: '600', marginTop: spacing.sm },

  keypad: { gap: spacing.md, marginBottom: spacing.lg },
  keypadRow: { flexDirection: 'row', justifyContent: 'space-around' },
  keyBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  keyBtnIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  keyText: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', fontFamily: 'Courier' },
});
