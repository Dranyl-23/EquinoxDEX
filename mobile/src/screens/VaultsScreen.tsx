import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Landmark,
  ShieldCheck,
  Percent,
  Layers,
  Plus,
  Minus,
  X,
  Check,
} from 'lucide-react-native';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { useWalletContext } from '../providers/WalletProvider';
import {
  readPoolState,
  buildAddLiquidityXDR,
  buildRemoveLiquidityXDR,
} from '../lib/contract';
import { DECIMALS, USDC_TOKEN_ID, VAULT_APY_EST } from '../lib/constants';
import { impactLight, impactMedium, notificationSuccess, notificationError } from '../lib/haptics';
import { soundEngine } from '../lib/audio';
import { signAndSubmit } from '../lib/sign';

export default function VaultsScreen() {
  const insets = useSafeAreaInsets();
  const { wallet, balances, refreshBalances } = useWalletContext();

  const [poolState, setPoolState] = useState({
    totalPool: 0,
    totalShares: 0,
    userShares: 0,
  });

  // Deposit Modal State
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositSuccessMsg, setDepositSuccessMsg] = useState('');

  // Withdraw Modal State
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawShares, setWithdrawShares] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawSuccessMsg, setWithdrawSuccessMsg] = useState('');

  // Poll live pool state on-chain
  useEffect(() => {
    let isSubscribed = true;

    const fetchPool = async () => {
      try {
        const state = await readPoolState(wallet?.publicKey || '');
        if (isSubscribed) {
          setPoolState(state);
        }
      } catch {
        // Silently swallow
      }
    };

    fetchPool();
    const interval = setInterval(fetchPool, 5000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [wallet?.publicKey]);

  const tvlUsdc = (poolState.totalPool / DECIMALS).toFixed(2);
  const userSharesElp = (poolState.userShares / DECIMALS).toFixed(2);
  const totalSharesElp = (poolState.totalShares / DECIMALS).toFixed(2);
  const userPoolSharePct =
    poolState.totalShares > 0
      ? ((poolState.userShares / poolState.totalShares) * 100).toFixed(2)
      : '0.00';

  // Deposit Liquidity Execution Handler
  const handleDepositSubmit = async () => {
    if (!wallet?.publicKey || !depositAmount) return;
    const amountVal = parseFloat(depositAmount);
    if (isNaN(amountVal) || amountVal <= 0) return;

    try {
      setIsDepositing(true);
      setDepositSuccessMsg('');
      const amountScaled = Math.trunc(amountVal * DECIMALS);

      const xdr = await buildAddLiquidityXDR(
        wallet.publicKey,
        USDC_TOKEN_ID,
        amountScaled
      );

      await signAndSubmit(xdr);

      notificationSuccess();
      soundEngine.playOrderSubmitted();
      setDepositSuccessMsg(`Successfully deposited $${amountVal.toFixed(2)} USDC liquidity into vault!`);
      setDepositAmount('');

      await refreshBalances();
      const updatedState = await readPoolState(wallet.publicKey);
      setPoolState(updatedState);

      setTimeout(() => {
        setDepositSuccessMsg('');
        setDepositModalVisible(false);
      }, 2500);
    } catch (err: any) {
      notificationError();
    } finally {
      setIsDepositing(false);
    }
  };

  // Withdraw / Redeem Liquidity Execution Handler
  const handleWithdrawSubmit = async () => {
    if (!wallet?.publicKey || !withdrawShares) return;
    const sharesVal = parseFloat(withdrawShares);
    if (isNaN(sharesVal) || sharesVal <= 0) return;

    try {
      setIsWithdrawing(true);
      setWithdrawSuccessMsg('');
      const sharesScaled = Math.trunc(sharesVal * DECIMALS);

      const xdr = await buildRemoveLiquidityXDR(
        wallet.publicKey,
        USDC_TOKEN_ID,
        sharesScaled
      );

      await signAndSubmit(xdr);

      notificationSuccess();
      soundEngine.playPositionClosed();
      setWithdrawSuccessMsg(`Successfully redeemed ${sharesVal.toFixed(2)} ELP shares for USDC!`);
      setWithdrawShares('');

      await refreshBalances();
      const updatedState = await readPoolState(wallet.publicKey);
      setPoolState(updatedState);

      setTimeout(() => {
        setWithdrawSuccessMsg('');
        setWithdrawModalVisible(false);
      }, 2500);
    } catch (err: any) {
      notificationError();
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Landmark size={24} color={colors.brand} />
            <Text style={styles.title}>Liquidity Vaults</Text>
          </View>
          <Text style={styles.subtitle}>Provide USDC liquidity and earn perpetual trading fees</Text>
        </View>

        {/* Main Vault Card */}
        <View style={styles.vaultCard}>
          <View style={styles.vaultHeader}>
            <View>
              <Text style={styles.vaultName}>USDC Vault</Text>
              <Text style={styles.vaultType}>Perpetuals Pool Liquidity</Text>
            </View>
            <View style={styles.apyBadge}>
              <Text style={styles.apyText}>{VAULT_APY_EST}% APY</Text>
            </View>
          </View>

          {/* Vault Stats */}
          <View style={styles.vaultStats}>
            <View style={styles.vstatItem}>
              <Text style={styles.vstatLabel}>Total Value Locked</Text>
              <Text style={styles.vstatValue}>${tvlUsdc}</Text>
            </View>
            <View style={styles.vstatItem}>
              <Text style={styles.vstatLabel}>Your Pool Share</Text>
              <Text style={styles.vstatValue}>{userSharesElp} ELP</Text>
            </View>
            <View style={styles.vstatItem}>
              <Text style={styles.vstatLabel}>Share %</Text>
              <Text style={styles.vstatValue}>{userPoolSharePct}%</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.vaultActions}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => {
                impactMedium();
                setDepositModalVisible(true);
              }}
            >
              <Plus size={16} color="#ffffff" />
              <Text style={styles.addBtnText}>Deposit Liquidity</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => {
                impactMedium();
                setWithdrawModalVisible(true);
              }}
            >
              <Minus size={16} color={colors.textSecondary} />
              <Text style={styles.removeBtnText}>Redeem Shares</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* How it Works */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Vault Protocol Overview</Text>

          <View style={styles.infoItem}>
            <View style={styles.iconBox}>
              <ShieldCheck size={18} color={colors.brand} />
            </View>
            <Text style={styles.infoText}>
              Deposit USDC into the liquidity vault to counter-party perpetual orders on-chain.
            </Text>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.iconBox}>
              <Percent size={18} color={colors.brand} />
            </View>
            <Text style={styles.infoText}>
              Automatically earn 0.10% protocol fees on every position opened and closed.
            </Text>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.iconBox}>
              <Layers size={18} color={colors.brand} />
            </View>
            <Text style={styles.infoText}>
              Redeem your ELP shares for underlying USDC at any time without lockup periods.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Deposit Liquidity Modal */}
      <Modal
        visible={depositModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDepositModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xxl) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Deposit Vault Liquidity</Text>
              <TouchableOpacity onPress={() => setDepositModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: spacing.md }}>
              <View style={styles.inputContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                  <Text style={styles.vstatLabel}>Deposit Amount</Text>
                  <Text style={styles.vstatLabel}>
                    Avail: ${balances?.usdc || '0.00'} USDC
                  </Text>
                </View>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0.00"
                    placeholderTextColor={colors.textDim}
                    keyboardType="numeric"
                    value={depositAmount}
                    onChangeText={setDepositAmount}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      impactLight();
                      setDepositAmount(balances?.usdc || '0');
                    }}
                  >
                    <Text style={{ color: colors.brand, fontSize: fontSize.xs, fontWeight: '700' }}>MAX</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {depositSuccessMsg !== '' && (
                <View style={styles.successBanner}>
                  <Check size={16} color={colors.success} />
                  <Text style={styles.successText}>{depositSuccessMsg}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.modalActionBtn, isDepositing && { opacity: 0.6 }]}
                onPress={handleDepositSubmit}
                disabled={isDepositing}
              >
                {isDepositing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalActionBtnText}>Confirm Liquidity Deposit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Redeem Shares Modal */}
      <Modal
        visible={withdrawModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xxl) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Redeem ELP Pool Shares</Text>
              <TouchableOpacity onPress={() => setWithdrawModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: spacing.md }}>
              <View style={styles.inputContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                  <Text style={styles.vstatLabel}>Shares to Redeem</Text>
                  <Text style={styles.vstatLabel}>
                    Staked: {userSharesElp} ELP
                  </Text>
                </View>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0.00"
                    placeholderTextColor={colors.textDim}
                    keyboardType="numeric"
                    value={withdrawShares}
                    onChangeText={setWithdrawShares}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      impactLight();
                      setWithdrawShares(userSharesElp);
                    }}
                  >
                    <Text style={{ color: colors.brand, fontSize: fontSize.xs, fontWeight: '700' }}>MAX</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {withdrawSuccessMsg !== '' && (
                <View style={styles.successBanner}>
                  <Check size={16} color={colors.success} />
                  <Text style={styles.successText}>{withdrawSuccessMsg}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.modalActionBtn, isWithdrawing && { opacity: 0.6 }]}
                onPress={handleWithdrawSubmit}
                disabled={isWithdrawing}
              >
                {isWithdrawing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalActionBtnText}>Confirm Share Redemption</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },

  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { color: colors.textPrimary, fontSize: fontSize.xxl, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },

  vaultCard: { marginHorizontal: spacing.lg, padding: spacing.xl, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.brand, marginBottom: spacing.lg },
  vaultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  vaultName: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '700' },
  vaultType: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  apyBadge: { backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full },
  apyText: { color: colors.brand, fontSize: fontSize.sm, fontWeight: '700' },

  vaultStats: { flexDirection: 'row', marginTop: spacing.xl },
  vstatItem: { flex: 1 },
  vstatLabel: { color: colors.textDim, fontSize: fontSize.xs },
  vstatValue: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700', fontFamily: 'Courier', marginTop: 2 },

  vaultActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  addBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.brand, paddingVertical: spacing.md, borderRadius: borderRadius.md },
  addBtnText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },
  removeBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, borderRadius: borderRadius.md },
  removeBtnText: { color: colors.textSecondary, fontSize: fontSize.md, fontWeight: '600' },

  infoCard: { marginHorizontal: spacing.lg, padding: spacing.xl, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xxxl },
  infoTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700', marginBottom: spacing.lg },
  infoItem: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md, alignItems: 'center' },
  iconBox: { backgroundColor: colors.background, padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
  infoText: { flex: 1, color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surfaceElevated, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },

  inputContainer: { gap: spacing.xs },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  textInput: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md, paddingVertical: spacing.md, fontFamily: 'Courier' },

  modalActionBtn: { width: '100%', height: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.brand, borderRadius: borderRadius.md, marginTop: spacing.md },
  modalActionBtnText: { color: '#ffffff', fontSize: fontSize.md, fontWeight: '700' },

  successBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.success },
  successText: { color: colors.success, fontSize: fontSize.xs, fontWeight: '600', flex: 1 },
});
