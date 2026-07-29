import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Gift, Copy, Share2, Check, Award, DollarSign } from 'lucide-react-native';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { useWalletContext } from '../providers/WalletProvider';
import { readReferralStats, readMarketState, buildClaimReferralKickbackXDR } from '../lib/contract';
import { DECIMALS } from '../lib/constants';
import { impactMedium, notificationSuccess, notificationError } from '../lib/haptics';
import { soundEngine } from '../lib/audio';
import { signAndSubmit } from '../lib/sign';

const VIP_TIERS = [
  { name: 'Bronze', minVol: 0, fee: 0.1 },
  { name: 'Silver', minVol: 10000, fee: 0.08 },
  { name: 'Gold', minVol: 100000, fee: 0.06 },
  { name: 'Platinum', minVol: 1000000, fee: 0.04 },
  { name: 'Diamond', minVol: 10000000, fee: 0.02 },
];

export default function RewardsScreen() {
  const { wallet, connected, refreshBalances } = useWalletContext();
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ kickback: 0, lifetime: 0, count: 0 });
  const [totalVolume, setTotalVolume] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimSuccessMsg, setClaimSuccessMsg] = useState('');

  const referralCode = wallet ? wallet.publicKey : '';
  const referralLink = `https://equinoxdex.vercel.app/?ref=${referralCode}`;

  useEffect(() => {
    let isSubscribed = true;

    const fetchStats = async () => {
      try {
        const [refData, mktData] = await Promise.all([
          wallet?.publicKey ? readReferralStats(wallet.publicKey) : Promise.resolve({ kickback: 0, lifetime: 0, count: 0 }),
          readMarketState(),
        ]);
        if (!isSubscribed) return;
        setStats(refData);
        setTotalVolume(mktData.total_volume / DECIMALS);
      } catch {
        // Silently swallow
      } finally {
        if (isSubscribed) setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [wallet?.publicKey]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    await Share.share({
      message: `Trade perpetuals on EquinoxDEX! Use my referral link: ${referralLink}`,
    });
  };

  // On-Chain Claim Referral Kickback Execution
  const handleClaimKickback = async () => {
    if (!wallet?.publicKey || stats.kickback <= 0) return;

    try {
      setIsClaiming(true);
      setClaimSuccessMsg('');
      impactMedium();

      const xdr = await buildClaimReferralKickbackXDR(wallet.publicKey);
      await signAndSubmit(xdr);

      notificationSuccess();
      soundEngine.playOrderSubmitted();

      setClaimSuccessMsg(`Successfully claimed $${stats.kickback.toFixed(2)} referral kickback!`);

      await refreshBalances();
      const updatedStats = await readReferralStats(wallet.publicKey);
      setStats(updatedStats);

      setTimeout(() => setClaimSuccessMsg(''), 4000);
    } catch (err: any) {
      notificationError();
    } finally {
      setIsClaiming(false);
    }
  };

  const currentTier = VIP_TIERS.reduce((prev, tier) =>
    totalVolume >= tier.minVol ? tier : prev, VIP_TIERS[0]);
  const nextTier = VIP_TIERS[VIP_TIERS.indexOf(currentTier) + 1];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Gift size={24} color={colors.brand} />
            <Text style={styles.title}>Rewards & Referrals</Text>
          </View>
        </View>

        {/* Referral Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Referral Program</Text>
          <Text style={styles.cardSubtitle}>
            Earn 20% of trading fees from everyone you refer to EquinoxDEX
          </Text>

          {connected ? (
            <>
              <View style={styles.codeBox}>
                <Text style={styles.codeText} numberOfLines={1} ellipsizeMode="middle">
                  {referralLink}
                </Text>
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
                  {copied ? (
                    <Check size={16} color="#ffffff" />
                  ) : (
                    <Copy size={16} color="#ffffff" />
                  )}
                  <Text style={styles.copyBtnText}>
                    {copied ? 'Copied' : 'Copy Link'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                  <Share2 size={16} color={colors.textSecondary} />
                  <Text style={styles.shareBtnText}>Share</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={styles.connectPrompt}>Connect wallet to access your referral link</Text>
          )}
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Unclaimed</Text>
            <Text style={styles.statValue}>${stats.kickback.toFixed(2)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Lifetime</Text>
            <Text style={styles.statValue}>${stats.lifetime.toFixed(2)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Referrals</Text>
            <Text style={styles.statValue}>{stats.count}</Text>
          </View>
        </View>

        {connected && (
          <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.lg }}>
            {claimSuccessMsg !== '' && (
              <View style={styles.successBanner}>
                <Check size={16} color={colors.success} />
                <Text style={styles.successText}>{claimSuccessMsg}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.claimBtn,
                (isClaiming || stats.kickback <= 0) && { opacity: 0.5 }
              ]}
              onPress={handleClaimKickback}
              disabled={isClaiming || stats.kickback <= 0}
            >
              {isClaiming ? (
                <ActivityIndicator size="small" color={colors.brand} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <DollarSign size={18} color={stats.kickback > 0 ? colors.brand : colors.textDim} />
                  <Text style={[styles.claimBtnText, stats.kickback <= 0 && { color: colors.textDim }]}>
                    {stats.kickback > 0
                      ? `Claim $${stats.kickback.toFixed(2)} Kickback Earnings`
                      : 'No Kickback Earnings Available'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* VIP Tiers Card */}
        <View style={styles.card}>
          <View style={styles.vipTitleRow}>
            <Award size={20} color={colors.brand} />
            <Text style={styles.cardTitle}>VIP Fee Tiers</Text>
          </View>
          <View style={styles.tierInfo}>
            <Text style={styles.currentTierLabel}>Current Tier</Text>
            <Text style={styles.currentTierValue}>{currentTier.name}</Text>
          </View>

          {nextTier && (
            <View style={styles.progressSection}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min((totalVolume / nextTier.minVol) * 100, 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                ${totalVolume.toLocaleString()} / ${nextTier.minVol.toLocaleString()} to {nextTier.name}
              </Text>
            </View>
          )}

          {VIP_TIERS.map((tier) => (
            <View key={tier.name} style={[styles.tierRow, currentTier.name === tier.name && styles.tierRowActive]}>
              <Text style={[styles.tierName, currentTier.name === tier.name && styles.tierNameActive]}>
                {tier.name}
              </Text>
              <Text style={styles.tierVol}>${tier.minVol.toLocaleString()}+</Text>
              <Text style={styles.tierFee}>{tier.fee}%</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },

  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { color: colors.textPrimary, fontSize: fontSize.xxl, fontWeight: '700' },

  card: { marginHorizontal: spacing.lg, padding: spacing.xl, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  cardTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },
  cardSubtitle: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs, marginBottom: spacing.lg },
  vipTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },

  codeBox: { backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  codeText: { color: colors.brand, fontSize: fontSize.xs, fontFamily: 'Courier' },

  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  copyBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.brand, paddingVertical: spacing.md, borderRadius: borderRadius.md },
  copyBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '700' },
  shareBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, borderRadius: borderRadius.md },
  shareBtnText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },

  connectPrompt: { color: colors.textDim, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.lg },

  statsRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  statCard: { flex: 1, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  statLabel: { color: colors.textMuted, fontSize: fontSize.xs },
  statValue: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700', fontFamily: 'Courier', marginTop: spacing.xs },

  claimBtn: { width: '100%', height: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.brand },
  claimBtnText: { color: colors.brand, fontSize: fontSize.md, fontWeight: '700' },

  successBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.success, marginBottom: spacing.md },
  successText: { color: colors.success, fontSize: fontSize.xs, fontWeight: '600', flex: 1 },

  tierInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  currentTierLabel: { color: colors.textMuted, fontSize: fontSize.sm },
  currentTierValue: { color: colors.brand, fontSize: fontSize.lg, fontWeight: '700' },

  progressSection: { marginBottom: spacing.lg },
  progressBar: { height: 8, backgroundColor: colors.background, borderRadius: borderRadius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.brand, borderRadius: borderRadius.full },
  progressText: { color: colors.textDim, fontSize: fontSize.xs, marginTop: spacing.xs },

  tierRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  tierRowActive: { backgroundColor: 'rgba(16, 185, 129, 0.05)' },
  tierName: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '600', flex: 1 },
  tierNameActive: { color: colors.brand },
  tierVol: { color: colors.textMuted, fontSize: fontSize.sm, fontFamily: 'Courier', flex: 1, textAlign: 'center' },
  tierFee: { color: colors.textPrimary, fontSize: fontSize.sm, fontFamily: 'Courier', fontWeight: '600', width: 50, textAlign: 'right' },
});
