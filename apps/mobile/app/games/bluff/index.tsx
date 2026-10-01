import { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { GameSetupScreen, SetupBlock } from '../../../src/components/games/GameSetupScreen';
import { SeatTableBoard } from '../../../src/components/games/SeatTableBoard';
import { FeltOptions, type FeltOptionRow } from '../../../src/components/games/FeltOptions';
import { BluffOnlineLobby } from '../../../src/components/bluff/OnlineLobby';
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl';
import { useAppStore } from '../../../src/store/useAppStore';
import { useTheme } from '../../../src/design-system/ThemeProvider';
import { GlassCard } from '../../../src/components/ui/GlassCard';
import { useBluffLocalGames } from '../../../src/store/useBluffLocalGames';
import { useBluffDraft } from '../../../src/store/useBluffDraft';
import { MAX_BLUFF_PLAYERS, MIN_BLUFF_PLAYERS } from '../../../src/lib/bluff';
import type { BluffVariant } from '../../../src/lib/bluff';
import type { Player } from '../../../src/types';

type SetupMode = 'passPlay' | 'online';

// Proper noun — on the do-not-translate glossary, like the wordmark.
const GAME_NAME = 'Bluff';

export default function BluffSetupScreen() {
  const { t } = useTranslation('bluff');
  const router = useRouter();
  const { colors } = useTheme();
  const localGames = useBluffLocalGames(s => s.games);
  const refreshRef = useRef<(() => void) | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const registerRefresh = useCallback((refresh: () => void) => { refreshRef.current = refresh; }, []);
  const { players, addPlayer, bluffLastPlayers, bluffJeuMax, bluffVariant, setBluffDefaults } = useAppStore();
  const setDraft = useBluffDraft((s) => s.setDraft);

  const modeOptions = useMemo<{ key: SetupMode; label: string }[]>(
    () => [
      { key: 'online', label: t('games:setup.modeOnline') },
      { key: 'passPlay', label: t('games:setup.modePassPlay') },
    ],
    [t],
  );

  const [mode, setMode] = useState<SetupMode>('online');
  const [selected, setSelected] = useState<Player[]>(bluffLastPlayers);
  const [jeuMax, setJeuMax] = useState(bluffJeuMax);
  const [variant, setVariant] = useState<BluffVariant>(bluffVariant);

  const canDeal = selected.length >= MIN_BLUFF_PLAYERS && selected.length <= MAX_BLUFF_PLAYERS;

  const handleStartPassPlay = () => {
    useBluffLocalGames.getState().select(null);
    const newPlayers = selected.filter((p) => !players.some((existing) => existing.id === p.id));
    for (const p of newPlayers) addPlayer(p);
    setBluffDefaults({ players: selected, jeuMax, variant });
    setDraft({ mode: 'passPlay', players: selected, jeuMax, variant });
    router.push('/games/bluff/play');
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
      info: t(variant === 'quick' ? 'setup.variantQuickHint' : 'setup.variantStandardHint'),
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
      refreshControl={mode === 'online' ? <RefreshControl refreshing={refreshing} onRefresh={() => refreshRef.current?.()} /> : undefined}
      title={t('title')}
      subtitle={t('setup.subtitle')}
      ctaLabel={mode === 'passPlay' ? t('games:setup.dealCards') : t('games:setup.createTable')}
      ctaDisabled={mode === 'passPlay' && !canDeal}
      onCtaPress={mode === 'passPlay' ? handleStartPassPlay : () => router.push('/games/bluff/create')}
      topBar={
        <SetupBlock index={0}>
          <SegmentedControl options={modeOptions} value={mode} onChange={setMode} />
        </SetupBlock>
      }
    >
      {mode === 'passPlay' ? (
        <>
          {Object.entries(localGames).filter(([, game]) => game.state.phase !== 'gameOver').map(([id, game]) => (
            <TouchableOpacity key={id} onPress={() => { useBluffLocalGames.getState().select(id); router.push('/games/bluff/play'); }}>
              <GlassCard padding={12}>
                <Text style={{ color: colors.accent }}>{t('local.resume', { round: game.state.round })}</Text>
                <Text style={{ color: colors.textSecondary }}>{game.state.players.map(p => p.name).join(' · ')}</Text>
              </GlassCard>
            </TouchableOpacity>
          ))}
        <SetupBlock index={1} fill>
          <SeatTableBoard
            players={players}
            selected={selected}
            onChange={setSelected}
            maxPlayers={MAX_BLUFF_PLAYERS}
            center={feltOptions}
            fill
          />
        </SetupBlock>
        </>
      ) : (
        <BluffOnlineLobby onRefreshReady={registerRefresh} onRefreshingChange={setRefreshing} />
      )}
    </GameSetupScreen>
  );
}
