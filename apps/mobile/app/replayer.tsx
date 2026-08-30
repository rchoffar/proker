import { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronRight, History, Plus, Trash2 } from 'lucide-react-native';
import { GlassCard } from '../src/components/ui/GlassCard';
import { ScreenBackButton } from '../src/components/ui/ScreenBackButton';
import { SectionLabel } from '../src/components/ui/SectionLabel';
import { useHandHistoryStore } from '../src/store/useHandHistoryStore';
import { useHandReplayerDraft } from '../src/store/useHandReplayerDraft';
import { sortHandsNewestFirst } from '../src/lib/handSync';
import { formatDateShort } from '../src/lib/format';
import { useTheme } from '../src/design-system/ThemeProvider';
import { fontFamily, fontSize, spacing } from '../src/design-system/theme';
import type { HandHistory } from '../src/types';

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.hairline }]} />;
}

export default function ReplayerScreen() {
  const { t } = useTranslation('replayer');
  const { colors } = useTheme();
  const router = useRouter();
  const hands = useHandHistoryStore((s) => s.hands);
  const removeHand = useHandHistoryStore((s) => s.remove);
  const syncNow = useHandHistoryStore((s) => s.syncNow);
  const setDraft = useHandReplayerDraft((s) => s.setHand);

  // Opportunistic sync each time the tab gains focus: pushes anything recorded offline and
  // pulls hands saved from another device/reinstall. Silent — failures retry on next focus.
  useFocusEffect(
    useCallback(() => {
      void syncNow();
    }, [syncNow])
  );


  const sortedHands = sortHandsNewestFirst(Object.values(hands));

  // Saved hands open in the read-only detail screen (recap + replay/export actions) —
  // the builder is only reachable through "New hand".
  const openHand = (hand: HandHistory) => {
    setDraft(hand);
    router.push('/hand-replayer/view');
  };

  const confirmDelete = (hand: HandHistory) => {
    Alert.alert(t('list.deleteConfirm.title'), t('list.deleteConfirm.message'), [
      { text: t('common:cancel'), style: 'cancel' },
      { text: t('list.deleteConfirm.confirm'), style: 'destructive', onPress: () => removeHand(hand.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stack}>
          <Animated.View entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)} style={styles.header}>
            <ScreenBackButton />
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('list.title')}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}>
            <TouchableOpacity activeOpacity={0.75} onPress={() => router.push('/hand-replayer')}>
              <GlassCard padding={16}>
                <View style={styles.newHandRow}>
                  <View style={[styles.newHandIcon, { backgroundColor: colors.accentTint }]}>
                    <Plus size={20} color={colors.accent} strokeWidth={2} />
                  </View>
                  <View style={styles.newHandInfo}>
                    <Text style={[styles.newHandTitle, { color: colors.textPrimary }]}>{t('list.newHand')}</Text>
                    <Text style={[styles.newHandSub, { color: colors.textTertiary }]}>{t('list.newHandSubtitle')}</Text>
                  </View>
                  <ChevronRight size={18} color={colors.textTertiary} strokeWidth={1.8} />
                </View>
              </GlassCard>
            </TouchableOpacity>
          </Animated.View>

          {sortedHands.length === 0 ? (
            <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)}>
              <GlassCard variant="dark" padding={24}>
                <View style={styles.emptyCard}>
                  <History size={28} color={colors.onDarkTertiary} strokeWidth={1.5} />
                  <Text style={[styles.emptyTitle, { color: colors.onDarkPrimary }]}>{t('list.empty.title')}</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.onDarkTertiary }]}>{t('list.empty.subtitle')}</Text>
                </View>
              </GlassCard>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)}>
              <SectionLabel style={styles.sectionLabel}>{t('list.savedTitle')}</SectionLabel>
              <GlassCard padding={4}>
                {sortedHands.map((hand, i) => (
                  <View key={hand.id}>
                    {i > 0 ? <Divider /> : null}
                    <TouchableOpacity activeOpacity={0.75} onPress={() => openHand(hand)} style={styles.row}>
                      <View style={styles.rowInfo}>
                        <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                          {hand.title || t('untitledHand')}
                        </Text>
                        <Text style={[styles.rowSub, { color: colors.textTertiary }]} numberOfLines={1}>
                          {hand.stakes
                            ? t('list.rowMetaWithStakes', {
                                date: formatDateShort(hand.createdAt.slice(0, 10)),
                                stakes: hand.stakes,
                              })
                            : formatDateShort(hand.createdAt.slice(0, 10))}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => confirmDelete(hand)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.deleteBtn}
                      >
                        <Trash2 size={16} color={colors.textTertiary} strokeWidth={1.8} />
                      </TouchableOpacity>
                      <ChevronRight size={18} color={colors.textTertiary} strokeWidth={1.8} />
                    </TouchableOpacity>
                  </View>
                ))}
              </GlassCard>
            </Animated.View>
          )}

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
  },
  stack: {
    gap: spacing.md,
  },
  header: {
    paddingVertical: spacing.sm,
  },
  title: {
    fontSize: fontSize.display,
    fontFamily: fontFamily.display,
    letterSpacing: -1,
  },

  newHandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  newHandIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newHandInfo: {
    flex: 1,
    gap: 2,
  },
  newHandTitle: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  newHandSub: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },

  sectionLabel: {
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.base,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  rowSub: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  deleteBtn: {
    padding: spacing.xs,
  },

  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
  },

  divider: {
    height: 1,
    marginLeft: spacing.md,
  },
});
