import { useRef, useState } from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { GameSetupScreen, SetupBlock } from '../../../src/components/games/GameSetupScreen';
import { SeatTableBoard } from '../../../src/components/games/SeatTableBoard';
import { FeltOptions, type FeltOptionRow } from '../../../src/components/games/FeltOptions';
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl';
import { useAppStore } from '../../../src/store/useAppStore';
import { createBluffGame, BluffApiError } from '../../../src/lib/api/bluff';
import { bluffErrorMessage } from '../../../src/lib/bluff/onlineErrors';
import { type BluffVariant } from '../../../src/lib/bluff';
import { useTheme } from '../../../src/design-system/ThemeProvider';

export default function BluffCreateScreen() {
  const { t } = useTranslation('bluff');
  const { colors } = useTheme();
  const router = useRouter();
  const { bluffJeuMax, bluffVariant, setBluffDefaults } = useAppStore();
  const [jeuMax, setJeuMax] = useState(bluffJeuMax);
  const [variant, setVariant] = useState<BluffVariant>(bluffVariant);
  const [capacity, setCapacity] = useState(2);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const pendingRef = useRef<{ key: string; requestId: string } | null>(null);
  const create = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const key = JSON.stringify([variant, jeuMax, capacity, visibility]);
    const requestId = pendingRef.current?.key === key ? pendingRef.current.requestId : Crypto.randomUUID();
    pendingRef.current = { key, requestId };
    try {
      const { game } = await createBluffGame({ config: { variant, jeuMax }, capacity, visibility, requestId });
      pendingRef.current = null;
      setBluffDefaults({ jeuMax, variant });
      router.replace({ pathname: '/games/bluff/online', params: { id: game.id } });
    } catch (e) {
      if (e instanceof BluffApiError && e.status < 500) pendingRef.current = null;
      setError(bluffErrorMessage(e, t));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const rows: FeltOptionRow[] = [
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

  return (
    <GameSetupScreen title={t('games:setup.createTable')} subtitle={t('setup.subtitle')}
      ctaLabel={t('games:setup.createTable')} ctaDisabled={busy} onCtaPress={() => void create()}>
      <SetupBlock index={0}>
        <SegmentedControl options={[2, 3, 4, 5, 6].map(count => ({ key: String(count), label: t('online.seats', { count }) }))}
          value={String(capacity)} onChange={v => setCapacity(Number(v))} />
      </SetupBlock>
      <SetupBlock index={1}>
        <SegmentedControl options={[{ key: 'public', label: t('online.public') }, { key: 'private', label: t('online.private') }]}
          value={visibility} onChange={setVisibility} />
      </SetupBlock>
      <SetupBlock index={2} fill>
        <SeatTableBoard players={[]} selected={[]} onChange={() => {}} maxPlayers={capacity} seatsInteractive={false} fill
          emptySeatLabel={t('games:online.waitingSeat')} center={width => <FeltOptions gameName="Bluff" rows={rows} width={width} />} />
      </SetupBlock>
      <Text style={{ color: colors.textSecondary }}>{t('online.autoStartHint', { count: capacity })}</Text>
      {error && <Text style={{ color: colors.accent }}>{error}</Text>}
    </GameSetupScreen>
  );
}
