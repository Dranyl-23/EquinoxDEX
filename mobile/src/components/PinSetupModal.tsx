import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Delete, X, ShieldCheck } from 'lucide-react-native';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { impactLight, notificationSuccess, notificationError } from '../lib/haptics';

interface PinSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (pin: string) => void;
}

export default function PinSetupModal({ visible, onClose, onSuccess }: PinSetupModalProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'ENTER' | 'CONFIRM'>('ENTER');
  const [firstPin, setFirstPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const resetState = () => {
    setStep('ENTER');
    setFirstPin('');
    setCurrentPin('');
    setPinError(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handlePinPress = (digit: string) => {
    impactLight();
    setPinError(false);
    
    if (currentPin.length < 6) {
      const nextPin = currentPin + digit;
      setCurrentPin(nextPin);

      if (nextPin.length === 6) {
        if (step === 'ENTER') {
          // Move to confirm step
          setTimeout(() => {
            setFirstPin(nextPin);
            setCurrentPin('');
            setStep('CONFIRM');
          }, 300);
        } else {
          // Validate confirmation
          if (nextPin === firstPin) {
            notificationSuccess();
            setTimeout(() => {
              onSuccess(nextPin);
              resetState();
            }, 300);
          } else {
            notificationError();
            setPinError(true);
            setTimeout(() => {
              setCurrentPin('');
              setPinError(false);
            }, 800);
          }
        }
      }
    }
  };

  const handleBackspace = () => {
    impactLight();
    setPinError(false);
    setCurrentPin((prev) => prev.slice(0, -1));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <X size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <ShieldCheck size={48} color={colors.brand} style={{ marginBottom: spacing.md }} />
          <Text style={styles.title}>
            {step === 'ENTER' ? 'Set Security PIN' : 'Confirm PIN'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'ENTER' 
              ? 'Create a 6-digit PIN to secure your wallet.' 
              : 'Enter your 6-digit PIN again to confirm.'}
          </Text>

          {/* Dots Indicator */}
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const filled = currentPin.length > idx;
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
          
          <Text style={[styles.errorText, { opacity: pinError ? 1 : 0 }]}>
            PINs do not match. Try again.
          </Text>
        </View>

        {/* Keypad */}
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
            <View style={styles.keyBtnEmpty} />
            <TouchableOpacity style={styles.keyBtn} onPress={() => handlePinPress('0')}>
              <Text style={styles.keyText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keyBtnIcon} onPress={handleBackspace}>
              <Delete size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080c', justifyContent: 'space-between' },
  header: { alignItems: 'flex-end', padding: spacing.lg },
  closeBtn: { padding: spacing.xs },
  
  content: { alignItems: 'center', paddingHorizontal: spacing.xl },
  title: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '700', marginBottom: spacing.xs },
  subtitle: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', marginBottom: spacing.xl },
  
  dotsRow: { flexDirection: 'row', gap: spacing.md, marginVertical: spacing.lg },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.border, backgroundColor: 'transparent' },
  dotFilled: { backgroundColor: colors.brand, borderColor: colors.brand },
  dotError: { backgroundColor: colors.danger, borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: fontSize.sm, fontWeight: '600', marginTop: spacing.sm },

  keypad: { gap: spacing.md, paddingHorizontal: spacing.xl },
  keypadRow: { flexDirection: 'row', justifyContent: 'space-around' },
  keyBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  keyBtnEmpty: { width: 72, height: 72 },
  keyBtnIcon: { width: 72, height: 72, justifyContent: 'center', alignItems: 'center' },
  keyText: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', fontFamily: 'Courier' },
});
