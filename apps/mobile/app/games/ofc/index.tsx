import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { GameSetupScreen, SetupBlock } from '../../../src/components/games/GameSetupScreen';
import { SeatTableBoard } from '../../../src/components/games/SeatTableBoard';
import { GlassCard } from '../../../src/components/ui/GlassCard';
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
  const [startingStack, setStartingStack] = useState(ofcStartingStack);
  const [variant, setVariant] = useState<OfcVariant>(ofcVariant);
  const [joinCode, setJoinCode] = useState('');

  const canDeal = selected.length >= MIN_OFC_PLAYERS && selected.length <= MAX_OFC_PLAYERS;
  const canJoin = joinCode.length === 4;

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
    <GameSetupScreen
      title={t('title')}
      subtitle={t('setup.subtitle')}
      ctaLabel={mode === 'passPlay' ? t('setup.dealCards') : t('setup.createTable')}
      ctaDisabled={mode === 'passPlay' && !canDeal}
      onCtaPress={mode === 'passPlay' ? handleStartPassPlay : handleHost}
    >
      <SetupBlock index={1}>
        <SegmentedControl options={modeOptions} value={mode} onChange={setMode} />
      </SetupBlock>

      {mode === 'passPlay' ? (
        <>
          <SetupBlock index={2}>
            <SeatTableBoard players={players} selected={selected} onChange={setSelected} maxPlayers={MAX_OFC_PLAYERS} />
          </SetupBlock>
          <SetupBlock index={3}>{variantPicker}</SetupBlock>
          <SetupBlock index={4}>{stackPicker}</SetupBlock>
        </>
      ) : (
        <>
          <SetupBlock index={2}>
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
          </SetupBlock>
          <SetupBlock index={3}>{variantPicker}</SetupBlock>
          <SetupBlock index={4}>{stackPicker}</SetupBlock>
        </>
      )}
    </GameSetupScreen>
  );
}

const styles = StyleSheet.create({
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
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  stackChipText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
  },
  variantHint: {
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    lineHeight: 16,
  },
  joinRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  codeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
    letterSpacing: 6,
    textAlign: 'center',
  },
  joinBtn: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  joinBtnText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  disabledBtn: {
    opacity: 0.4,
  },
});
