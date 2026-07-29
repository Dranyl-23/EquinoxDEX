import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Share2, Sparkles, TrendingUp, TrendingDown, ShieldCheck } from 'lucide-react-native';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { Position } from '../lib/contract';
import { DECIMALS } from '../lib/constants';
import { impactMedium } from '../lib/haptics';

interface PnLShareModalProps {
  visible: boolean;
  onClose: () => void;
  position: Position | null;
  currentPrice: number;
  referralCode?: string;
}

export default function PnLShareModal({
  visible,
  onClose,
  position,
  currentPrice,
  referralCode,
}: PnLShareModalProps) {
  const insets = useSafeAreaInsets();
  if (!position) return null;

  const entryPx = position.entry_price / DECIMALS;
  const markPx = currentPrice > 0 ? currentPrice : entryPx;
  const isLong = position.is_long;
  const leverage = position.leverage || 1;

  // Compute ROI percentage
  const priceDiff = isLong ? markPx - entryPx : entryPx - markPx;
  const roiPct = entryPx > 0 ? ((priceDiff / entryPx) * leverage) * 100 : 0;
  const isProfit = roiPct >= 0;

  const refUrl = `https://equinoxdex.vercel.app/?ref=${referralCode || 'TRADER'}`;

  const handleShareToSocials = async () => {
    impactMedium();
    const directionStr = isLong ? 'LONG' : 'SHORT';
    const profitSign = isProfit ? '+' : '';
    const shareMessage = `🔥 Just hit ${profitSign}${roiPct.toFixed(2)}% ROI trading ${position.symbol} ${directionStr} ${leverage}x on EquinoxDEX!\n\nTrade decentralized perpetuals with up to 100x leverage:\n${refUrl}`;

    await Share.share({
      message: shareMessage,
      title: `EquinoxDEX Trade PnL — ${position.symbol}`,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xxl) }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Sparkles size={18} color={colors.brand} />
              <Text style={styles.modalTitle}>Share PnL Card</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Social Share Card Preview */}
          <View style={[styles.pnlCard, { borderColor: isProfit ? colors.success : colors.danger }]}>
            {/* Top Brand Banner */}
            <View style={styles.cardTopBanner}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={styles.logoBadge}>
                  <Text style={styles.logoBadgeText}>EQ</Text>
                </View>
                <Text style={styles.cardBrandName}>EQUINOX DEX</Text>
              </View>
              <View style={styles.perpsBadge}>
                <ShieldCheck size={12} color={colors.brand} />
                <Text style={styles.perpsBadgeText}>Soroban On-Chain</Text>
              </View>
            </View>

            {/* Pair & Direction Badge */}
            <View style={styles.pairRow}>
              <Text style={styles.symbolText}>{position.symbol || 'PERP'}</Text>
              <View style={[styles.dirBadge, { backgroundColor: isLong ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)' }]}>
                {isLong ? <TrendingUp size={14} color={colors.success} /> : <TrendingDown size={14} color={colors.danger} />}
                <Text style={[styles.dirBadgeText, { color: isLong ? colors.success : colors.danger }]}>
                  {isLong ? 'LONG' : 'SHORT'} {leverage}x
                </Text>
              </View>
            </View>

            {/* Huge ROI Display */}
            <View style={styles.roiSection}>
              <Text style={styles.roiLabel}>PROFIT / LOSS (ROI)</Text>
              <Text style={[styles.roiValue, { color: isProfit ? colors.success : colors.danger }]}>
                {isProfit ? '+' : ''}{roiPct.toFixed(2)}%
              </Text>
            </View>

            {/* Price Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statBoxLabel}>Entry Price</Text>
                <Text style={styles.statBoxValue}>${entryPx.toFixed(2)}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statBoxLabel}>Mark Price</Text>
                <Text style={styles.statBoxValue}>${markPx.toFixed(2)}</Text>
              </View>
            </View>

            {/* Bottom Referral Link Footer */}
            <View style={styles.cardFooter}>
              <Text style={styles.footerRefText} numberOfLines={1}>
                {refUrl}
              </Text>
            </View>
          </View>

          {/* Share Action Button */}
          <TouchableOpacity style={styles.shareActionBtn} onPress={handleShareToSocials}>
            <Share2 size={18} color="#ffffff" />
            <Text style={styles.shareActionBtnText}>Share Trading Card</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'center', paddingHorizontal: spacing.lg },
  modalContent: { backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },

  // PnL Card Visual Styling
  pnlCard: { backgroundColor: '#0c0d14', borderRadius: borderRadius.lg, borderWidth: 2, padding: spacing.xl, marginBottom: spacing.xl },
  cardTopBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  logoBadge: { width: 24, height: 24, borderRadius: 6, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' },
  logoBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
  cardBrandName: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '800', letterSpacing: 1 },
  perpsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16, 185, 129, 0.12)', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full },
  perpsBadgeText: { color: colors.brand, fontSize: fontSize.xs, fontWeight: '600' },

  pairRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  symbolText: { color: colors.textPrimary, fontSize: fontSize.xxl, fontWeight: '800' },
  dirBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  dirBadgeText: { fontSize: fontSize.sm, fontWeight: '800' },

  roiSection: { marginVertical: spacing.md, alignItems: 'center' },
  roiLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600', letterSpacing: 1 },
  roiValue: { fontSize: 42, fontWeight: '900', fontFamily: 'Courier', marginVertical: spacing.xs },

  statsGrid: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.sm },
  statBox: { flex: 1, alignItems: 'center' },
  statBoxLabel: { color: colors.textDim, fontSize: fontSize.xs },
  statBoxValue: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700', fontFamily: 'Courier', marginTop: 2 },

  cardFooter: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' },
  footerRefText: { color: colors.brand, fontSize: fontSize.xs, fontFamily: 'Courier' },

  shareActionBtn: { height: 48, backgroundColor: colors.brand, borderRadius: borderRadius.md, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  shareActionBtnText: { color: '#ffffff', fontSize: fontSize.md, fontWeight: '700' },
});
