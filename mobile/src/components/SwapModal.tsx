import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X, ArrowDownUp, RefreshCw } from 'lucide-react-native';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { useWalletContext } from '../providers/WalletProvider';
import { buildSwapXDR } from '../lib/stellar';
import { signAndSubmitHorizon } from '../lib/sign';
import { impactLight, impactMedium, notificationSuccess, notificationError } from '../lib/haptics';

interface SwapModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SwapModal({ visible, onClose, onSuccess }: SwapModalProps) {
  const { wallet, balances, refreshBalances } = useWalletContext();
  const [amount, setAmount] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [direction, setDirection] = useState<'XLM_TO_USDC' | 'USDC_TO_XLM'>('XLM_TO_USDC');

  const sendAsset = direction === 'XLM_TO_USDC' ? 'XLM' : 'USDC';
  const receiveAsset = direction === 'XLM_TO_USDC' ? 'USDC' : 'XLM';

  const availBal = balances
    ? (sendAsset === 'XLM' ? parseFloat(balances.xlm) : parseFloat(balances.usdc)) || 0
    : 0;

  const handleToggleDirection = () => {
    impactLight();
    setDirection(prev => (prev === 'XLM_TO_USDC' ? 'USDC_TO_XLM' : 'XLM_TO_USDC'));
    setAmount('');
  };

  const handleMax = () => {
    impactLight();
    // Leave 1.5 XLM for fees and base reserves if swapping XLM
    let safeMax = availBal;
    if (sendAsset === 'XLM') {
      safeMax = Math.max(0, availBal - 1.5);
    }
    setAmount(safeMax.toString());
  };

  const handleSwap = async () => {
    if (!wallet?.publicKey || !amount) return;
    const amountVal = parseFloat(amount);
    if (isNaN(amountVal) || amountVal <= 0) return;

    if (amountVal > availBal) {
      notificationError();
      Alert.alert('Insufficient Balance', `You only have ${availBal} ${sendAsset}`);
      return;
    }

    try {
      impactMedium();
      setIsSwapping(true);

      const xdr = await buildSwapXDR(wallet.publicKey, sendAsset, amountVal.toString());
      await signAndSubmitHorizon(xdr);

      await refreshBalances();
      notificationSuccess();
      setAmount('');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Swap Error:', err);
      notificationError();
      Alert.alert('Swap Failed', err.message + '\n\n' + (err.stack ? err.stack.substring(0, 500) : ''));
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Swap Assets</Text>
            <TouchableOpacity onPress={onClose} disabled={isSwapping}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.swapCard}>
            {/* From Section */}
            <View style={styles.assetSection}>
              <View style={styles.assetRow}>
                <Text style={styles.label}>You Pay</Text>
                <Text style={styles.balText}>
                  Avail: {availBal.toLocaleString('en-US', { minimumFractionDigits: 2 })} {sendAsset}
                </Text>
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 100"
                  placeholderTextColor={colors.textDim}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                  editable={!isSwapping}
                />
                <View style={styles.tokenBadge}>
                  <Text style={styles.tokenText}>{sendAsset}</Text>
                </View>
              </View>
              <View style={styles.quickPctRow}>
                {[25, 50, 75, 100].map(pct => (
                  <TouchableOpacity
                    key={pct}
                    style={styles.quickPctBtn}
                    onPress={() => {
                      if (pct === 100) handleMax();
                      else {
                        impactLight();
                        setAmount(((availBal * pct) / 100).toFixed(2));
                      }
                    }}
                    disabled={isSwapping}
                  >
                    <Text style={styles.quickPctText}>{pct === 100 ? 'MAX' : `${pct}%`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Toggle Switch */}
            <View style={styles.toggleContainer}>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.toggleBtn}
                onPress={handleToggleDirection}
                disabled={isSwapping}
              >
                <ArrowDownUp size={16} color={colors.brand} />
              </TouchableOpacity>
              <View style={styles.divider} />
            </View>

            {/* To Section */}
            <View style={styles.assetSection}>
              <View style={styles.assetRow}>
                <Text style={styles.label}>You Receive (Est.)</Text>
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { color: colors.success }]}
                  value={
                    amount
                      ? `~${(
                          sendAsset === 'XLM' 
                            ? parseFloat(amount) * 0.10 
                            : parseFloat(amount) * 10
                        ).toFixed(2)}`
                      : '0.00'
                  }
                  editable={false}
                />
                <View style={styles.tokenBadge}>
                  <Text style={styles.tokenText}>{receiveAsset}</Text>
                </View>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.sm }}>
                Executed at market rate on SDEX. Exact amount varies slightly.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, (!amount || isSwapping) && { opacity: 0.6 }]}
            onPress={handleSwap}
            disabled={!amount || isSwapping}
          >
            {isSwapping ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.submitText}>Confirm Swap</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },
  swapCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  assetSection: { gap: spacing.xs },
  assetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },
  balText: { color: colors.textMuted, fontSize: fontSize.xs },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
    paddingVertical: spacing.md,
  },
  tokenBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  tokenText: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '700' },
  quickPctRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  quickPctBtn: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  quickPctText: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '600' },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  toggleBtn: {
    backgroundColor: colors.surfaceElevated,
    padding: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  submitBtn: {
    backgroundColor: colors.brand,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitText: { color: '#000000', fontSize: fontSize.md, fontWeight: '700' },
});
