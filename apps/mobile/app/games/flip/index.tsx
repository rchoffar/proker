import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { GameSetupScreen, SetupBlock } from '../../../src/components/games/GameSetupScreen';
import { SeatTableBoard } from '../../../src/components/games/SeatTableBoard';
import { FeltOptions, type FeltOptionRow } from '../../../src/components/games/FeltOptions';
import { useAppStore } from '../../../src/store/useAppStore';
import { useFlipDraft } from '../../../src/store/useFlipDraft';
import type { FlipGameType } from '../../../src/lib/pokerHandEvaluator';
import type { Player } from '../../../src/types';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
// Proper noun — on the do-not-translate glossary, like the wordmark.
const GAME_NAME = 'Flip';

export default function FlipSetupScreen() {
  const { t } = useTranslation('games');
  const router = useRouter();
  const { players, addPlayer, flipLastPlayers, flipLastGameType, setFlipDraftDefaults } = useAppStore();
  const setDraft = useFlipDraft((s) => s.setDraft);

  const [selected, setSelected] = useState<Player[]>(flipLastPlayers);
  const [gameType, setGameType] = useState<FlipGameType>(flipLastGameType);

  // Game-type names are proper nouns — identical in both languages.
  const feltRows = useMemo<FeltOptionRow[]>(
    () => [
      {
        key: 'gameType',
        label: t('flip.gameTypeLabel'),
        value: gameType,
        onChange: (k) => setGameType(k as FlipGameType),
        options: [
          { key: 'holdem', label: "Hold'em" },
          { key: 'omaha', label: 'Omaha' },
        ],
      },
    ],
    [t, gameType],
  );

  const canDeal = selected.length >= MIN_PLAYERS && selected.length <= MAX_PLAYERS;

  const handleStart = () => {
    const newPlayers = selected.filter((p) => !players.some((existing) => existing.id === p.id));
    for (const p of newPlayers) addPlayer(p);
    setFlipDraftDefaults(selected, gameType);
    setDraft(selected, gameType);
    router.push('/games/flip/play');
  };

  return (
    <GameSetupScreen
      title={GAME_NAME}
      subtitle={t('flip.subtitle')}
      ctaLabel={t('flip.dealCards')}
      ctaDisabled={!canDeal}
      onCtaPress={handleStart}
    >
      <SetupBlock index={1}>
        <SeatTableBoard
          players={players}
          selected={selected}
          onChange={setSelected}
          maxPlayers={MAX_PLAYERS}
          center={(feltWidth) => <FeltOptions gameName={GAME_NAME} rows={feltRows} width={feltWidth} />}
        />
      </SetupBlock>
    </GameSetupScreen>
  );
}
