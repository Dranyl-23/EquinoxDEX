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
  RefreshControl,
  Alert,
} from 'react-native';
import { Switch } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  Layers,
  X,
  Zap,
  Check,
  Share2,
  LogOut,
  Settings,
  Eye,
  EyeOff,
  ShieldAlert,
  Fingerprint,
  Volume2,
  Vibrate,
  Clipboard as ClipboardIcon,
  HelpCircle,
  ChevronRight,
  RefreshCw,
} from 'lucide-react-native';
import PnLShareModal from '../components/PnLShareModal';
import HelpSupportModal from '../components/HelpSupportModal';
import AuthMethodModal from '../components/AuthMethodModal';
import PinSetupModal from '../components/PinSetupModal';
import SwapModal from '../components/SwapModal';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { useWalletContext } from '../providers/WalletProvider';
import { readPositions, buildClosePositionXDR, buildWithdrawMarginXDR, readMarginBalance, Position } from '../lib/contract';
import { fundTestnetAccount } from '../lib/stellar';
import { DECIMALS } from '../lib/constants';
import { impactLight, impactMedium, notificationSuccess, notificationError } from '../lib/haptics';
import { soundEngine } from '../lib/audio';
import { signAndSubmit } from '../lib/sign';

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const { wallet, balances, connected, refreshBalances, disconnect } = useWalletContext();
  const [positions, setPositions] = useState<Position[]>([]);
  const [smartContractMargin, setSmartContractMargin] = useState<number>(0);
  const [loadingPositions, setLoadingPositions] = useState(false);

  // Deposit Modal State
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [isFunding, setIsFunding] = useState(false);
  const [depositSuccessMsg, setDepositSuccessMsg] = useState('');

  // Withdraw Modal State
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawSuccessMsg, setWithdrawSuccessMsg] = useState('');

  // Swap Modal State
  const [swapModalVisible, setSwapModalVisible] = useState(false);

  // Partial Close Modal State
  const [selectedPosForClose, setSelectedPosForClose] = useState<Position | null>(null);
  const [closeModalVisible, setCloseModalVisible] = useState(false);
  const [closePct, setClosePct] = useState<number>(100);
  const [isClosingPosition, setIsClosingPosition] = useState(false);

  // Share PnL Modal State
  const [selectedPosForShare, setSelectedPosForShare] = useState<Position | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);

  // Portfolio Settings Modal State
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [copiedSecretKey, setCopiedSecretKey] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [authMethod, setAuthMethod] = useState<'biometric' | 'pin' | 'none'>('none');
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [pinSetupVisible, setPinSetupVisible] = useState(false);
  const [pendingAuthMethod, setPendingAuthMethod] = useState<'biometric' | 'pin' | null>(null);

  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      const method = await SecureStore.getItemAsync('equinox_auth_method');
      const oldBio = await SecureStore.getItemAsync('equinox_biometric_enabled');
      if (method === 'biometric' || method === 'pin') {
        setAuthMethod(method);
      } else if (oldBio === 'true') {
        setAuthMethod('biometric');
      }

      const hap = await SecureStore.getItemAsync('equinox_haptics_enabled');
      if (hap === 'false') setHapticsEnabled(false);
      const snd = await SecureStore.getItemAsync('equinox_sound_enabled');
      if (snd === 'false') setSoundEnabled(false);
    })();
  }, []);

  const handleSelectAuthMethod = async (method: 'biometric' | 'pin' | 'none') => {
    setAuthModalVisible(false);
    if (method === 'none') {
      setAuthMethod('none');
      await SecureStore.setItemAsync('equinox_auth_method', 'none');
      notificationSuccess();
      return;
    }
    
    // For PIN or Biometric, setup PIN as fallback/primary
    if (method === 'biometric') {
      import('expo-local-authentication').then(async (LocalAuth) => {
        try {
          const hasHardware = await LocalAuth.hasHardwareAsync();
          const isEnrolled = await LocalAuth.isEnrolledAsync();
          if (!hasHardware || !isEnrolled) {
            Alert.alert('Not Available', 'Biometric authentication is not set up on this device.');
            return;
          }
          setPendingAuthMethod('biometric');
          setPinSetupVisible(true);
        } catch {
          Alert.alert('Error', 'Failed to check biometric status.');
        }
      });
    } else {
      setPendingAuthMethod('pin');
      setPinSetupVisible(true);
    }
  };

  const handlePinSetupSuccess = async (pin: string) => {
    setPinSetupVisible(false);
    if (pendingAuthMethod) {
      setAuthMethod(pendingAuthMethod);
      await SecureStore.setItemAsync('equinox_security_pin', pin);
      await SecureStore.setItemAsync('equinox_auth_method', pendingAuthMethod);
      // Legacy compatibility
      await SecureStore.setItemAsync('equinox_biometric_enabled', pendingAuthMethod === 'biometric' ? 'true' : 'false');
      notificationSuccess();
      setPendingAuthMethod(null);
    }
  };

  const handleToggleHaptics = async (val: boolean) => {
    if (val) impactMedium();
    setHapticsEnabled(val);
    await SecureStore.setItemAsync('equinox_haptics_enabled', val ? 'true' : 'false');
  };

  const handleToggleSound = async (val: boolean) => {
    impactMedium();
    setSoundEnabled(val);
    await SecureStore.setItemAsync('equinox_sound_enabled', val ? 'true' : 'false');
  };

  const shortAddr = wallet
    ? `${wallet.publicKey.slice(0, 6)}...${wallet.publicKey.slice(-4)}`
    : '';

  // Poll live open positions on-chain
  useEffect(() => {
    if (!wallet?.publicKey) return;
    let isSubscribed = true;

    const fetchPositions = async () => {
      try {
        const [posList, margin] = await Promise.all([
          readPositions(wallet.publicKey),
          readMarginBalance(wallet.publicKey)
        ]);
        if (isSubscribed) {
          setPositions(posList);
          setSmartContractMargin(margin / DECIMALS);
        }
      } catch {
        // Silently swallow
      }
    };

    fetchPositions();
    const interval = setInterval(fetchPositions, 10000); // 10s interval
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [wallet?.publicKey]);

  // Total Margin Used across all open positions
  const totalMarginUsed = positions.reduce(
    (acc, pos) => acc + pos.margin / DECIMALS,
    0
  );

  // Handle Instant Testnet Faucet (100 USDC / 10,000 XLM)
  const handleTestnetFaucet = async () => {
    if (!wallet?.publicKey) return;
    try {
      setIsFunding(true);
      setDepositSuccessMsg('');
      await fundTestnetAccount(wallet.publicKey, wallet.secretKey);
      await refreshBalances();
      notificationSuccess();
      setDepositSuccessMsg('Successfully funded account with Real On-Chain Testnet XLM & USDC!');
      setTimeout(() => setDepositSuccessMsg(''), 4000);
    } catch {
      notificationError();
    } finally {
      setIsFunding(false);
    }
  };

  // Handle Withdraw Submission (Real On-Chain Smart Contract Invocation)
  const handleWithdrawSubmit = async () => {
    if (!wallet?.publicKey || !withdrawAmount) return;
    const amountVal = parseFloat(withdrawAmount);
    if (isNaN(amountVal) || amountVal <= 0) return;

    try {
      setIsWithdrawing(true);
      setWithdrawSuccessMsg('');
      const amountScaled = Math.trunc(amountVal * DECIMALS);
      const xdr = await buildWithdrawMarginXDR(wallet.publicKey, wallet.publicKey, amountScaled);
      await signAndSubmit(xdr);

      await refreshBalances();
      notificationSuccess();
      setWithdrawSuccessMsg(`Withdrawal of $${amountVal.toFixed(2)} USDC confirmed on-chain!`);
      setWithdrawAmount('');
      setTimeout(() => {
        setWithdrawSuccessMsg('');
        setWithdrawModalVisible(false);
      }, 2000);
    } catch (err: any) {
      notificationError();
      const errorMsg = err?.message || '';
      Alert.alert(
        'Withdrawal Failed',
        errorMsg.includes('Account not found')
          ? 'Account not found on-chain. Please fund your account via Faucet first.'
          : errorMsg || 'An error occurred during withdrawal.'
      );
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Handle Partial Close Execution
  const handleExecuteClosePosition = async () => {
    if (!wallet?.publicKey || !selectedPosForClose) return;

    try {
      setIsClosingPosition(true);
      const pos = selectedPosForClose;
      const marginToClose = (pos.margin * closePct) / 100;
      const marginToCloseScaled = Math.trunc(marginToClose);

      const xdr = await buildClosePositionXDR(
        wallet.publicKey,
        wallet.publicKey,
        pos.id,
        marginToCloseScaled
      );

      await signAndSubmit(xdr);

      notificationSuccess();
      soundEngine.playPositionClosed();

      setCloseModalVisible(false);
      setSelectedPosForClose(null);

      // Refresh on-chain positions
      await refreshBalances();
      const posList = await readPositions(wallet.publicKey);
      setPositions(posList);
    } catch (err) {
      notificationError();
    } finally {
      setIsClosingPosition(false);
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshBalances();
      if (wallet?.publicKey) {
        const posList = await readPositions(wallet.publicKey);
        setPositions(posList);
      }
    } catch {}
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Portfolio</Text>
          <TouchableOpacity
            style={styles.settingsHeaderBtn}
            onPress={() => {
              impactMedium();
              setSettingsModalVisible(true);
            }}
          >
            <Settings size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Total Equity Card */}
        <View style={styles.equityCard}>
          <Text style={styles.equityLabel}>Total Account Equity</Text>
          <Text style={styles.equityValue}>
            ${balances ? parseFloat(balances.usdc).toFixed(2) : '0.00'}
          </Text>
          <View style={styles.equityRow}>
            <View style={styles.equityItem}>
              <Text style={styles.eqLabel}>Active Positions</Text>
              <Text style={styles.eqValue}>{positions.length}</Text>
            </View>
            <View style={styles.equityItem}>
              <Text style={styles.eqLabel}>Margin Used</Text>
              <Text style={styles.eqValue}>${totalMarginUsed.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Balance Cards */}
        <View style={styles.balanceCards}>
          <View style={styles.balanceCard}>
            <Text style={styles.bcLabel}>XLM Balance</Text>
            <Text style={styles.bcValue}>{balances?.xlm || '0.00'}</Text>
          </View>
          <View style={styles.balanceCard}>
            <Text style={styles.bcLabel}>USDC Balance</Text>
            <Text style={styles.bcValue}>{balances?.usdc || '0.00'}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.depositBtn}
            onPress={() => {
              impactMedium();
              setDepositModalVisible(true);
            }}
          >
            <ArrowDownLeft size={16} color="#ffffff" />
            <Text style={styles.depositBtnText}>Deposit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.withdrawBtn}
            onPress={() => {
              impactMedium();
              setWithdrawModalVisible(true);
            }}
          >
            <ArrowUpRight size={16} color={colors.textSecondary} />
            <Text style={styles.withdrawBtnText}>Withdraw</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.swapBtn}
            onPress={() => {
              impactMedium();
              setSwapModalVisible(true);
            }}
          >
            <RefreshCw size={16} color={colors.textSecondary} />
            <Text style={styles.withdrawBtnText}>Swap</Text>
          </TouchableOpacity>
        </View>

        {/* Open Positions Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Layers size={18} color={colors.brand} />
            <Text style={styles.sectionTitle}>Open Positions ({positions.length})</Text>
          </View>

          {positions.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              {positions.map((pos) => {
                const marginUsdc = (pos.margin / DECIMALS).toFixed(2);
                const entryPx = (pos.entry_price / DECIMALS).toFixed(2);
                const isLong = pos.is_long;

                return (
                  <View key={pos.id} style={styles.balanceCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.marketSymbol}>{pos.symbol || 'PERP'}</Text>
                        <View style={{ backgroundColor: isLong ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ color: isLong ? colors.success : colors.danger, fontSize: 10, fontWeight: '700' }}>
                            {isLong ? 'LONG' : 'SHORT'} {pos.leverage}x
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity
                          style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.brand, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                          onPress={() => {
                            impactMedium();
                            setSelectedPosForShare(pos);
                            setShareModalVisible(true);
                          }}
                        >
                          <Share2 size={12} color={colors.brand} />
                          <Text style={{ color: colors.brand, fontSize: fontSize.xs, fontWeight: '700' }}>Share</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.closePosBtn}
                          onPress={() => {
                            impactMedium();
                            setSelectedPosForClose(pos);
                            setClosePct(100);
                            setCloseModalVisible(true);
                          }}
                        >
                          <Text style={styles.closePosText}>Partial Close</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                      <View>
                        <Text style={styles.bcLabel}>Margin</Text>
                        <Text style={styles.bcValue}>${marginUsdc} USDC</Text>
                      </View>
                      <View>
                        <Text style={styles.bcLabel}>Entry Price</Text>
                        <Text style={styles.bcValue}>${entryPx}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.bcLabel}>Position ID</Text>
                        <Text style={[styles.bcValue, { color: colors.textPrimary }]}>
                          #{pos.id}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No open positions</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Deposit Margin Modal */}
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
              <Text style={styles.modalTitle}>Deposit Margin Collateral</Text>
              <TouchableOpacity onPress={() => setDepositModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: spacing.md }}>
              <TouchableOpacity
                style={styles.faucetCard}
                onPress={handleTestnetFaucet}
                disabled={isFunding}
              >
                <Zap size={24} color={colors.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.faucetTitle}>Instant 10,000 XLM/USDC Faucet</Text>
                  <Text style={styles.faucetSub}>Fund your testnet wallet instantly from Stellar Friendbot</Text>
                </View>
                {isFunding && <ActivityIndicator size="small" color={colors.brand} />}
              </TouchableOpacity>

              {depositSuccessMsg !== '' && (
                <View style={styles.successBanner}>
                  <Check size={16} color={colors.success} />
                  <Text style={styles.successText}>{depositSuccessMsg}</Text>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Withdraw USDC Modal */}
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
              <Text style={styles.modalTitle}>Withdraw USDC</Text>
              <TouchableOpacity onPress={() => setWithdrawModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: spacing.md }}>
              <View style={styles.inputContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                  <Text style={styles.bcLabel}>Withdraw Amount</Text>
                  <Text style={styles.bcLabel}>
                    Avail: ${smartContractMargin.toFixed(2)} USDC
                  </Text>
                </View>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0.00"
                    placeholderTextColor={colors.textDim}
                    keyboardType="numeric"
                    value={withdrawAmount}
                    onChangeText={setWithdrawAmount}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      impactLight();
                      setWithdrawAmount(smartContractMargin.toString());
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
                  <Text style={styles.modalActionBtnText}>Confirm Withdrawal</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Partial Close Modal */}
      <Modal
        visible={closeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCloseModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xxl) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Partial Close — {selectedPosForClose?.symbol}
              </Text>
              <TouchableOpacity onPress={() => setCloseModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedPosForClose && (
              <View style={{ gap: spacing.md }}>
                <View style={styles.balanceCard}>
                  <Text style={styles.bcLabel}>Total Position Margin</Text>
                  <Text style={styles.bcValue}>
                    ${(selectedPosForClose.margin / DECIMALS).toFixed(2)} USDC
                  </Text>
                </View>

                <Text style={styles.bcLabel}>Select Percentage to Close</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {[25, 50, 75, 100].map((pct) => (
                    <TouchableOpacity
                      key={pct}
                      style={[
                        styles.quickPctBtn,
                        closePct === pct && { backgroundColor: colors.brand }
                      ]}
                      onPress={() => {
                        impactLight();
                        setClosePct(pct);
                      }}
                    >
                      <Text
                        style={[
                          styles.quickPctText,
                          closePct === pct && { color: '#ffffff', fontWeight: '700' }
                        ]}
                      >
                        {pct === 100 ? '100%' : `${pct}%`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.modalDangerBtn, isClosingPosition && { opacity: 0.6 }]}
                  onPress={handleExecuteClosePosition}
                  disabled={isClosingPosition}
                >
                  {isClosingPosition ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.modalActionBtnText}>Confirm Close ({closePct}%)</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modals */}
      <SwapModal
        visible={swapModalVisible}
        onClose={() => setSwapModalVisible(false)}
        onSuccess={() => {}}
      />
      
      <PnLShareModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        position={selectedPosForShare}
        currentPrice={0}
        referralCode={wallet?.publicKey}
      />

      {/* Portfolio & System Settings Modal */}
      <Modal
        visible={settingsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xxl) }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Settings size={20} color={colors.brand} />
                <Text style={styles.modalTitle}>Settings & Security</Text>
              </View>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: spacing.md }}>
                {/* Section 1: Wallet & Key Backup */}
                {connected && wallet && (
                  <View style={styles.settingsSection}>
                    <Text style={styles.settingsSectionTitle}>ACCOUNT & WALLET</Text>

                    <View style={styles.settingsCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.settingLabel}>Stellar Address</Text>
                          <Text style={styles.settingValue}>{shortAddr}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.settingActionBtn}
                          onPress={async () => {
                            impactMedium();
                            await Clipboard.setStringAsync(wallet.publicKey);
                            setCopiedAddress(true);
                            notificationSuccess();
                            setTimeout(() => setCopiedAddress(false), 2000);
                          }}
                        >
                          {copiedAddress ? <Check size={14} color={colors.brand} /> : <ClipboardIcon size={14} color={colors.brand} />}
                          <Text style={styles.settingActionBtnText}>{copiedAddress ? 'Copied' : 'Copy'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Backup Secret Key Toggle */}
                    {wallet.secretKey && (
                      <View style={[styles.settingsCard, { borderColor: colors.warning }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <ShieldAlert size={16} color={colors.warning} />
                            <Text style={styles.settingLabel}>Backup Secret Key</Text>
                          </View>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            onPress={() => {
                              impactLight();
                              setShowSecretKey(!showSecretKey);
                            }}
                          >
                            {showSecretKey ? <EyeOff size={16} color={colors.textSecondary} /> : <Eye size={16} color={colors.brand} />}
                            <Text style={{ color: showSecretKey ? colors.textSecondary : colors.brand, fontSize: fontSize.xs, fontWeight: '700' }}>
                              {showSecretKey ? 'Hide' : 'Reveal'}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {showSecretKey && (
                          <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                            <Text style={styles.secretKeyBoxText} numberOfLines={2}>{wallet.secretKey}</Text>
                            <TouchableOpacity
                              style={styles.copySecretBtnSmall}
                              onPress={async () => {
                                impactMedium();
                                await Clipboard.setStringAsync(wallet.secretKey);
                                setCopiedSecretKey(true);
                                notificationSuccess();
                                setTimeout(() => setCopiedSecretKey(false), 2000);
                              }}
                            >
                              {copiedSecretKey ? <Check size={14} color="#ffffff" /> : <ClipboardIcon size={14} color="#ffffff" />}
                              <Text style={styles.copySecretBtnText}>{copiedSecretKey ? 'Copied Secret Key!' : 'Copy Secret Key'}</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* Section 2: Security & Hardware Locks */}
                <View style={styles.settingsSection}>
                  <Text style={styles.settingsSectionTitle}>SECURITY & PRIVACY</Text>
                  
                  <TouchableOpacity 
                    style={styles.settingsCardRow}
                    onPress={() => setAuthModalVisible(true)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 }}>
                      <Fingerprint size={18} color={colors.brand} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingLabel}>Set Authentication</Text>
                        <Text style={styles.settingSub}>
                          {authMethod === 'biometric' ? 'Face ID / Touch ID' : authMethod === 'pin' ? 'PIN Only' : 'None'}
                        </Text>
                      </View>
                    </View>
                    <ChevronRight size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Section 3: Preferences & Audio */}
                <View style={styles.settingsSection}>
                  <Text style={styles.settingsSectionTitle}>PREFERENCES & SOUND</Text>
                  <View style={styles.settingsCardRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 }}>
                      <Vibrate size={18} color={colors.info} />
                      <Text style={styles.settingLabel}>Haptic Feedback</Text>
                    </View>
                    <Switch
                      trackColor={{ false: colors.border, true: 'rgba(59, 130, 246, 0.4)' }}
                      thumbColor={hapticsEnabled ? colors.info : colors.textMuted}
                      value={hapticsEnabled}
                      onValueChange={handleToggleHaptics}
                    />
                  </View>

                  <View style={styles.settingsCardRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 }}>
                      <Volume2 size={18} color={colors.success} />
                      <Text style={styles.settingLabel}>Trading Sound Effects</Text>
                    </View>
                    <Switch
                      trackColor={{ false: colors.border, true: 'rgba(16, 185, 129, 0.4)' }}
                      thumbColor={soundEnabled ? colors.success : colors.textMuted}
                      value={soundEnabled}
                      onValueChange={handleToggleSound}
                    />
                  </View>
                </View>

                {/* Section 4: Support & Legal */}
                <View style={styles.settingsSection}>
                  <Text style={styles.settingsSectionTitle}>SUPPORT & LEGAL</Text>
                  <TouchableOpacity
                    style={styles.settingsCardRow}
                    onPress={() => {
                      impactMedium();
                      setHelpModalVisible(true);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <HelpCircle size={18} color={colors.brand} />
                      <Text style={styles.settingLabel}>FAQ, Privacy & Support</Text>
                    </View>
                    <ChevronRight size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Section 5: System Info & Disconnect */}
                <View style={styles.settingsSection}>
                  <Text style={styles.settingsSectionTitle}>SYSTEM & NETWORK</Text>
                  <View style={styles.settingsCardRow}>
                    <Text style={styles.settingSub}>Network</Text>
                    <Text style={styles.settingValue}>Stellar Soroban Testnet</Text>
                  </View>
                  <View style={styles.settingsCardRow}>
                    <Text style={styles.settingSub}>App Version</Text>
                    <Text style={styles.settingValue}>EquinoxDEX v1.0.0</Text>
                  </View>
                </View>

                {connected && (
                  <TouchableOpacity
                    style={styles.modalDisconnectBtn}
                    onPress={() => {
                      impactMedium();
                      setShowDisconnectConfirm(true);
                    }}
                  >
                    <LogOut size={16} color={colors.danger} />
                    <Text style={styles.modalDisconnectText}>Disconnect Wallet</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Help, Support & Privacy Knowledge Center Modal */}
      <HelpSupportModal
        visible={helpModalVisible}
        onClose={() => setHelpModalVisible(false)}
      />

      {/* Disconnect Confirmation Modal */}
      <Modal
        visible={showDisconnectConfirm}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDisconnectConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(239, 68, 68, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.danger }}>
                <LogOut size={24} color={colors.danger} />
              </View>
              <Text style={styles.modalTitle}>Disconnect Wallet?</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center', marginTop: spacing.xs }}>
                Are you sure you want to disconnect? You will need your Secret Key to sign back in.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
              <TouchableOpacity
                style={{ flex: 1, height: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border }}
                onPress={() => setShowDisconnectConfirm(false)}
              >
                <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flex: 1, height: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.danger, borderRadius: borderRadius.md }}
                onPress={async () => {
                  impactMedium();
                  await disconnect();
                  setShowDisconnectConfirm(false);
                  setSettingsModalVisible(false);
                }}
              >
                <Text style={{ color: '#ffffff', fontSize: fontSize.sm, fontWeight: '700' }}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AuthMethodModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onSelect={handleSelectAuthMethod}
        currentMethod={authMethod}
      />

      <PinSetupModal
        visible={pinSetupVisible}
        onClose={() => setPinSetupVisible(false)}
        onSuccess={handlePinSetupSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  title: { color: colors.textPrimary, fontSize: fontSize.xxl, fontWeight: '700' },
  address: { color: colors.brand, fontSize: fontSize.sm, fontFamily: 'Courier', backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border },

  equityCard: { marginHorizontal: spacing.lg, padding: spacing.xl, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border },
  equityLabel: { color: colors.textMuted, fontSize: fontSize.sm },
  equityValue: { color: colors.textPrimary, fontSize: fontSize.display, fontWeight: '700', fontFamily: 'Courier', marginVertical: spacing.sm },
  equityRow: { flexDirection: 'row', marginTop: spacing.md },
  equityItem: { flex: 1 },
  eqLabel: { color: colors.textDim, fontSize: fontSize.xs },
  eqValue: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600', fontFamily: 'Courier', marginTop: 2 },

  balanceCards: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  balanceCard: { flex: 1, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border },
  bcLabel: { color: colors.textMuted, fontSize: fontSize.xs },
  bcValue: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700', fontFamily: 'Courier', marginTop: spacing.xs },
  marketSymbol: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  closePosBtn: { backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.danger },
  closePosText: { color: colors.danger, fontSize: fontSize.xs, fontWeight: '700' },

  actionRow: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  depositBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.brand, paddingVertical: spacing.md, borderRadius: borderRadius.md },
  depositBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '700' },
  withdrawBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, borderRadius: borderRadius.md },
  withdrawBtnText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },
  swapBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, borderRadius: borderRadius.md },

  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xxl, marginBottom: spacing.xxxl },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },
  emptyState: { paddingVertical: spacing.xxl, alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border },
  emptyText: { color: colors.textDim, fontSize: fontSize.sm },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surfaceElevated, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },

  faucetCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.brand },
  faucetTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  faucetSub: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },

  inputContainer: { gap: spacing.xs },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  textInput: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md, paddingVertical: spacing.md, fontFamily: 'Courier' },

  quickPctBtn: { flex: 1, paddingVertical: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  quickPctText: { color: colors.textMuted, fontSize: fontSize.xs },

  successBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.success },
  successText: { color: colors.success, fontSize: fontSize.xs, fontWeight: '600', flex: 1 },

  modalActionBtn: { width: '100%', height: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.brand, borderRadius: borderRadius.md, marginTop: spacing.md },
  modalActionBtnText: { color: '#ffffff', fontSize: fontSize.md, fontWeight: '700' },
  modalDangerBtn: { width: '100%', height: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.danger, borderRadius: borderRadius.md, marginTop: spacing.md },

  // Portfolio Settings Modal Styles
  settingsHeaderBtn: { backgroundColor: colors.surface, padding: spacing.xs + 2, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border },
  settingsSection: { gap: spacing.xs, marginBottom: spacing.sm },
  settingsSectionTitle: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  settingsCard: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
  settingsCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
  settingLabel: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' },
  settingValue: { color: colors.brand, fontSize: fontSize.xs, fontFamily: 'Courier', marginTop: 2 },
  settingSub: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  settingActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.brand },
  settingActionBtnText: { color: colors.brand, fontSize: fontSize.xs, fontWeight: '700' },
  secretKeyBoxText: { color: colors.textPrimary, fontSize: fontSize.xs, fontFamily: 'Courier', backgroundColor: colors.background, padding: spacing.sm, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border },
  copySecretBtnSmall: { backgroundColor: colors.brand, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  copySecretBtnText: { color: '#ffffff', fontSize: fontSize.xs, fontWeight: '700' },
  modalDisconnectBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderColor: colors.danger, paddingVertical: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.xs },
  modalDisconnectText: { color: colors.danger, fontSize: fontSize.sm, fontWeight: '700' },
});
