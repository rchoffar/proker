import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { GameSetupScreen, SetupBlock } from '../../../src/components/games/GameSetupScreen';
import { RosterSection } from '../../../src/components/games/RosterSection';
import { useAppStore } from '../../../src/store/useAppStore';
import { useRouletteDraft } from '../../../src/store/useRouletteDraft';
import type { Player } from '../../../src/types';

export default function RouletteSetupScreen() {
  const { t } = useTranslation('games');
  const router = useRouter();
  const { players, addPlayer, rouletteLastPlayers, setRouletteLastPlayers } = useAppStore();
  const setDraftPlayers = useRouletteDraft((s) => s.setPlayers);

  const [selected, setSelected] = useState<Player[]>(rouletteLastPlayers);

  const canSpin = selected.length >= 2;

  const handleStart = () => {
    const newPlayers = selected.filter((p) => !players.some((existing) => existing.id === p.id));
    for (const p of newPlayers) addPlayer(p);
    setRouletteLastPlayers(selected);
    setDraftPlayers(selected);
    router.push('/games/roulette/play');
  };

  return (
    <GameSetupScreen
      title="Roulette"
      subtitle={t('roulette.subtitle')}
      ctaLabel={t('roulette.start')}
      ctaDisabled={!canSpin}
      onCtaPress={handleStart}
    >
      <SetupBlock index={1}>
        <RosterSection players={players} selected={selected} onChange={setSelected} />
      </SetupBlock>
    </GameSetupScreen>
  );
}
