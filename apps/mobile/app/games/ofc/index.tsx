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
import { useOfcDraft } from '../../../src/store/useOfcDraft';
import { MAX_OFC_PLAYERS, MIN_OFC_PLAYERS, OFC_VARIANTS } from '../../../src/lib/ofc';
import type { OfcVariant } from '../../../src/lib/ofc';
import { fontFamily, fontSize, radius, spacing } from '../../../src/design-system/theme';
import { useTheme } from '../../../src/design-system/ThemeProvider';
import type { Player } from '../../../src/types';

type SetupMode = 'passPlay' | 'online';

const STACK_PRESETS = [50, 100, 200, 500];

export default function OfcSetupScreen() {
  const { t } = useTranslation('ofc');
  const { colors } = useTheme();
  const router = useRouter();
  const { players, addPlayer, ofcLastPlayers, ofcStartingStack, ofcVariant, setOfcDefaults } = useAppStore();
  const pseudo = useAuthStore((s) => s.user?.pseudo) ?? '';
  const setDraft = useOfcDraft((s) => s.setDraft);

  const modeOptions = useMemo<{ key: SetupMode; label: string }[]>(
    () => [
      { key: 'passPlay', label: t('setup.modePassPlay') },
      { key: 'online', label: t('setup.modeOnline') },
    ],
    [t],
  );

  const [mode, setMode] = useState<SetupMode>('passPlay');
  const [selected, setSelected] = useState<Player[]>(ofcLastPlayers);
  const [query, setQuery] = useState('');
  const [startingStack, setStartingStack] = useState(ofcStartingStack);
  const [variant, setVariant] = useState<OfcVariant>(ofcVariant);
  const [joinCode, setJoinCode] = useState('');

  const canDeal = selected.length >= MIN_OFC_PLAYERS && selected.length <= MAX_OFC_PLAYERS;
  const atMax = selected.length >= MAX_OFC_PLAYERS;
  const canJoin = joinCode.length === 4;

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
    setOfcDefaults({ players: selected, startingStack, variant });
    setDraft({ mode: 'passPlay', players: selected, startingStack, variant });
    router.push('/games/ofc/play');
  };

  const handleHost = () => {
    setOfcDefaults({ startingStack, variant });
    setDraft({ mode: 'host', pseudo, startingStack, variant });
    router.push('/games/ofc/online');
  };

  const handleJoin = () => {
    setDraft({ mode: 'guest', pseudo, joinCode });
    router.push('/games/ofc/online');
  };

  const variantPicker = (
    <GlassCard padding={16}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('setup.variantLabel')}</Text>
      <View style={styles.stackRow}>
        {OFC_VARIANTS.map((value) => {
          const active = variant === value;
          return (
            <TouchableOpacity
              key={value}
              style={[
                styles.stackChip,
                active
                  ? { borderColor: colors.accent, backgroundColor: colors.accentTint }
                  : { borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg },
              ]}
              onPress={() => setVariant(value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.stackChipText, { color: active ? colors.accent : colors.textSecondary }]}>
                {t(value === 'classic' ? 'setup.variantClassic' : 'setup.variantPineapple')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.variantHint, { color: colors.textTertiary }]}>
        {t(variant === 'classic' ? 'setup.variantClassicHint' : 'setup.variantPineappleHint')}
      </Text>
    </GlassCard>
  );

  const stackPicker = (
    <GlassCard padding={16}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('setup.startingStack')}</Text>
      <View style={styles.stackRow}>
        {STACK_PRESETS.map((value) => {
          const active = startingStack === value;
          return (
            <TouchableOpacity
              key={value}
              style={[
                styles.stackChip,
                active
                  ? { borderColor: colors.accent, backgroundColor: colors.accentTint }
                  : { borderColor: colors.surface.fieldBorder, backgroundColor: colors.surface.fieldBg },
              ]}
              onPress={() => setStartingStack(value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.stackChipText, { color: active ? colors.accent : colors.textSecondary }]}>
                {t('setup.stackChip', { count: value })}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </GlassCard>
  );

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

              <Animated.View entering={FadeInDown.delay(160).springify().damping(18).stiffness(140)}>
                {variantPicker}
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(200).springify().damping(18).stiffness(140)}>
                {stackPicker}
              </Animated.View>
            </>
          ) : (
            <>
              <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}>
                {variantPicker}
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(100).springify().damping(18).stiffness(140)}>
                {stackPicker}
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
            style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]}
            onPress={handleHost}
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
  stackRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stackChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  stackChipText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
  },
  variantHint: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    marginTop: spacing.sm,
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
