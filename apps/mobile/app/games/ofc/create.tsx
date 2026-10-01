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
import { createOfcGame, OfcApiError, type OfcVisibility } from '../../../src/lib/api/ofc';
import { ofcErrorMessage } from '../../../src/lib/ofc/onlineErrors';
import { OFC_VARIANTS, type OfcVariant } from '../../../src/lib/ofc';
import { useTheme } from '../../../src/design-system/ThemeProvider';

export default function OfcCreateScreen() {
  const { t } = useTranslation('ofc');
  const { colors } = useTheme();
  const router = useRouter();
  const { ofcStartingStack, ofcVariant, setOfcDefaults } = useAppStore();
  const [startingStack, setStartingStack] = useState(ofcStartingStack);
  const [variant, setVariant] = useState<OfcVariant>(ofcVariant);
  const [capacity, setCapacity] = useState<2 | 3>(2);
  const [visibility, setVisibility] = useState<OfcVisibility>('public');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const pendingRef = useRef<{ key: string; requestId: string } | null>(null);
  const create = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const key = JSON.stringify([variant, startingStack, capacity, visibility]);
    const requestId = pendingRef.current?.key === key ? pendingRef.current.requestId : Crypto.randomUUID();
    pendingRef.current = { key, requestId };
    try {
      const { game } = await createOfcGame({ variant, startingStack, capacity, visibility, requestId });
      pendingRef.current = null;
      setOfcDefaults({ startingStack, variant });
      router.replace({ pathname: '/games/ofc/online', params: { id: game.id } });
    } catch (e) {
      if (e instanceof OfcApiError && e.status < 500) pendingRef.current = null;
      setError(ofcErrorMessage(e, t));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const rows: FeltOptionRow[] = [
    { key: 'variant', label: t('setup.variantLabel'), value: variant,
      info: t(variant === 'classic' ? 'setup.variantClassicHint' : 'setup.variantPineappleHint'),
      onChange: v => setVariant(v as OfcVariant),
      options: OFC_VARIANTS.map(v => ({ key: v, label: t(v === 'classic' ? 'setup.variantClassic' : 'setup.variantPineapple') })) },
    { key: 'stack', label: t('setup.startingStackChips'), value: String(startingStack), onChange: v => setStartingStack(Number(v)),
      options: [50, 100, 200, 500].map(v => ({ key: String(v), label: String(v) })) },
  ];
  return (
    <GameSetupScreen title={t('games:setup.createTable')} subtitle={t('setup.subtitle')}
      ctaLabel={t('games:setup.createTable')} ctaDisabled={busy} onCtaPress={() => void create()}>
      <SetupBlock index={0}>
        <SegmentedControl options={[{ key: '2', label: t('online.seats', { count: 2 }) }, { key: '3', label: t('online.seats', { count: 3 }) }]}
          value={String(capacity)} onChange={v => setCapacity(Number(v) as 2 | 3)} />
      </SetupBlock>
      <SetupBlock index={1}>
        <SegmentedControl options={[{ key: 'public', label: t('online.public') }, { key: 'private', label: t('online.private') }]}
          value={visibility} onChange={setVisibility} />
      </SetupBlock>
      <SetupBlock index={2} fill>
        <SeatTableBoard players={[]} selected={[]} onChange={() => {}} maxPlayers={capacity} seatsInteractive={false} fill
          emptySeatLabel={t('games:online.waitingSeat')} center={width => <FeltOptions gameName="OFC" rows={rows} width={width} />} />
      </SetupBlock>
      <Text style={{ color: colors.textSecondary }}>{t('online.autoStartHint', { count: capacity })}</Text>
      {error && <Text style={{ color: colors.accent }}>{error}</Text>}
    </GameSetupScreen>
  );
}
