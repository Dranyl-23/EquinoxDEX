import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, X, TrendingUp, TrendingDown, Trash2, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { PriceAlert } from '../lib/priceAlerts';
import { impactLight, impactMedium } from '../lib/haptics';

interface PriceAlertModalProps {
  visible: boolean;
  onClose: () => void;
  symbol: string;
  currentPrice: number;
  alerts: PriceAlert[];
  onAddAlert: (targetPrice: number, condition: 'ABOVE' | 'BELOW') => Promise<void>;
  onRemoveAlert: (id: string) => Promise<void>;
  onClearTriggered: () => Promise<void>;
}

export default function PriceAlertModal({
  visible,
  onClose,
  symbol,
  currentPrice,
  alerts,
  onAddAlert,
  onRemoveAlert,
  onClearTriggered,
}: PriceAlertModalProps) {
  const insets = useSafeAreaInsets();
  const [condition, setCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [targetInput, setTargetInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApplyDelta = (pct: number) => {
    impactLight();
    if (currentPrice > 0) {
      const calculated = currentPrice * (1 + pct / 100);
      setTargetInput(calculated.toFixed(2));
      if (pct >= 0) setCondition('ABOVE');
      else setCondition('BELOW');
    }
  };

  const handleCreateAlert = async () => {
    if (!targetInput) return;
    const targetPx = parseFloat(targetInput);
    if (isNaN(targetPx) || targetPx <= 0) return;

    try {
      impactMedium();
      setIsSubmitting(true);
      await onAddAlert(targetPx, condition);
      setTargetInput('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeAlerts = alerts.filter((a) => a.symbol === symbol);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xxl) }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Bell size={20} color={colors.brand} />
              <Text style={styles.modalTitle}>Set Price Alert — {symbol}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: spacing.md }}>
              {/* Current Price Display Banner */}
              <View style={styles.currentPriceBanner}>
                <Text style={styles.currentPriceLabel}>Current Market Price</Text>
                <Text style={styles.currentPriceValue}>
                  ${currentPrice > 0 ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </Text>
              </View>

              {/* Condition Toggle (Rises Above vs Drops Below) */}
              <Text style={styles.inputLabel}>Alert Condition</Text>
              <View style={styles.conditionRow}>
                <TouchableOpacity
                  style={[
                    styles.conditionBtn,
                    condition === 'ABOVE' && styles.aboveActive,
                  ]}
                  onPress={() => {
                    impactLight();
                    setCondition('ABOVE');
                  }}
                >
                  <TrendingUp size={16} color={condition === 'ABOVE' ? colors.success : colors.textMuted} />
                  <Text style={[styles.conditionText, condition === 'ABOVE' && { color: colors.success }]}>
                    Rises Above ↗
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.conditionBtn,
                    condition === 'BELOW' && styles.belowActive,
                  ]}
                  onPress={() => {
                    impactLight();
                    setCondition('BELOW');
                  }}
                >
                  <TrendingDown size={16} color={condition === 'BELOW' ? colors.danger : colors.textMuted} />
                  <Text style={[styles.conditionText, condition === 'BELOW' && { color: colors.danger }]}>
                    Drops Below ↘
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Target Price Input & Quick Deltas */}
              <Text style={styles.inputLabel}>Target Price (USDC)</Text>
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.textInput}
                  placeholder={`e.g. ${currentPrice > 0 ? (currentPrice * 1.05).toFixed(2) : '70000.00'}`}
                  placeholderTextColor={colors.textDim}
                  keyboardType="decimal-pad"
                  value={targetInput}
                  onChangeText={setTargetInput}
                />
              </View>

              {/* Quick Delta Chips */}
              <View style={styles.deltaChipsRow}>
                {[-5, -1, 1, 5, 10].map((pct) => (
                  <TouchableOpacity
                    key={pct}
                    style={styles.deltaChip}
                    onPress={() => handleApplyDelta(pct)}
                  >
                    <Text style={[styles.deltaChipText, { color: pct > 0 ? colors.success : colors.danger }]}>
                      {pct > 0 ? `+${pct}%` : `${pct}%`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Add Alert Action Button */}
              <TouchableOpacity
                style={[styles.createBtn, isSubmitting && { opacity: 0.6 }]}
                onPress={handleCreateAlert}
                disabled={isSubmitting || !targetInput}
              >
                <Bell size={16} color="#ffffff" />
                <Text style={styles.createBtnText}>Create Target Price Alert</Text>
              </TouchableOpacity>

              {/* Active & Triggered Alerts Section */}
              <View style={{ marginTop: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                  <Text style={styles.inputLabel}>Active Alerts ({activeAlerts.length})</Text>
                  {alerts.some((a) => a.triggered) && (
                    <TouchableOpacity onPress={onClearTriggered}>
                      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Clear Triggered</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {activeAlerts.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <AlertCircle size={20} color={colors.textDim} />
                    <Text style={styles.emptyText}>No price alerts configured for {symbol} yet.</Text>
                  </View>
                ) : (
                  <View style={{ gap: spacing.xs }}>
                    {activeAlerts.map((alert) => (
                      <View key={alert.id} style={styles.alertCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 }}>
                          {alert.triggered ? (
                            <CheckCircle2 size={16} color={colors.success} />
                          ) : alert.condition === 'ABOVE' ? (
                            <TrendingUp size={16} color={colors.success} />
                          ) : (
                            <TrendingDown size={16} color={colors.danger} />
                          )}
                          <View>
                            <Text style={styles.alertPrice}>
                              {alert.condition === 'ABOVE' ? 'Rises Above' : 'Drops Below'} ${alert.targetPrice.toLocaleString()}
                            </Text>
                            <Text style={styles.alertSub}>
                              {alert.triggered ? 'Triggered 🔔' : 'Active • Monitoring'}
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity onPress={() => onRemoveAlert(alert.id)}>
                          <Trash2 size={16} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surfaceElevated, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },

  currentPriceBanner: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  currentPriceLabel: { color: colors.textMuted, fontSize: fontSize.xs },
  currentPriceValue: { color: colors.brand, fontSize: fontSize.xl, fontWeight: '800', fontFamily: 'Courier', marginTop: 2 },

  inputLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700' },
  conditionRow: { flexDirection: 'row', gap: spacing.md },
  conditionBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
  aboveActive: { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: colors.success },
  belowActive: { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: colors.danger },
  conditionText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textMuted },

  inputBox: { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  textInput: { color: colors.textPrimary, fontSize: fontSize.md, fontFamily: 'Courier', paddingVertical: spacing.md },

  deltaChipsRow: { flexDirection: 'row', gap: spacing.xs },
  deltaChip: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, alignItems: 'center' },
  deltaChipText: { fontSize: fontSize.xs, fontWeight: '700' },

  createBtn: { height: 48, backgroundColor: colors.brand, borderRadius: borderRadius.md, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  createBtnText: { color: '#ffffff', fontSize: fontSize.sm, fontWeight: '700' },

  emptyCard: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: spacing.xs },
  emptyText: { color: colors.textDim, fontSize: fontSize.xs },

  alertCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
  alertPrice: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '700' },
  alertSub: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
});
