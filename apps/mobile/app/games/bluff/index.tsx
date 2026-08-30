import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { GameSetupScreen, SetupBlock } from '../../../src/components/games/GameSetupScreen';
import { SeatTableBoard } from '../../../src/components/games/SeatTableBoard';
import { FeltOptions, type FeltOptionRow } from '../../../src/components/games/FeltOptions';
import { GlassCard } from '../../../src/components/ui/GlassCard';
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl';
import { useAppStore } from '../../../src/store/useAppStore';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { useBluffDraft } from '../../../src/store/useBluffDraft';
import { MAX_BLUFF_PLAYERS, MIN_BLUFF_PLAYERS } from '../../../src/lib/bluff';
import type { BluffVariant } from '../../../src/lib/bluff';
import { fontFamily, fontSize, radius, spacing } from '../../../src/design-system/theme';
import { useTheme } from '../../../src/design-system/ThemeProvider';
import type { Player } from '../../../src/types';

type SetupMode = 'passPlay' | 'online';

// Proper noun — on the do-not-translate glossary, like the wordmark.
const GAME_NAME = 'Bluff';

export default function BluffSetupScreen() {
  const { t } = useTranslation('bluff');
  const { colors } = useTheme();
  const router = useRouter();
  const { players, addPlayer, bluffLastPlayers, bluffJeuMax, bluffVariant, setBluffDefaults } = useAppStore();
  const pseudo = useAuthStore((s) => s.user?.pseudo) ?? '';
  const setDraft = useBluffDraft((s) => s.setDraft);

  const modeOptions = useMemo<{ key: SetupMode; label: string }[]>(
    () => [
      { key: 'passPlay', label: t('games:setup.modePassPlay') },
      { key: 'online', label: t('games:setup.modeOnline') },
    ],
    [t],
  );

  const [mode, setMode] = useState<SetupMode>('passPlay');
  const [selected, setSelected] = useState<Player[]>(bluffLastPlayers);
  const [joinCode, setJoinCode] = useState('');
  const [jeuMax, setJeuMax] = useState(bluffJeuMax);
  const [variant, setVariant] = useState<BluffVariant>(bluffVariant);

  const canDeal = selected.length >= MIN_BLUFF_PLAYERS && selected.length <= MAX_BLUFF_PLAYERS;
  const canJoin = joinCode.length === 4;

  const handleStartPassPlay = () => {
    const newPlayers = selected.filter((p) => !players.some((existing) => existing.id === p.id));
    for (const p of newPlayers) addPlayer(p);
    setBluffDefaults({ players: selected, jeuMax, variant });
    setDraft({ mode: 'passPlay', players: selected, jeuMax, variant });
    router.push('/games/bluff/play');
  };

  const handleHost = () => {
    setBluffDefaults({ jeuMax, variant });
    setDraft({ mode: 'host', pseudo, jeuMax, variant });
    router.push('/games/bluff/online');
  };

  const handleJoin = () => {
    setDraft({ mode: 'guest', pseudo, joinCode });
    router.push('/games/bluff/online');
  };

  // Same rules in both modes — for online they only apply when hosting (guests inherit the
  // host's rules through the first state broadcast).
  const ruleRows: FeltOptionRow[] = [
    {
      key: 'jeuMax',
      label: t('setup.jeuMaxLabel'),
      info: t('setup.jeuMaxHint'),
      value: jeuMax ? 'on' : 'off',
      onChange: (k) => setJeuMax(k === 'on'),
      options: [
        { key: 'off', label: t('setup.jeuMaxClassic') },
        { key: 'on', label: t('setup.jeuMaxOption') },
      ],
    },
    {
      key: 'variant',
      label: t('setup.variantLabel'),
      info: t('setup.variantQuickHint'),
      value: variant,
      onChange: (k) => setVariant(k as BluffVariant),
      options: [
        { key: 'standard', label: t('setup.variantStandardShort') },
        { key: 'quick', label: t('setup.variantQuickShort') },
      ],
    },
  ];

  const feltOptions = (feltWidth: number) => (
    <FeltOptions gameName={GAME_NAME} rows={ruleRows} width={feltWidth} />
  );

  return (
    <GameSetupScreen
      title={t('title')}
      subtitle={t('setup.subtitle')}
      ctaLabel={mode === 'passPlay' ? t('games:setup.dealCards') : t('games:setup.createTable')}
      ctaDisabled={mode === 'passPlay' && !canDeal}
      onCtaPress={mode === 'passPlay' ? handleStartPassPlay : handleHost}
    >
      <SetupBlock index={1}>
        <SegmentedControl options={modeOptions} value={mode} onChange={setMode} />
      </SetupBlock>

      {mode === 'passPlay' ? (
        <SetupBlock index={2}>
          <SeatTableBoard
            players={players}
            selected={selected}
            onChange={setSelected}
            maxPlayers={MAX_BLUFF_PLAYERS}
            center={feltOptions}
          />
        </SetupBlock>
      ) : (
        <>
          <SetupBlock index={2}>
            <GlassCard padding={16}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('games:setup.joinTable')}</Text>
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
                  <Text style={[styles.joinBtnText, { color: colors.accent }]}>{t('games:setup.join')}</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </SetupBlock>
          {/* Hosting: the felt shows the rules the guests will inherit, no roster yet. */}
          <SetupBlock index={3}>
            <SeatTableBoard
              players={players}
              selected={[]}
              onChange={() => {}}
              maxPlayers={MAX_BLUFF_PLAYERS}
              center={feltOptions}
              seatsInteractive={false}
              emptySeatLabel={t('games:online.waitingSeat')}
            />
          </SetupBlock>
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
