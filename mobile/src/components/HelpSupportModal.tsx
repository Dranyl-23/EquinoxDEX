import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HelpCircle,
  X,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  FileText,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Lock,
} from 'lucide-react-native';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { impactLight, impactMedium } from '../lib/haptics';

interface HelpSupportModalProps {
  visible: boolean;
  onClose: () => void;
}

const FAQ_ITEMS = [
  {
    q: 'What is EquinoxDEX?',
    a: 'EquinoxDEX is a high-performance decentralized perpetuals exchange powered by Stellar Soroban smart contracts. It offers up to 100x leverage, instant 1-second settlement, and zero gas fee trading.',
  },
  {
    q: 'Are my funds non-custodial?',
    a: 'Yes, 100%! EquinoxDEX never holds your private keys. Your secret key is encrypted locally inside your phone’s Secure Enclave keychain. All withdrawals go directly back to your Stellar wallet.',
  },
  {
    q: 'How does Cross-Margin work?',
    a: 'Your total USDC balance acts as collateral across all your open positions simultaneously, optimizing capital efficiency and lowering liquidation risk.',
  },
  {
    q: 'How do Referral Kickbacks work?',
    a: 'Share your referral code/link. Whenever traders execute positions using your code, you automatically earn 20% of trading fees directly claimable on-chain on the Rewards screen.',
  },
];

export default function HelpSupportModal({ visible, onClose }: HelpSupportModalProps) {
  const insets = useSafeAreaInsets();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [activeLegalTab, setActiveLegalTab] = useState<'faq' | 'privacy' | 'terms'>('faq');

  const toggleFaq = (index: number) => {
    impactLight();
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const openSocialLink = async (url: string) => {
    impactMedium();
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch {
      // Graceful fallback
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
        <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xxl) }]}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <HelpCircle size={20} color={colors.brand} />
              <Text style={styles.modalTitle}>Help & Knowledge Center</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Navigation Category Tabs */}
          <View style={styles.tabGroup}>
            <TouchableOpacity
              style={[styles.tabBtn, activeLegalTab === 'faq' && styles.tabBtnActive]}
              onPress={() => {
                impactLight();
                setActiveLegalTab('faq');
              }}
            >
              <Text style={[styles.tabText, activeLegalTab === 'faq' && styles.tabTextActive]}>FAQ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeLegalTab === 'privacy' && styles.tabBtnActive]}
              onPress={() => {
                impactLight();
                setActiveLegalTab('privacy');
              }}
            >
              <Text style={[styles.tabText, activeLegalTab === 'privacy' && styles.tabTextActive]}>Privacy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeLegalTab === 'terms' && styles.tabBtnActive]}
              onPress={() => {
                impactLight();
                setActiveLegalTab('terms');
              }}
            >
              <Text style={[styles.tabText, activeLegalTab === 'terms' && styles.tabTextActive]}>Terms</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            {activeLegalTab === 'faq' && (
              <View style={{ gap: spacing.md }}>
                {/* Community & Support Links */}
                <View style={styles.communityBox}>
                  <Text style={styles.communityTitle}>Official Channels & Support</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                    <TouchableOpacity
                      style={styles.socialBtn}
                      onPress={() => openSocialLink('https://t.me/EquinoxDEX')}
                    >
                      <MessageSquare size={14} color={colors.brand} />
                      <Text style={styles.socialBtnText}>Telegram</Text>
                      <ExternalLink size={10} color={colors.brand} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.socialBtn}
                      onPress={() => openSocialLink('https://x.com/EquinoxDEX')}
                    >
                      <Sparkles size={14} color={colors.info} />
                      <Text style={[styles.socialBtnText, { color: colors.info }]}>Twitter / X</Text>
                      <ExternalLink size={10} color={colors.info} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* FAQ Accordion List */}
                <Text style={styles.sectionHeading}>FREQUENTLY ASKED QUESTIONS</Text>
                {FAQ_ITEMS.map((item, idx) => {
                  const isOpen = expandedFaq === idx;
                  return (
                    <View key={idx} style={styles.faqCard}>
                      <TouchableOpacity style={styles.faqHeader} onPress={() => toggleFaq(idx)}>
                        <Text style={styles.faqQuestion}>{item.q}</Text>
                        {isOpen ? (
                          <ChevronUp size={16} color={colors.brand} />
                        ) : (
                          <ChevronDown size={16} color={colors.textMuted} />
                        )}
                      </TouchableOpacity>
                      {isOpen && <Text style={styles.faqAnswer}>{item.a}</Text>}
                    </View>
                  );
                })}
              </View>
            )}

            {activeLegalTab === 'privacy' && (
              <View style={styles.legalContentBox}>
                <View style={styles.privacyHeader}>
                  <ShieldCheck size={28} color={colors.brand} />
                  <Text style={styles.legalTitle}>100% Privacy & Zero KYC</Text>
                </View>

                <Text style={styles.legalText}>
                  EquinoxDEX is built on the principle of self-sovereign financial privacy. We do not collect names, email addresses, phone numbers, or identity documents.
                </Text>
                <Text style={styles.legalSubHeading}>Key Privacy Assurances:</Text>
                <Text style={styles.bulletItem}>• Zero Tracking & Analytics Spying.</Text>
                <Text style={styles.bulletItem}>• Local Hardware Key Storage inside Secure Store.</Text>
                <Text style={styles.bulletItem}>• Peer-to-Peer Direct Soroban Contract Execution.</Text>
              </View>
            )}

            {activeLegalTab === 'terms' && (
              <View style={styles.legalContentBox}>
                <View style={styles.privacyHeader}>
                  <FileText size={28} color={colors.warning} />
                  <Text style={styles.legalTitle}>Terms of Service & Risk Disclaimer</Text>
                </View>

                <Text style={styles.legalText}>
                  Trading perpetual futures involves substantial risk of loss and is not suitable for all investors. Leverage can work against you as well as for you.
                </Text>
                <Text style={styles.legalSubHeading}>Protocol Disclaimer:</Text>
                <Text style={styles.bulletItem}>• EquinoxDEX is a decentralized software protocol.</Text>
                <Text style={styles.bulletItem}>• Traders maintain full responsibility for position risk management.</Text>
                <Text style={styles.bulletItem}>• Smart contract code operates autonomously on Stellar Soroban.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surfaceElevated, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700' },

  tabGroup: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 2, marginBottom: spacing.md },
  tabBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.md - 2 },
  tabBtnActive: { backgroundColor: colors.brand },
  tabText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700' },
  tabTextActive: { color: '#ffffff' },

  communityBox: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
  communityTitle: { color: colors.textPrimary, fontSize: fontSize.xs, fontWeight: '700' },
  socialBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16, 185, 129, 0.12)', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border },
  socialBtnText: { color: colors.brand, fontSize: fontSize.xs, fontWeight: '700' },

  sectionHeading: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: spacing.xs },
  faqCard: { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQuestion: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '700', flex: 1, marginRight: spacing.xs },
  faqAnswer: { color: colors.textSecondary, fontSize: fontSize.xs, lineHeight: 18, marginTop: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border },

  legalContentBox: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, gap: spacing.xs },
  privacyHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  legalTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  legalText: { color: colors.textSecondary, fontSize: fontSize.xs, lineHeight: 18 },
  legalSubHeading: { color: colors.textPrimary, fontSize: fontSize.xs, fontWeight: '700', marginTop: spacing.xs },
  bulletItem: { color: colors.textMuted, fontSize: fontSize.xs, marginLeft: spacing.xs },
});
