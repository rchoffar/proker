import { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, Text, TouchableOpacity } from 'react-native';
import { useOfcLocalGames } from '../../../src/store/useOfcLocalGames';
import { GlassCard } from '../../../src/components/ui/GlassCard';
import { useTheme } from '../../../src/design-system/ThemeProvider';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { GameSetupScreen, SetupBlock } from '../../../src/components/games/GameSetupScreen';
import { SeatTableBoard } from '../../../src/components/games/SeatTableBoard';
import { FeltOptions, type FeltOptionRow } from '../../../src/components/games/FeltOptions';
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl';
import { useAppStore } from '../../../src/store/useAppStore';
import { OnlineLobby } from '../../../src/components/ofc/OnlineLobby';
import { useOfcDraft } from '../../../src/store/useOfcDraft';
import { MAX_OFC_PLAYERS, MIN_OFC_PLAYERS, OFC_VARIANTS } from '../../../src/lib/ofc';
import type { OfcVariant } from '../../../src/lib/ofc';
import type { Player } from '../../../src/types';

type SetupMode = 'passPlay' | 'online';

const STACK_PRESETS = [50, 100, 200, 500];
// Proper noun — on the do-not-translate glossary, like the wordmark.
const GAME_NAME = 'OFC';

export default function OfcSetupScreen() {
  const { t } = useTranslation('ofc');
  const router = useRouter();
  const refreshRef = useRef<(() => void) | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const registerRefresh = useCallback((refresh: () => void) => { refreshRef.current = refresh; }, []);
  const { colors } = useTheme();
  const localGames = useOfcLocalGames(s => s.games);
  const { players, addPlayer, ofcLastPlayers, ofcStartingStack, ofcVariant, setOfcDefaults } = useAppStore();
  const setDraft = useOfcDraft((s) => s.setDraft);

  const modeOptions = useMemo<{ key: SetupMode; label: string }[]>(
    () => [
      { key: 'online', label: t('games:setup.modeOnline') },
      { key: 'passPlay', label: t('games:setup.modePassPlay') },
    ],
    [t],
  );

  const [mode, setMode] = useState<SetupMode>('online');
  const [selected, setSelected] = useState<Player[]>(ofcLastPlayers);
  const [startingStack, setStartingStack] = useState(ofcStartingStack);
  const [variant, setVariant] = useState<OfcVariant>(ofcVariant);

  const canDeal = selected.length >= MIN_OFC_PLAYERS && selected.length <= MAX_OFC_PLAYERS;

  const handleStartPassPlay = () => {
    useOfcLocalGames.getState().select(null);
    const newPlayers = selected.filter((p) => !players.some((existing) => existing.id === p.id));
    for (const p of newPlayers) addPlayer(p);
    setOfcDefaults({ players: selected, startingStack, variant });
    setDraft({ mode: 'passPlay', players: selected, startingStack, variant });
    router.push('/games/ofc/play');
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
      refreshControl={mode === 'online' ? <RefreshControl refreshing={refreshing} onRefresh={() => refreshRef.current?.()} /> : undefined}
      title={t('title')}
      subtitle={t('setup.subtitle')}
      ctaLabel={mode === 'passPlay' ? t('games:setup.dealCards') : t('games:setup.createTable')}
      ctaDisabled={mode === 'passPlay' ? !canDeal : false}
      onCtaPress={mode === 'passPlay' ? handleStartPassPlay : () => router.push('/games/ofc/create')}
      topBar={
        <SetupBlock index={0}>
          <SegmentedControl options={modeOptions} value={mode} onChange={setMode} />
        </SetupBlock>
      }
    >
      {mode === 'passPlay' ? (
        <>
          {Object.entries(localGames).filter(([, game]) => game.state.phase !== 'gameOver').map(([id, game]) => (
            <TouchableOpacity key={id} onPress={() => { useOfcLocalGames.getState().select(id); router.push('/games/ofc/play'); }}>
              <GlassCard padding={12}>
                <Text style={{ color: colors.accent }}>{t('local.resume', { hand: game.state.handNumber })}</Text>
                <Text style={{ color: colors.textSecondary }}>{game.state.players.map(p => p.name).join(' · ')}</Text>
              </GlassCard>
            </TouchableOpacity>
          ))}
        <SetupBlock index={1} fill>
          <SeatTableBoard
            players={players}
            selected={selected}
            onChange={setSelected}
            maxPlayers={MAX_OFC_PLAYERS}
            center={feltOptions}
            fill
          />
        </SetupBlock>
        </>
      ) : (
        <OnlineLobby onRefreshReady={registerRefresh} onRefreshingChange={setRefreshing} />
      )}
    </GameSetupScreen>
  );
}
