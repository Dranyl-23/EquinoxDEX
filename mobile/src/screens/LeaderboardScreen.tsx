import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy, Medal, Award, Sparkles } from 'lucide-react-native';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { readLeaderboard } from '../lib/contract';
import { DECIMALS } from '../lib/constants';

interface LeaderboardItem {
  rank: number;
  address: string;
  pnl: number;
}

export default function LeaderboardScreen() {
  const [data, setData] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isSubscribed = true;

    const fetchLeaderboard = async () => {
      try {
        setHasError(false);
        const raw = await readLeaderboard();
        if (!isSubscribed) return;

        if (raw && raw.length > 0) {
          const formatted = raw.map((item, index) => ({
            rank: index + 1,
            address: `${item.user.slice(0, 6)}...${item.user.slice(-4)}`,
            pnl: item.total_pnl / DECIMALS,
          }));
          setData(formatted);
        } else {
          setData([]);
        }
      } catch {
        if (isSubscribed) setHasError(true);
      } finally {
        if (isSubscribed) setLoading(false);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000); // 30s interval
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, []);

  const renderItem = ({ item }: { item: LeaderboardItem }) => (
    <View style={styles.row}>
      <View style={styles.rankCol}>
        {item.rank === 1 ? (
          <View style={[styles.badgeContainer, { backgroundColor: 'rgba(234, 179, 8, 0.2)' }]}>
            <Trophy size={16} color="#eab308" />
          </View>
        ) : item.rank === 2 ? (
          <View style={[styles.badgeContainer, { backgroundColor: 'rgba(148, 163, 184, 0.2)' }]}>
            <Medal size={16} color="#94a3b8" />
          </View>
        ) : item.rank === 3 ? (
          <View style={[styles.badgeContainer, { backgroundColor: 'rgba(180, 83, 9, 0.2)' }]}>
            <Award size={16} color="#b45309" />
          </View>
        ) : (
          <Text style={styles.rankText}>#{item.rank}</Text>
        )}
      </View>
      <View style={styles.addressCol}>
        <Text style={styles.addressText}>{item.address}</Text>
      </View>
      <View style={styles.pnlCol}>
        <Text style={[styles.pnlText, { color: item.pnl >= 0 ? colors.success : colors.danger }]}>
          {item.pnl >= 0 ? '+' : ''}${item.pnl.toFixed(2)}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Trophy size={24} color={colors.brand} />
          <Text style={styles.title}>Leaderboard</Text>
        </View>
        <Text style={styles.subtitle}>Top Traders Ranked by Realized PnL (Stellar Testnet)</Text>
      </View>

      {/* Column Headers */}
      <View style={styles.columnHeaders}>
        <Text style={[styles.colHeader, styles.rankCol]}>Rank</Text>
        <Text style={[styles.colHeader, styles.addressCol]}>Trader Address</Text>
        <Text style={[styles.colHeader, styles.pnlCol, { textAlign: 'right' }]}>Total PnL</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : hasError ? (
        <View style={styles.emptyContainer}>
          <Sparkles size={32} color={colors.danger} />
          <Text style={styles.emptyTitle}>Network Error</Text>
          <Text style={styles.emptySub}>
            Could not fetch leaderboard data from Stellar RPC node. Please check your connection.
          </Text>
        </View>
      ) : data.length > 0 ? (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item) => item.rank.toString()}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Sparkles size={32} color={colors.brand} />
          <Text style={styles.emptyTitle}>No Closed Trades Yet</Text>
          <Text style={styles.emptySub}>
            Be the first trader to open and close a position on-chain to claim the #1 Leaderboard Rank!
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { color: colors.textPrimary, fontSize: fontSize.xxl, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },

  columnHeaders: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  colHeader: { color: colors.textDim, fontSize: fontSize.xs, fontWeight: '600', textTransform: 'uppercase' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  separator: { height: 1, backgroundColor: colors.border },

  rankCol: { width: 60, alignItems: 'flex-start' },
  addressCol: { flex: 1 },
  pnlCol: { width: 110, alignItems: 'flex-end' },

  badgeContainer: { padding: spacing.xs, borderRadius: borderRadius.sm },
  rankText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '700', fontFamily: 'Courier' },
  addressText: { color: colors.textPrimary, fontSize: fontSize.sm, fontFamily: 'Courier' },
  pnlText: { fontSize: fontSize.sm, fontWeight: '700', fontFamily: 'Courier' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  emptyTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700', marginTop: spacing.md },
  emptySub: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.xs, lineHeight: 20 },
});
