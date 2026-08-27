import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { GameSetupScreen, SetupBlock } from '../../../src/components/games/GameSetupScreen';
import { RosterSection } from '../../../src/components/games/RosterSection';
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl';
import { useAppStore } from '../../../src/store/useAppStore';
import { useFlipDraft } from '../../../src/store/useFlipDraft';
import type { FlipGameType } from '../../../src/lib/pokerHandEvaluator';
import type { Player } from '../../../src/types';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

export default function FlipSetupScreen() {
  const { t } = useTranslation('games');
  const router = useRouter();
  const { players, addPlayer, flipLastPlayers, flipLastGameType, setFlipDraftDefaults } = useAppStore();
  const setDraft = useFlipDraft((s) => s.setDraft);

  const [selected, setSelected] = useState<Player[]>(flipLastPlayers);
  const [gameType, setGameType] = useState<FlipGameType>(flipLastGameType);

  // Game-type names are proper nouns — identical in both languages.
  const gameTypeOptions = useMemo<{ key: FlipGameType; label: string }[]>(
    () => [
      { key: 'holdem', label: "Hold'em" },
      { key: 'omaha', label: 'Omaha' },
    ],
    [],
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
      title="Flip"
      subtitle={t('flip.subtitle')}
      ctaLabel={t('flip.dealCards')}
      ctaDisabled={!canDeal}
      onCtaPress={handleStart}
    >
      <SetupBlock index={1}>
        <SegmentedControl options={gameTypeOptions} value={gameType} onChange={setGameType} />
      </SetupBlock>
      <SetupBlock index={2}>
        <RosterSection players={players} selected={selected} onChange={setSelected} maxPlayers={MAX_PLAYERS} />
      </SetupBlock>
    </GameSetupScreen>
  );
}
