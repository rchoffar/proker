import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, X } from 'lucide-react-native';
import { GlassCard } from '../../../src/components/ui/GlassCard';
import { SearchCreateList } from '../../../src/components/ui/PickerField';
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl';
import { useAppStore } from '../../../src/store/useAppStore';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { useBluffDraft } from '../../../src/store/useBluffDraft';
import { MAX_BLUFF_PLAYERS, MIN_BLUFF_PLAYERS } from '../../../src/lib/bluff';
import { fontFamily, fontSize, radius, spacing } from '../../../src/design-system/theme';
import { useTheme } from '../../../src/design-system/ThemeProvider';
import type { Player } from '../../../src/types';

type SetupMode = 'passPlay' | 'online';

export default function BluffSetupScreen() {
  const { t } = useTranslation('bluff');
  const { colors } = useTheme();
  const router = useRouter();
  const { players, addPlayer, bluffLastPlayers, bluffPseudo, setBluffDefaults } = useAppStore();
  const accountPseudo = useAuthStore((s) => s.user?.pseudo);
  const setDraft = useBluffDraft((s) => s.setDraft);

  const modeOptions = useMemo<{ key: SetupMode; label: string }[]>(
    () => [
      { key: 'passPlay', label: t('setup.modePassPlay') },
      { key: 'online', label: t('setup.modeOnline') },
    ],
    [t],
  );

  const [mode, setMode] = useState<SetupMode>('passPlay');
  const [selected, setSelected] = useState<Player[]>(bluffLastPlayers);
  const [query, setQuery] = useState('');
  const [pseudo, setPseudo] = useState(bluffPseudo || accountPseudo || '');
  const [joinCode, setJoinCode] = useState('');

  const canDeal = selected.length >= MIN_BLUFF_PLAYERS && selected.length <= MAX_BLUFF_PLAYERS;
  const atMax = selected.length >= MAX_BLUFF_PLAYERS;
  const pseudoOk = pseudo.trim().length > 0;
  const canJoin = pseudoOk && joinCode.length === 4;

  const addToSelection = (player: Player) => {
    if (atMax) return;
    setSelected((prev) => (prev.some((p) => p.id === player.id) ? prev : [...prev, player]));
    setQuery('');
  };

  const removeFromSelection = (id: string) => {
    setSelected((prev) => prev.filter((p) => p.id !== id));
  };

  const availableNames = players
    .filter((p) => !selected.some((s) => s.id === p.id))
    .map((p) => p.name);

  const handleStartPassPlay = () => {
    const newPlayers = selected.filter((p) => !players.some((existing) => existing.id === p.id));
    for (const p of newPlayers) addPlayer(p);
    setBluffDefaults({ players: selected });
    setDraft({ mode: 'passPlay', players: selected });
    router.push('/games/bluff/play');
  };

  const handleHost = () => {
    setBluffDefaults({ pseudo: pseudo.trim() });
    setDraft({ mode: 'host', pseudo: pseudo.trim() });
    router.push('/games/bluff/online');
  };

  const handleJoin = () => {
    setBluffDefaults({ pseudo: pseudo.trim() });
    setDraft({ mode: 'guest', pseudo: pseudo.trim(), joinCode });
    router.push('/games/bluff/online');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.neutralTileBg }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={18} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.stack}>
          <Animated.View entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)}>
            <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{t('setup.subtitle')}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(40).springify().damping(18).stiffness(140)}>
            <SegmentedControl options={modeOptions} value={mode} onChange={setMode} />
          </Animated.View>

          {mode === 'passPlay' ? (
            <>
              <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}>
                <GlassCard padding={16}>
                  <View style={styles.chipGrid}>
                    {selected.length === 0 ? (
                      <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('setup.noPlayersYet')}</Text>
                    ) : (
                      selected.map((p) => (
                        <View key={p.id} style={[styles.playerChip, { borderColor: colors.accent, backgroundColor: colors.accentTint }]}>
                          <Text style={[styles.playerChipText, { color: colors.accent }]}>{p.name}</Text>
                          <TouchableOpacity onPress={() => removeFromSelection(p.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                            <X size={13} color={colors.accent} strokeWidth={2.5} />
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </View>
                </GlassCard>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)}>
                {atMax ? (
                  <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('setup.maxPlayersReached')}</Text>
                ) : (
                  <SearchCreateList
                    items={availableNames}
                    selected=""
                    query={query}
                    onQueryChange={setQuery}
                    onSelect={(name) => {
                      const existing = players.find((p) => p.name === name);
                      if (existing) addToSelection(existing);
                    }}
                    onCreate={(name) => addToSelection({ id: `p-${Date.now()}`, name })}
                    placeholder={t('setup.searchOrCreatePlayer')}
                  />
                )}
              </Animated.View>
            </>
          ) : (
            <>
              <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}>
                <GlassCard padding={16}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('setup.yourPseudo')}</Text>
                  <TextInput
                    value={pseudo}
                    onChangeText={setPseudo}
                    placeholder={t('setup.pseudoPlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    maxLength={20}
                    style={[styles.input, { color: colors.textPrimary, borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg }]}
                  />
                </GlassCard>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)}>
                <GlassCard padding={16}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('setup.joinTable')}</Text>
                  <View style={styles.joinRow}>
                    <TextInput
                      value={joinCode}
                      onChangeText={(v) => setJoinCode(v.replace(/[^0-9]/g, '').slice(0, 4))}
                      placeholder="0000"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="number-pad"
                      maxLength={4}
                      style={[
                        styles.input,
                        styles.codeInput,
                        { color: colors.textPrimary, borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg },
                      ]}
                    />
                    <TouchableOpacity
                      style={[styles.joinBtn, { backgroundColor: colors.accentTint, borderColor: colors.accent }, !canJoin && styles.disabledBtn]}
                      onPress={handleJoin}
                      disabled={!canJoin}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.joinBtnText, { color: colors.accent }]}>{t('setup.join')}</Text>
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              </Animated.View>
            </>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {mode === 'passPlay' ? (
          <TouchableOpacity
            style={[styles.primaryBtn, !canDeal && styles.disabledBtn, { backgroundColor: colors.accentBright }]}
            onPress={handleStartPassPlay}
            disabled={!canDeal}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>{t('setup.dealCards')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryBtn, !pseudoOk && styles.disabledBtn, { backgroundColor: colors.accentBright }]}
            onPress={handleHost}
            disabled={!pseudoOk}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>{t('setup.createTable')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  stack: {
    gap: spacing.md,
  },
  subtitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    lineHeight: 18,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  playerChipText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    fontFamily: fontFamily.medium,
    // Explicit defaults: Fabric recycles native TextInputs, and a recycled instance keeps
    // the code input's letterSpacing/textAlign unless overridden here.
    letterSpacing: 0,
    textAlign: 'left',
  },
  joinRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  codeInput: {
    flex: 1,
    textAlign: 'center',
    letterSpacing: 8,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
  },
  joinBtn: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  joinBtnText: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
  },
  footer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  primaryBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.4,
  },
  primaryBtnText: {
    color: '#0A0A0F',
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
});
