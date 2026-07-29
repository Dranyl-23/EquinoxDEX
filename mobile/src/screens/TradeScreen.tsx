import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Search,
  Zap,
  Key,
  LogOut,
  SlidersHorizontal,
  Layers,
  History,
  TrendingUp,
  Clipboard as ClipboardIcon,
  Share2,
  Eye,
  EyeOff,
  ShieldAlert,
  Check,
  Fingerprint,
  Bell,
} from 'lucide-react-native';
import PnLShareModal from '../components/PnLShareModal';
import PriceAlertModal from '../components/PriceAlertModal';
import PinSetupModal from '../components/PinSetupModal';
import { usePriceAlertEngine } from '../hooks/usePriceAlertEngine';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { useWalletContext } from '../providers/WalletProvider';
import { MARKETS, MarketInfo } from '../lib/markets';
import TradingChart from '../components/TradingChart';
import { useLivePrice } from '../hooks/useLivePrice';
import { useOrderBook } from '../hooks/useOrderBook';
import {
  readPositions,
  readLimitOrders,
  buildOpenPositionXDR,
  buildPlaceLimitOrderXDR,
  buildClosePositionXDR,
  Position,
  Order,
} from '../lib/contract';
import { signAndSubmit } from '../lib/sign';
import { DECIMALS } from '../lib/constants';
import { impactLight, impactMedium, notificationSuccess, notificationError } from '../lib/haptics';
import { soundEngine } from '../lib/audio';
import { sendOrderExecutedNotification } from '../lib/notifications';
import { connectFreighterMobileApp } from '../lib/freighterMobile';

export default function TradeScreen() {
  const { wallet, balances, connected, connect, importKey, disconnect, loading, refreshBalances } =
    useWalletContext();

  // State
  const [selectedMarket, setSelectedMarket] = useState<MarketInfo>(MARKETS[0]);
  const [marketModalVisible, setMarketModalVisible] = useState(false);
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [importKeyInput, setImportKeyInput] = useState('');
  const [showImportKey, setShowImportKey] = useState(false);
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Live Binance WebSocket Feeds
  const livePriceData = useLivePrice(selectedMarket.symbol);
  const liveOrderBook = useOrderBook(selectedMarket.symbol);

  // On-Chain State
  const [positions, setPositions] = useState<Position[]>([]);
  const [limitOrders, setLimitOrders] = useState<Order[]>([]);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Market Category Filter State
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Order Form State
  const [orderTab, setOrderTab] = useState<'Market' | 'Limit'>('Market');
  const [positionType, setPositionType] = useState<'Long' | 'Short'>('Long');
  const [marginInput, setMarginInput] = useState('');
  const [triggerInput, setTriggerInput] = useState('');
  const [leverage, setLeverage] = useState(10);
  const [showTpSl, setShowTpSl] = useState(false);
  const [tpInput, setTpInput] = useState('');
  const [slInput, setSlInput] = useState('');
  const [trailingStopInput, setTrailingStopInput] = useState('');

  // Partial Close Modal State
  const [selectedPosForClose, setSelectedPosForClose] = useState<Position | null>(null);
  const [closeModalVisible, setCloseModalVisible] = useState(false);
  const [closePct, setClosePct] = useState<number>(100);
  const [isClosingPosition, setIsClosingPosition] = useState(false);

  // Share PnL Modal State
  const [selectedPosForShare, setSelectedPosForShare] = useState<Position | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);

  // Secret Key Backup State
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [copiedSecretKey, setCopiedSecretKey] = useState(false);

  // Price Alert Modal State & Engine
  const [priceAlertModalVisible, setPriceAlertModalVisible] = useState(false);
  const {
    alerts: priceAlerts,
    addAlert: addPriceAlertItem,
    removeAlert: removePriceAlertItem,
    clearTriggered: clearTriggeredAlerts,
    activeAlertsCount,
  } = usePriceAlertEngine(selectedMarket.symbol, livePriceData.price);

  // Biometric Hardware Lock State
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [pinSetupVisible, setPinSetupVisible] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  useEffect(() => {
    (async () => {
      const enabled = await SecureStore.getItemAsync('equinox_biometric_enabled');
      if (enabled === 'true') setBiometricEnabled(true);
    })();
  }, []);

  const handleToggleBiometric = async (value: boolean) => {
    impactMedium();
    if (value) {
      setPinSetupVisible(true);
    } else {
      setBiometricEnabled(false);
      await SecureStore.setItemAsync('equinox_biometric_enabled', 'false');
      await SecureStore.deleteItemAsync('equinox_security_pin');
    }
  };

  const handlePinSetupSuccess = async (pin: string) => {
    setPinSetupVisible(false);
    setBiometricEnabled(true);
    await SecureStore.setItemAsync('equinox_security_pin', pin);
    await SecureStore.setItemAsync('equinox_biometric_enabled', 'true');
    notificationSuccess();
  };

  // Positions Tab
  const [activeBottomTab, setActiveBottomTab] = useState<'positions' | 'orders' | 'history'>('positions');

  // Filter 200+ markets array by Category and Search Query
  const filteredMarkets = MARKETS.filter((m: MarketInfo) => {
    const matchesSearch =
      m.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.baseAsset.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Poll positions & orders on-chain
  useEffect(() => {
    if (!wallet?.publicKey) return;
    let isSubscribed = true;

    const fetchOnChain = async () => {
      try {
        const [posList, orderList] = await Promise.all([
          readPositions(wallet.publicKey),
          readLimitOrders(wallet.publicKey),
        ]);
        if (isSubscribed) {
          setPositions(posList);
          setLimitOrders(orderList);
        }
      } catch {
        // Silently swallow network polling glitches
      }
    };

    fetchOnChain();
    const interval = setInterval(fetchOnChain, 5000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [wallet?.publicKey]);


  const shortAddress = wallet
    ? `${wallet.publicKey.slice(0, 4)}...${wallet.publicKey.slice(-4)}`
    : '';

  const handleConnectInstant = async () => {
    await connect();
    setWalletModalVisible(false);
  };

  const handleConnectFreighterApp = async () => {
    impactMedium();
    const res = await connectFreighterMobileApp();
    if (!res.success) {
      await handleConnectInstant();
    } else {
      setWalletModalVisible(false);
    }
  };

  const handleImportKeySubmit = async () => {
    setImportError('');
    const trimmed = importKeyInput.trim();
    if (!trimmed) {
      setImportError('Please paste or enter your secret key starting with S.');
      return;
    }
    if (!trimmed.startsWith('S') || trimmed.length !== 56) {
      setImportError('Invalid format. Stellar secret keys start with S and are 56 characters long.');
      return;
    }

    try {
      setIsImporting(true);
      await importKey(trimmed);
      setImportKeyInput('');
      setShowImportKey(false);
      setWalletModalVisible(false);
    } catch (err) {
      setImportError('Failed to import key. Please check that the secret key is valid.');
    } finally {
      setIsImporting(false);
    }
  };

  // Real Order Execution on Stellar Soroban Contract
  const handleExecuteOrder = async () => {
    if (!wallet?.publicKey || !marginInput) return;
    const marginVal = parseFloat(marginInput);
    if (isNaN(marginVal) || marginVal <= 0) return;

    try {
      setIsSubmittingOrder(true);
      const marginScaled = Math.trunc(marginVal * DECIMALS);
      const isLong = positionType === 'Long';
      const currentPx = livePriceData.price || selectedMarket.displayPrice || 67000;
      const tpScaled = tpInput ? Math.trunc(parseFloat(tpInput) * DECIMALS) : 0;
      const slScaled = slInput ? Math.trunc(parseFloat(slInput) * DECIMALS) : 0;
      const trailingStopScaled = trailingStopInput ? Math.trunc(parseFloat(trailingStopInput) * DECIMALS) : 0;

      let xdr = '';
      if (orderTab === 'Market') {
        xdr = await buildOpenPositionXDR(
          wallet.publicKey,
          wallet.publicKey,
          selectedMarket.symbol,
          marginScaled,
          leverage,
          isLong,
          tpScaled,
          slScaled,
          trailingStopScaled
        );
      } else {
        const triggerPx = triggerInput ? parseFloat(triggerInput) : currentPx;
        const triggerScaled = Math.trunc(triggerPx * DECIMALS);
        xdr = await buildPlaceLimitOrderXDR(
          wallet.publicKey,
          wallet.publicKey,
          selectedMarket.symbol,
          marginScaled,
          leverage,
          isLong,
          triggerScaled,
          tpScaled,
          slScaled,
          trailingStopScaled
        );
      }

      await signAndSubmit(xdr);

      // Trigger haptics, audio, and native OS push notification banner
      notificationSuccess();
      soundEngine.playOrderSubmitted();
      sendOrderExecutedNotification(
        `${selectedMarket.baseAsset}/USDC`,
        positionType === 'Long',
        marginVal,
        leverage
      );
      Alert.alert(
        'Order Successful',
        `Successfully placed ${leverage}x ${positionType} on ${selectedMarket.symbol}.`
      );

      setMarginInput('');
      setTriggerInput('');
      setTpInput('');
      setSlInput('');
      setTrailingStopInput('');

      // Refresh positions & balances
      await refreshBalances();
      const posList = await readPositions(wallet.publicKey);
      setPositions(posList);
    } catch (err: any) {
      notificationError();
      Alert.alert(
        'Order Failed',
        err?.message || 'An error occurred while placing the order. Please check your testnet balance.'
      );
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // On-Chain Partial Close Execution Handler
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
      Alert.alert(
        'Position Closed',
        `Successfully closed ${closePct}% of your position.`
      );

      setCloseModalVisible(false);
      setSelectedPosForClose(null);

      // Refresh on-chain positions
      await refreshBalances();
      const posList = await readPositions(wallet.publicKey);
      setPositions(posList);
    } catch (err: any) {
      notificationError();
      Alert.alert(
        'Close Failed',
        err?.message || 'An error occurred while closing the position.'
      );
    } finally {
      setIsClosingPosition(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        {/* Market Selector Button */}
        <TouchableOpacity
          style={styles.marketSelectorBtn}
          onPress={() => setMarketModalVisible(true)}
        >
          <View style={styles.marketSelectorTextRow}>
            <Text style={styles.marketSelectorSymbol}>
              {selectedMarket.baseAsset}/USDC
            </Text>
            <View style={styles.leverageBadge}>
              <Text style={styles.leverageBadgeText}>{selectedMarket.maxLeverage}x</Text>
            </View>
          </View>
          <ChevronDown size={16} color={colors.textMuted} />
        </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            {/* Price Alert Bell Button */}
            <TouchableOpacity
              style={styles.bellHeaderBtn}
              onPress={() => {
                impactMedium();
                setPriceAlertModalVisible(true);
              }}
            >
              <Bell size={18} color={activeAlertsCount > 0 ? colors.brand : colors.textSecondary} />
              {activeAlertsCount > 0 && <View style={styles.bellBadgeDot} />}
            </TouchableOpacity>

            {/* Wallet Button */}
            <TouchableOpacity
              style={[styles.walletBtn, connected && styles.walletBtnConnected]}
              onPress={() => setWalletModalVisible(true)}
            >
              <Wallet size={16} color={connected ? colors.brand : colors.textPrimary} />
              <Text style={[styles.walletBtnText, connected && styles.walletBtnTextConnected]}>
                {connected ? shortAddress : 'Connect Wallet'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Price & 24h Ticker Bar */}
        <View style={styles.tickerBar}>
          <View style={styles.priceContainer}>
            <Text style={styles.currentPrice}>
              {livePriceData.price > 0
                ? `$${livePriceData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : (selectedMarket.displayPrice ? `$${selectedMarket.displayPrice.toFixed(2)}` : '$67,234.50')}
            </Text>
            <View style={styles.changeBadge}>
              {livePriceData.change24h >= 0 ? (
                <ArrowUpRight size={14} color={colors.success} />
              ) : (
                <ArrowDownRight size={14} color={colors.danger} />
              )}
              <Text
                style={[
                  styles.changeText,
                  { color: livePriceData.change24h >= 0 ? colors.success : colors.danger },
                ]}
              >
                {livePriceData.change24h >= 0 ? '+' : ''}
                {livePriceData.change24h !== 0
                  ? `${livePriceData.change24h.toFixed(2)}%`
                  : `${selectedMarket.change24h ?? 3.42}%`}
              </Text>
            </View>
          </View>

          <View style={styles.tickerStats}>
            <View style={styles.tickerStatItem}>
              <Text style={styles.tickerStatLabel}>24h High</Text>
              <Text style={styles.tickerStatValue}>
                {livePriceData.high24h > 0
                  ? `$${livePriceData.high24h.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '$68,120.00'}
              </Text>
            </View>
            <View style={styles.tickerStatItem}>
              <Text style={styles.tickerStatLabel}>24h Low</Text>
              <Text style={styles.tickerStatValue}>
                {livePriceData.low24h > 0
                  ? `$${livePriceData.low24h.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '$65,400.00'}
              </Text>
            </View>
            <View style={styles.tickerStatItem}>
              <Text style={styles.tickerStatLabel}>24h Vol</Text>
              <Text style={styles.tickerStatValue}>
                {livePriceData.volume24h > 0
                  ? `$${(livePriceData.volume24h / 1000000).toFixed(2)}M`
                  : '$1.24B'}
              </Text>
            </View>
          </View>
        </View>

        {/* Chart View Area */}
        <View style={styles.chartArea}>
          <View style={styles.timeframeRow}>
            {['1m', '5m', '15m', '1h', '4h', '1D'].map((tf) => (
              <TouchableOpacity
                key={tf}
                style={[styles.tfChip, tf === '1h' && styles.tfChipActive]}
              >
                <Text style={[styles.tfText, tf === '1h' && styles.tfTextActive]}>{tf}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TradingChart
            symbol={selectedMarket.symbol}
            baseAsset={selectedMarket.baseAsset}
            currentPrice={livePriceData.price > 0 ? livePriceData.price : (selectedMarket.displayPrice ?? 67234.50)}
          />
        </View>

        {/* Order Book Preview */}
        <View style={styles.orderbookContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <Text style={styles.sectionHeader}>Order Book</Text>
          </View>
          <View style={styles.orderbookHeaderRow}>
            <Text style={styles.obColHeader}>Price (USDC)</Text>
            <Text style={styles.obColHeader}>Size ({selectedMarket.baseAsset})</Text>
            <Text style={[styles.obColHeader, { textAlign: 'right' }]}>Total</Text>
          </View>
          {/* Asks (Red) */}
          {(liveOrderBook.asks.length > 0 ? liveOrderBook.asks : [
            { price: '67,240.00', size: '0.450', total: '30,258.00' },
            { price: '67,238.50', size: '1.200', total: '80,686.20' },
            { price: '67,236.00', size: '0.180', total: '12,102.48' },
          ]).map((item, idx) => (
            <View key={`ask-${idx}`} style={styles.obRow}>
              <Text style={[styles.obPrice, { color: colors.danger }]}>{item.price}</Text>
              <Text style={styles.obSize}>{item.size}</Text>
              <Text style={styles.obTotal}>{item.total}</Text>
            </View>
          ))}
          {/* Mid Price Spread */}
          <View style={styles.obSpreadRow}>
            <Text style={styles.obSpreadPrice}>
              {livePriceData.price > 0 ? livePriceData.price.toFixed(2) : '67,234.50'}
            </Text>
            <Text style={styles.obSpreadLabel}>Spread: {liveOrderBook.spread || '1.50'}</Text>
          </View>
          {/* Bids (Green) */}
          {(liveOrderBook.bids.length > 0 ? liveOrderBook.bids : [
            { price: '67,233.00', size: '0.820', total: '55,131.06' },
            { price: '67,231.50', size: '2.400', total: '161,355.60' },
            { price: '67,228.00', size: '0.350', total: '23,529.80' },
          ]).map((item, idx) => (
            <View key={`bid-${idx}`} style={styles.obRow}>
              <Text style={[styles.obPrice, { color: colors.success }]}>{item.price}</Text>
              <Text style={styles.obSize}>{item.size}</Text>
              <Text style={styles.obTotal}>{item.total}</Text>
            </View>
          ))}
        </View>

        {/* Order Form */}
        <View style={styles.orderFormCard}>
          <Text style={styles.sectionHeader}>Place Order</Text>

          {/* Market / Limit Tabs */}
          <View style={styles.tabGroup}>
            <TouchableOpacity
              style={[styles.tabBtn, orderTab === 'Market' && styles.tabBtnActive]}
              onPress={() => {
                impactMedium();
                setOrderTab('Market');
              }}
            >
              <Text style={[styles.tabText, orderTab === 'Market' && styles.tabTextActive]}>
                Market
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, orderTab === 'Limit' && styles.tabBtnActive]}
              onPress={() => {
                impactMedium();
                setOrderTab('Limit');
              }}
            >
              <Text style={[styles.tabText, orderTab === 'Limit' && styles.tabTextActive]}>
                Limit
              </Text>
            </TouchableOpacity>
          </View>

          {/* Long / Short Direction Toggle */}
          <View style={styles.directionToggleRow}>
            <TouchableOpacity
              style={[
                styles.dirBtn,
                positionType === 'Long' ? styles.longActive : styles.dirInactive,
              ]}
              onPress={() => {
                impactMedium();
                setPositionType('Long');
              }}
            >
              <Text
                style={[
                  styles.dirText,
                  positionType === 'Long' ? styles.longText : styles.inactiveText,
                ]}
              >
                Buy / Long
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dirBtn,
                positionType === 'Short' ? styles.shortActive : styles.dirInactive,
              ]}
              onPress={() => {
                impactMedium();
                setPositionType('Short');
              }}
            >
              <Text
                style={[
                  styles.dirText,
                  positionType === 'Short' ? styles.shortText : styles.inactiveText,
                ]}
              >
                Sell / Short
              </Text>
            </TouchableOpacity>
          </View>

          {/* Trigger Price Input (For Limit orders) */}
          {orderTab === 'Limit' && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Trigger Price</Text>
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.textInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.textDim}
                  keyboardType="numeric"
                  value={triggerInput}
                  onChangeText={setTriggerInput}
                />
                <Text style={styles.inputSuffix}>USDC</Text>
              </View>
            </View>
          )}

          {/* Margin Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputLabelRow}>
              <Text style={styles.inputLabel}>Margin Collateral</Text>
              <Text style={styles.availableText}>
                Avail: {balances ? `${balances.usdc} USDC` : '0.00 USDC'}
              </Text>
            </View>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                placeholder="0.00"
                placeholderTextColor={colors.textDim}
                keyboardType="numeric"
                value={marginInput}
                onChangeText={setMarginInput}
              />
              <Text style={styles.inputSuffix}>USDC</Text>
            </View>
          </View>

          {/* Quick Margin % Selector Buttons */}
          <View style={styles.quickPctRow}>
            {[25, 50, 75, 100].map((pct) => (
              <TouchableOpacity
                key={pct}
                style={styles.quickPctBtn}
                onPress={() => {
                  impactLight();
                  const avail = balances ? parseFloat(balances.usdc) || 0 : 0;
                  setMarginInput(((avail * pct) / 100).toFixed(2));
                }}
              >
                <Text style={styles.quickPctText}>{pct === 100 ? 'MAX' : `${pct}%`}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Leverage Selector */}
          <View style={styles.leverageHeaderRow}>
            <Text style={styles.inputLabel}>Leverage Multiplier</Text>
            <Text style={styles.leverageValueText}>{leverage}x</Text>
          </View>
          <View style={styles.leverageChipsRow}>
            {[1, 5, 10, 25, 50].map((lev) => (
              <TouchableOpacity
                key={lev}
                style={[
                  styles.levChip,
                  leverage === lev && styles.levChipActive,
                ]}
                onPress={() => {
                  impactLight();
                  setLeverage(lev);
                }}
              >
                <Text style={[styles.levChipText, leverage === lev && styles.levChipTextActive]}>
                  {lev}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Advanced Risk Management: TP / SL & Trailing Stop Toggle */}
          <TouchableOpacity
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: spacing.md }}
            onPress={() => {
              impactLight();
              setShowTpSl(!showTpSl);
            }}
          >
            <Text style={styles.inputLabel}>Take Profit / Stop Loss / Trailing Stop</Text>
            <ChevronDown size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {showTpSl && (
            <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Take Profit Price</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0.00"
                    placeholderTextColor={colors.textDim}
                    keyboardType="numeric"
                    value={tpInput}
                    onChangeText={setTpInput}
                  />
                  <Text style={styles.inputSuffix}>USDC</Text>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Stop Loss Price</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0.00"
                    placeholderTextColor={colors.textDim}
                    keyboardType="numeric"
                    value={slInput}
                    onChangeText={setSlInput}
                  />
                  <Text style={styles.inputSuffix}>USDC</Text>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Trailing Stop Distance</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 50.00"
                    placeholderTextColor={colors.textDim}
                    keyboardType="numeric"
                    value={trailingStopInput}
                    onChangeText={setTrailingStopInput}
                  />
                  <Text style={styles.inputSuffix}>USDC</Text>
                </View>
              </View>
            </View>
          )}

          {/* Action Submit Button */}
          {!connected ? (
            <TouchableOpacity
              style={styles.connectCtaBtn}
              onPress={() => setWalletModalVisible(true)}
            >
              <Wallet size={18} color="#ffffff" />
              <Text style={styles.connectCtaText}>Connect Wallet to Trade</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.submitOrderBtn,
                positionType === 'Long' ? styles.submitLongBtn : styles.submitShortBtn,
                isSubmittingOrder && { opacity: 0.6 }
              ]}
              onPress={handleExecuteOrder}
              disabled={isSubmittingOrder}
            >
              {isSubmittingOrder ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitOrderText}>
                  {orderTab} {positionType} {selectedMarket.baseAsset}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Positions & Orders Section */}
        <View style={styles.positionsCard}>
          <View style={styles.posTabRow}>
            <TouchableOpacity
              style={[
                styles.posTabItem,
                activeBottomTab === 'positions' && styles.posTabItemActive,
              ]}
              onPress={() => setActiveBottomTab('positions')}
            >
              <Layers size={14} color={activeBottomTab === 'positions' ? colors.brand : colors.textMuted} />
              <Text
                style={[
                  styles.posTabText,
                  activeBottomTab === 'positions' && styles.posTabTextActive,
                ]}
              >
                Positions ({positions.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.posTabItem,
                activeBottomTab === 'orders' && styles.posTabItemActive,
              ]}
              onPress={() => setActiveBottomTab('orders')}
            >
              <SlidersHorizontal size={14} color={activeBottomTab === 'orders' ? colors.brand : colors.textMuted} />
              <Text
                style={[
                  styles.posTabText,
                  activeBottomTab === 'orders' && styles.posTabTextActive,
                ]}
              >
                Orders ({limitOrders.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.posTabItem,
                activeBottomTab === 'history' && styles.posTabItemActive,
              ]}
              onPress={() => setActiveBottomTab('history')}
            >
              <History size={14} color={activeBottomTab === 'history' ? colors.brand : colors.textMuted} />
              <Text
                style={[
                  styles.posTabText,
                  activeBottomTab === 'history' && styles.posTabTextActive,
                ]}
              >
                History
              </Text>
            </TouchableOpacity>
          </View>

          {activeBottomTab === 'positions' && positions.length > 0 ? (
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              {positions.map((pos) => {
                const marginUsdc = (pos.margin / DECIMALS).toFixed(2);
                const entryPx = (pos.entry_price / DECIMALS).toFixed(2);
                const isLong = pos.is_long;

                return (
                  <View key={pos.id} style={styles.walletBalCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.marketItemSymbol}>{pos.symbol || 'PERP'}</Text>
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
                          style={{ backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.danger }}
                          onPress={() => {
                            impactMedium();
                            setSelectedPosForClose(pos);
                            setClosePct(100);
                            setCloseModalVisible(true);
                          }}
                        >
                          <Text style={{ color: colors.danger, fontSize: fontSize.xs, fontWeight: '700' }}>Partial Close</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                      <View>
                        <Text style={styles.balCardLabel}>Margin</Text>
                        <Text style={styles.balCardVal}>${marginUsdc} USDC</Text>
                      </View>
                      <View>
                        <Text style={styles.balCardLabel}>Entry Price</Text>
                        <Text style={styles.balCardVal}>${entryPx}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.balCardLabel}>Position ID</Text>
                        <Text style={[styles.balCardVal, { color: colors.textPrimary }]}>
                          #{pos.id}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Active {activeBottomTab.toUpperCase()}</Text>
              <Text style={styles.emptySubtitle}>
                Your live open positions and limit orders will appear here
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Market Selector Modal */}
      <Modal
        visible={marketModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMarketModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Market</Text>
              <TouchableOpacity onPress={() => setMarketModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchBox}>
              <Search size={16} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search market by asset or symbol..."
                placeholderTextColor={colors.textDim}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Category Filter Chips Bar */}
            <View style={{ marginVertical: spacing.sm }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, paddingHorizontal: 2 }}>
                {['All', 'Top', 'Layer 1', 'Memes', 'AI', 'DeFi', 'RWA'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.levChip,
                      selectedCategory === cat && styles.levChipActive,
                      { paddingHorizontal: spacing.md, paddingVertical: spacing.xs }
                    ]}
                    onPress={() => {
                      impactLight();
                      setSelectedCategory(cat);
                    }}
                  >
                    <Text style={[styles.levChipText, selectedCategory === cat && styles.levChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Markets List */}
            <FlatList
              data={filteredMarkets}
              keyExtractor={(item) => item.symbol}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.marketListItem,
                    selectedMarket.symbol === item.symbol && styles.marketListItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedMarket(item);
                    setMarketModalVisible(false);
                  }}
                >
                  <View>
                    <Text style={styles.marketItemSymbol}>{item.baseAsset}/USDC</Text>
                    <Text style={styles.marketItemName}>{item.name}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.marketItemPrice}>
                      ${item.displayPrice ? item.displayPrice.toFixed(2) : '---'}
                    </Text>
                    <Text
                      style={[
                        styles.marketItemChange,
                        { color: (item.change24h ?? 0) >= 0 ? colors.success : colors.danger },
                      ]}
                    >
                      {(item.change24h ?? 0) >= 0 ? '+' : ''}
                      {item.change24h ?? 0}%
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Wallet Connection Modal */}
      <Modal
        visible={walletModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setWalletModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {connected ? 'Wallet Account' : 'Connect Wallet'}
              </Text>
              <TouchableOpacity onPress={() => setWalletModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={colors.brand} />
                <Text style={styles.loadingText}>Funding testnet account...</Text>
              </View>
            ) : connected ? (
              <View style={styles.walletInfoBox}>
                <Text style={styles.walletInfoLabel}>Stellar Address</Text>
                <Text style={styles.walletInfoAddress}>{wallet?.publicKey}</Text>

                <View style={styles.walletBalanceRow}>
                  <View style={styles.walletBalCard}>
                    <Text style={styles.balCardLabel}>USDC Balance</Text>
                    <Text style={styles.balCardVal}>{balances?.usdc ?? '0.00'}</Text>
                  </View>
                  <View style={styles.walletBalCard}>
                    <Text style={styles.balCardLabel}>XLM Balance</Text>
                    <Text style={styles.balCardVal}>{balances?.xlm ?? '0.00'}</Text>
                  </View>
                </View>

                {/* Secret Key Export & Backup Card */}
                {wallet?.secretKey && (
                  <View style={styles.secretKeyCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Key size={16} color={colors.warning} />
                        <Text style={styles.secretKeyTitle}>Backup Secret Key</Text>
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
                          {showSecretKey ? 'Hide' : 'Reveal Key'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {showSecretKey && (
                      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                        <View style={styles.warningBanner}>
                          <ShieldAlert size={16} color={colors.warning} />
                          <Text style={styles.warningText}>
                            NEVER share this key with anyone. Anyone with this key can access your funds.
                          </Text>
                        </View>

                        <Text style={styles.secretKeyText} numberOfLines={2}>
                          {wallet.secretKey}
                        </Text>

                        <TouchableOpacity
                          style={styles.copySecretBtn}
                          onPress={async () => {
                            impactMedium();
                            await Clipboard.setStringAsync(wallet.secretKey);
                            setCopiedSecretKey(true);
                            notificationSuccess();
                            setTimeout(() => setCopiedSecretKey(false), 2500);
                          }}
                        >
                          {copiedSecretKey ? <Check size={16} color="#ffffff" /> : <ClipboardIcon size={16} color="#ffffff" />}
                          <Text style={styles.copySecretText}>
                            {copiedSecretKey ? 'Copied Secret Key!' : 'Copy Secret Key'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                {/* Biometric Hardware Security Toggle Card */}
                <View style={styles.biometricToggleCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 }}>
                    <Fingerprint size={18} color={colors.brand} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.biometricToggleTitle}>Biometric Lock (Face ID / Touch)</Text>
                      <Text style={styles.biometricToggleSub}>Require biometric hardware scan when launching app</Text>
                    </View>
                  </View>
                  <Switch
                    trackColor={{ false: colors.border, true: 'rgba(16, 185, 129, 0.4)' }}
                    thumbColor={biometricEnabled ? colors.brand : colors.textMuted}
                    value={biometricEnabled}
                    onValueChange={handleToggleBiometric}
                  />
                </View>

                <TouchableOpacity
                  style={styles.disconnectBtn}
                  onPress={() => {
                    impactMedium();
                    setShowDisconnectConfirm(true);
                  }}
                >
                  <LogOut size={16} color={colors.danger} />
                  <Text style={styles.disconnectText}>Disconnect Wallet</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.walletOptionsContainer}>
                {/* Instant Embedded Keypair Wallet Option */}
                <TouchableOpacity
                  style={styles.walletOptionCard}
                  onPress={handleConnectInstant}
                >
                  <Zap size={24} color={colors.brand} />
                  <View style={styles.walletOptionTextGroup}>
                    <Text style={styles.walletOptionTitle}>Create Instant Account</Text>
                    <Text style={styles.walletOptionSub}>
                      Generate non-custodial testnet wallet funded with 10,000 XLM
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 1-Tap Freighter App Deep Link Option */}
                <TouchableOpacity
                  style={styles.walletOptionCard}
                  onPress={handleConnectFreighterApp}
                >
                  <Wallet size={24} color={colors.brand} />
                  <View style={styles.walletOptionTextGroup}>
                    <Text style={styles.walletOptionTitle}>Connect Freighter App</Text>
                    <Text style={styles.walletOptionSub}>
                      1-Tap deep link to open and approve session in Freighter Mobile
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Import Key Option */}
                {!showImportKey ? (
                  <TouchableOpacity
                    style={styles.walletOptionCard}
                    onPress={() => setShowImportKey(true)}
                  >
                    <Key size={24} color={colors.info} />
                    <View style={styles.walletOptionTextGroup}>
                      <Text style={styles.walletOptionTitle}>Import Secret Key</Text>
                      <Text style={styles.walletOptionSub}>
                        Enter an existing Stellar S... secret key
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.importKeyBox}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.inputLabel}>Secret Key (Starts with S)</Text>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.brand }}
                        onPress={async () => {
                          impactMedium();
                          const text = await Clipboard.getStringAsync();
                          if (text) {
                            setImportKeyInput(text.trim());
                            setImportError('');
                            notificationSuccess();
                          }
                        }}
                      >
                        <ClipboardIcon size={14} color={colors.brand} />
                        <Text style={{ color: colors.brand, fontSize: fontSize.xs, fontWeight: '700' }}>
                          Paste Key
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={[styles.inputBox, { marginVertical: spacing.xs }]}>
                      <TextInput
                        style={styles.textInput}
                        placeholder="SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                        placeholderTextColor={colors.textDim}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        value={importKeyInput}
                        onChangeText={(val) => {
                          setImportKeyInput(val);
                          setImportError('');
                        }}
                      />
                    </View>

                    {!!importError && (
                      <Text style={{ color: colors.danger, fontSize: fontSize.xs, marginTop: 2 }}>
                        {importError}
                      </Text>
                    )}

                    <TouchableOpacity
                      style={[styles.importSubmitBtn, isImporting && { opacity: 0.6 }]}
                      onPress={handleImportKeySubmit}
                      disabled={isImporting}
                    >
                      {isImporting ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.importSubmitText}>Import Keypair</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Partial Position Close Modal */}
      <Modal
        visible={closeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCloseModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
                <View style={styles.walletBalCard}>
                  <Text style={styles.balCardLabel}>Total Position Margin</Text>
                  <Text style={styles.balCardVal}>
                    ${(selectedPosForClose.margin / DECIMALS).toFixed(2)} USDC
                  </Text>
                </View>

                <Text style={styles.inputLabel}>Select Percentage to Close</Text>
                <View style={styles.quickPctRow}>
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
                        {pct === 100 ? '100% (Full)' : `${pct}%`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm }}>
                  <Text style={styles.balCardLabel}>Margin to Close</Text>
                  <Text style={[styles.balCardVal, { color: colors.brand }]}>
                    ${(((selectedPosForClose.margin / DECIMALS) * closePct) / 100).toFixed(2)} USDC
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.disconnectBtn, { backgroundColor: colors.danger, borderColor: colors.danger, marginTop: spacing.md }, isClosingPosition && { opacity: 0.6 }]}
                  onPress={handleExecuteClosePosition}
                  disabled={isClosingPosition}
                >
                  {isClosingPosition ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={[styles.disconnectText, { color: '#ffffff', fontWeight: '700' }]}>
                      Confirm Close ({closePct}%)
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* PnL Share Card Modal */}
      <PnLShareModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        position={selectedPosForShare}
        currentPrice={livePriceData.price}
        referralCode={wallet?.publicKey}
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
                  setWalletModalVisible(false);
                }}
              >
                <Text style={{ color: '#ffffff', fontSize: fontSize.sm, fontWeight: '700' }}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Price Alert Setting Modal */}
      <PriceAlertModal
        visible={priceAlertModalVisible}
        onClose={() => setPriceAlertModalVisible(false)}
        symbol={selectedMarket.symbol}
        currentPrice={livePriceData.price}
        alerts={priceAlerts}
        onAddAlert={addPriceAlertItem}
        onRemoveAlert={removePriceAlertItem}
        onClearTriggered={clearTriggeredAlerts}
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

  // Top Header
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  marketSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  marketSelectorTextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  marketSelectorSymbol: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  bellHeaderBtn: { backgroundColor: colors.surface, padding: spacing.xs + 2, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border, position: 'relative' },
  bellBadgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, position: 'absolute', top: -2, right: -2 },
  leverageBadge: {
    backgroundColor: colors.brandDim,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  leverageBadgeText: { color: colors.brand, fontSize: fontSize.xs, fontWeight: '700' },

  walletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  walletBtnConnected: { borderColor: colors.brand, backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  walletBtnText: { color: colors.textPrimary, fontSize: fontSize.xs, fontWeight: '600' },
  walletBtnTextConnected: { color: colors.brand, fontFamily: 'Courier' },

  // Ticker Bar
  tickerBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  priceContainer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  currentPrice: { color: colors.textPrimary, fontSize: fontSize.xxl, fontWeight: '700', fontFamily: 'Courier' },
  changeBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  changeText: { color: colors.success, fontSize: fontSize.sm, fontWeight: '600' },

  tickerStats: { flexDirection: 'row', marginTop: spacing.sm, gap: spacing.xl },
  tickerStatItem: {},
  tickerStatLabel: { color: colors.textMuted, fontSize: fontSize.xs },
  tickerStatValue: { color: colors.textPrimary, fontSize: fontSize.xs, fontWeight: '600', fontFamily: 'Courier', marginTop: 2 },

  // Chart Area
  chartArea: { borderBottomWidth: 1, borderBottomColor: colors.border },
  timeframeRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, gap: spacing.xs },
  tfChip: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  tfChipActive: { backgroundColor: colors.surfaceElevated },
  tfText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600' },
  tfTextActive: { color: colors.brand },
  chartPlaceholder: {
    height: 180,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  chartTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },
  chartSubtitle: { color: colors.textDim, fontSize: fontSize.xs },

  // Order Book
  orderbookContainer: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  sectionHeader: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700', marginBottom: spacing.md },
  orderbookHeaderRow: { flexDirection: 'row', marginBottom: spacing.xs },
  obColHeader: { flex: 1, color: colors.textDim, fontSize: fontSize.xs, fontWeight: '600' },
  obRow: { flexDirection: 'row', paddingVertical: 2 },
  obPrice: { flex: 1, fontSize: fontSize.xs, fontFamily: 'Courier', fontWeight: '600' },
  obSize: { flex: 1, color: colors.textSecondary, fontSize: fontSize.xs, fontFamily: 'Courier' },
  obTotal: { flex: 1, color: colors.textMuted, fontSize: fontSize.xs, fontFamily: 'Courier', textAlign: 'right' },
  obSpreadRow: { paddingVertical: spacing.xs, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, marginVertical: spacing.xs, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  obSpreadPrice: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '700', fontFamily: 'Courier' },
  obSpreadLabel: { color: colors.textMuted, fontSize: fontSize.xs },

  // Order Form
  orderFormCard: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabGroup: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 2, marginBottom: spacing.md },
  tabBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.md - 2 },
  tabBtnActive: { backgroundColor: colors.surfaceElevated },
  tabText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
  tabTextActive: { color: colors.textPrimary },

  directionToggleRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  dirBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: borderRadius.md, borderWidth: 1 },
  dirInactive: { borderColor: colors.border, backgroundColor: colors.surface },
  longActive: { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: colors.long },
  shortActive: { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: colors.short },
  dirText: { fontSize: fontSize.md, fontWeight: '700' },
  longText: { color: colors.long },
  shortText: { color: colors.short },
  inactiveText: { color: colors.textMuted },

  inputContainer: { marginBottom: spacing.md },
  inputLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  inputLabel: { color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing.xs },
  availableText: { color: colors.textSecondary, fontSize: fontSize.xs, fontFamily: 'Courier' },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  textInput: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md, fontFamily: 'Courier', paddingVertical: spacing.sm },
  inputSuffix: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600' },

  quickPctRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  quickPctBtn: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, alignItems: 'center' },
  quickPctText: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '600' },

  leverageHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  leverageValueText: { color: colors.brand, fontSize: fontSize.sm, fontWeight: '700', fontFamily: 'Courier' },
  leverageChipsRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg },
  levChip: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, alignItems: 'center' },
  levChipActive: { borderColor: colors.brand, backgroundColor: 'rgba(16, 185, 129, 0.15)' },
  levChipText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600' },
  levChipTextActive: { color: colors.brand },

  connectCtaBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brand,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  connectCtaText: { color: '#ffffff', fontSize: fontSize.md, fontWeight: '700' },

  submitOrderBtn: { paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  submitLongBtn: { backgroundColor: colors.long },
  submitShortBtn: { backgroundColor: colors.short },
  submitOrderText: { color: '#ffffff', fontSize: fontSize.md, fontWeight: '700' },

  // Positions Card
  positionsCard: { padding: spacing.lg },
  posTabRow: { flexDirection: 'row', gap: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm, marginBottom: spacing.md },
  posTabItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingBottom: spacing.xs },
  posTabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.brand },
  posTabText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600' },
  posTabTextActive: { color: colors.textPrimary },

  emptyContainer: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyTitle: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },
  emptySubtitle: { color: colors.textDim, fontSize: fontSize.xs, marginTop: 2 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surfaceElevated, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },

  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: fontSize.sm, paddingVertical: spacing.sm, marginLeft: spacing.xs },

  marketListItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  marketListItemSelected: { backgroundColor: 'rgba(16, 185, 129, 0.05)' },
  marketItemSymbol: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  marketItemName: { color: colors.textMuted, fontSize: fontSize.xs },
  marketItemPrice: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600', fontFamily: 'Courier' },
  marketItemChange: { fontSize: fontSize.xs, fontWeight: '600', marginTop: 2 },

  // Wallet Modal
  loadingBox: { paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.md },
  loadingText: { color: colors.textSecondary, fontSize: fontSize.sm },
  walletInfoBox: { gap: spacing.md },
  walletInfoLabel: { color: colors.textMuted, fontSize: fontSize.xs },
  walletInfoAddress: { color: colors.brand, fontSize: fontSize.xs, fontFamily: 'Courier', backgroundColor: colors.surface, padding: spacing.sm, borderRadius: borderRadius.sm },
  walletBalanceRow: { flexDirection: 'row', gap: spacing.md },
  walletBalCard: { flex: 1, backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
  balCardLabel: { color: colors.textMuted, fontSize: fontSize.xs },
  balCardVal: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700', fontFamily: 'Courier', marginTop: 2 },
  disconnectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderColor: colors.danger, paddingVertical: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.md },
  disconnectText: { color: colors.danger, fontSize: fontSize.sm, fontWeight: '600' },

  walletOptionsContainer: { gap: spacing.md },
  walletOptionCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, padding: spacing.lg, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
  walletOptionTextGroup: { flex: 1 },
  walletOptionTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  walletOptionSub: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },

  // Secret Key Backup Card Styles
  secretKeyCard: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.warning },
  secretKeyTitle: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '700' },
  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: 'rgba(234, 179, 8, 0.15)', padding: spacing.sm, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.warning },
  warningText: { color: colors.warning, fontSize: fontSize.xs, flex: 1, fontWeight: '600' },
  secretKeyText: { color: colors.textPrimary, fontSize: fontSize.xs, fontFamily: 'Courier', backgroundColor: colors.background, padding: spacing.md, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border },
  copySecretBtn: { height: 40, backgroundColor: colors.brand, borderRadius: borderRadius.md, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  copySecretText: { color: '#ffffff', fontSize: fontSize.xs, fontWeight: '700' },

  // Biometric Toggle Card Styles
  biometricToggleCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
  biometricToggleTitle: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '700' },
  biometricToggleSub: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },

  importKeyBox: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  importSubmitBtn: { backgroundColor: colors.info, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  importSubmitText: { color: '#ffffff', fontSize: fontSize.sm, fontWeight: '700' },
});
