import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, Fingerprint, KeyRound, XCircle, X } from 'lucide-react-native';
import { colors, spacing, fontSize, borderRadius } from '../theme';

interface AuthMethodModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (method: 'biometric' | 'pin' | 'none') => void;
  currentMethod: 'biometric' | 'pin' | 'none';
}

export default function AuthMethodModal({ visible, onClose, onSelect, currentMethod }: AuthMethodModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <ShieldCheck color={colors.brand} size={24} />
              <Text style={styles.title}>Set Authentication</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color={colors.textMuted} size={24} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.subtitle}>
            Choose how you want to secure your EquinoxDEX app.
          </Text>

          <View style={styles.optionsList}>
            {/* Biometric Option */}
            <TouchableOpacity
              style={[styles.optionCard, currentMethod === 'biometric' && styles.optionCardSelected]}
              onPress={() => onSelect('biometric')}
            >
              <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Fingerprint color={colors.brand} size={24} />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>Biometric (Face/Touch ID)</Text>
                <Text style={styles.optionDesc}>Fastest & most secure. Uses hardware enclave.</Text>
              </View>
              <View style={styles.radio}>
                {currentMethod === 'biometric' && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>

            {/* PIN Option */}
            <TouchableOpacity
              style={[styles.optionCard, currentMethod === 'pin' && styles.optionCardSelected]}
              onPress={() => onSelect('pin')}
            >
              <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <KeyRound color={colors.info} size={24} />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>PIN Only</Text>
                <Text style={styles.optionDesc}>Require a 6-digit PIN code on every launch.</Text>
              </View>
              <View style={styles.radio}>
                {currentMethod === 'pin' && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>

            {/* None Option */}
            <TouchableOpacity
              style={[styles.optionCard, currentMethod === 'none' && styles.optionCardSelected, { borderBottomWidth: 0 }]}
              onPress={() => onSelect('none')}
            >
              <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <XCircle color={colors.danger} size={24} />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>None</Text>
                <Text style={styles.optionDesc}>Not recommended. Leaves your wallet exposed.</Text>
              </View>
              <View style={styles.radio}>
                {currentMethod === 'none' && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  closeBtn: {
    padding: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginBottom: spacing.xl,
  },
  optionsList: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionCardSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionDesc: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
});
