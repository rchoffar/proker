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
import { useOfcDraft } from '../../../src/store/useOfcDraft';
import { MAX_OFC_PLAYERS, MIN_OFC_PLAYERS, OFC_VARIANTS } from '../../../src/lib/ofc';
import type { OfcVariant } from '../../../src/lib/ofc';
import { fontFamily, fontSize, radius, spacing } from '../../../src/design-system/theme';
import { useTheme } from '../../../src/design-system/ThemeProvider';
import type { Player } from '../../../src/types';

type SetupMode = 'passPlay' | 'online';

const STACK_PRESETS = [50, 100, 200, 500];
// Proper noun — on the do-not-translate glossary, like the wordmark.
const GAME_NAME = 'OFC';

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

  const feltRows: FeltOptionRow[] = [
    {
      key: 'variant',
      label: t('setup.variantLabel'),
      info: t(variant === 'classic' ? 'setup.variantClassicHint' : 'setup.variantPineappleHint'),
      value: variant,
      onChange: (k) => setVariant(k as OfcVariant),
      options: OFC_VARIANTS.map((value) => ({
        key: value,
        // Variant names are proper nouns.
        label: t(value === 'classic' ? 'setup.variantClassic' : 'setup.variantPineapple'),
      })),
    },
    {
      key: 'stack',
      // Four presets across a felt this narrow: the row label carries the unit so the chips
      // can be bare numbers.
      label: t('setup.startingStackChips'),
      value: String(startingStack),
      onChange: (k) => setStartingStack(Number(k)),
      options: STACK_PRESETS.map((value) => ({ key: String(value), label: String(value) })),
    },
  ];

  const feltOptions = (feltWidth: number) => (
    <FeltOptions gameName={GAME_NAME} rows={feltRows} width={feltWidth} />
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
        <SetupBlock index={2}>
          <SeatTableBoard
            players={players}
            selected={selected}
            onChange={setSelected}
            maxPlayers={MAX_OFC_PLAYERS}
            center={feltOptions}
          />
        </SetupBlock>
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
          {/* Hosting: the felt shows the rules the guests will inherit, no roster yet. */}
          <SetupBlock index={3}>
            <SeatTableBoard
              players={players}
              selected={[]}
              onChange={() => {}}
              maxPlayers={MAX_OFC_PLAYERS}
              center={feltOptions}
              seatsInteractive={false}
              emptySeatLabel={t('online.waitingSeat')}
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
