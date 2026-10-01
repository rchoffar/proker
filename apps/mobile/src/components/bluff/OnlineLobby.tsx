import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Crypto from 'expo-crypto';
import { GlassCard } from '../ui/GlassCard';
import { SegmentedControl } from '../ui/SegmentedControl';
import { BottomSheet } from '../ui/BottomSheet';
import { getBluffGames, getBluffRooms, joinBluffGame, BluffApiError } from '../../lib/api/bluff';
import type { BluffGameSummary } from '../../lib/api/bluff';
import { bluffErrorMessage } from '../../lib/bluff/onlineErrors';
import { useForegroundPolling } from '../../hooks/useForegroundPolling';
import { useTheme } from '../../design-system/ThemeProvider';
import { fontFamily, fontSize, spacing } from '../../design-system/theme';

export function BluffOnlineLobby({ onRefreshReady, onRefreshingChange }: { onRefreshReady: (refresh: () => void) => void; onRefreshingChange: (refreshing: boolean) => void }) {
  const { t } = useTranslation('bluff');
  const { colors } = useTheme();
  const router = useRouter();
  const [games, setGames] = useState<BluffGameSummary[]>([]);
  const [rooms, setRooms] = useState<BluffGameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [tab, setTab] = useState<'mine' | 'rooms'>('mine');
  const pendingRef = useRef<{ key: string; requestId: string } | null>(null);
  const refresh = useForegroundPolling(10000, async signal => {
    const results = await Promise.allSettled([getBluffGames(signal), getBluffRooms(signal)]);
    if (signal.aborted) return;
    if (results[0].status === 'fulfilled') setGames(results[0].value.games);
    if (results[1].status === 'fulfilled') setRooms(results[1].value.rooms);
    onRefreshingChange(false);
    setLoading(false);
    const failed = results.find(r => r.status === 'rejected');
    setError(failed?.status === 'rejected' ? bluffErrorMessage(failed.reason, t) : null);
  }, e => { onRefreshingChange(false); setLoading(false); setError(bluffErrorMessage(e, t)); });
  useEffect(() => { onRefreshReady(() => { onRefreshingChange(true); refresh(); }); }, [onRefreshReady, onRefreshingChange, refresh]);
  const open = (id: string) => router.push({ pathname: '/games/bluff/online', params: { id } });
  const act = async (joinCode: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const key = joinCode;
    const requestId = pendingRef.current?.key === key ? pendingRef.current.requestId : Crypto.randomUUID();
    pendingRef.current = { key, requestId };
    try {
      const { game } = await joinBluffGame(joinCode, requestId);
      pendingRef.current = null;
      setJoinError(null);
      setJoinOpen(false);
      open(game.id);
    } catch (e) {
      if (e instanceof BluffApiError && e.status < 500) pendingRef.current = null;
      setJoinError(bluffErrorMessage(e, t));
      refresh();
    } finally { busyRef.current = false; setBusy(false); }
  };
  const sorted = [...games].sort((a, b) => Number(b.canAct) - Number(a.canAct) || Number(a.status === 'finished') - Number(b.status === 'finished'));
  const items = tab === 'mine' ? sorted : rooms;
  const statusLabel = (game: BluffGameSummary) => game.members.find(m => m.playerId === game.myPlayerId)?.status === 'forfeited' ? t('online.forfeited') : game.canAct ? t('online.yourTurn') :
    game.status === 'waiting' ? t('online.waitingPlayers', { current: game.members.length, max: game.capacity }) :
    game.status === 'finished' ? t('online.finished') : game.status === 'abandoned' ? t('online.abandoned') : t('online.waitingTurn');
  return <View style={styles.content}>
    <SegmentedControl options={[{ key: 'mine', label: t('online.myRooms') }, { key: 'rooms', label: t('online.availableRooms') }]} value={tab} onChange={setTab} />
    {loading && <ActivityIndicator color={colors.accent} />}
    {error && <TouchableOpacity onPress={refresh}><Text style={[styles.text, { color: colors.accent }]}>{error}</Text><Text style={[styles.text, { color: colors.textSecondary }]}>{t('common:retry')}</Text></TouchableOpacity>}
    {!loading && items.length === 0 && <Text style={[styles.text, { color: colors.textSecondary }]}>{t(tab === 'mine' ? 'online.noGames' : 'online.noRooms')}</Text>}
    {items.map(game => <TouchableOpacity key={game.id} disabled={busy} onPress={() => tab === 'mine' ? open(game.id) : void act(game.code)}>
      <GlassCard padding={12}>
        <Text style={[styles.title, { color: game.canAct ? colors.accent : colors.textPrimary }]}>{statusLabel(game)}</Text>
        <Text style={[styles.text, { color: colors.textSecondary }]}>{game.members.map(m => m.name ?? t('online.deletedPlayer')).join(' · ')}</Text>
        <Text style={[styles.text, { color: colors.textTertiary }]}>{t('online.gameSummary', { variant: t(game.config.variant === 'quick' ? 'setup.variantQuickShort' : 'setup.variantStandardShort'), round: game.round })}</Text>
      </GlassCard>
    </TouchableOpacity>)}
    {!joinOpen && joinError && <Text style={[styles.text, { color: colors.accent }]}>{joinError}</Text>}
    <TouchableOpacity disabled={busy} onPress={() => { setJoinError(null); setJoinOpen(true); }}>
      <GlassCard padding={16}>
        <Text style={[styles.title, { color: colors.accent }]}>{t('online.joinByCode')}</Text>
      </GlassCard>
    </TouchableOpacity>
    <BottomSheet visible={joinOpen} onClose={() => { if (!busy) setJoinOpen(false); }} title={t('online.joinByCode')}>
      <View style={styles.content}>
        <TextInput value={code} onChangeText={v => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6}
          editable={!busy} autoFocus placeholder={t('online.codePlaceholder')} accessibilityLabel={t('online.codePlaceholder')}
          placeholderTextColor={colors.textTertiary} style={[styles.code, { color: colors.textPrimary, borderColor: colors.surface.fieldBorder }]} />
        {joinError && <Text style={[styles.text, { color: colors.accent }]}>{joinError}</Text>}
        <TouchableOpacity disabled={busy || code.length !== 6} onPress={() => void act(code)} style={[styles.joinButton, (busy || code.length !== 6) && styles.disabled]}>
          {busy ? <ActivityIndicator color={colors.accent} /> : <Text style={[styles.title, { color: colors.accent }]}>{t('games:setup.join')}</Text>}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  </View>;
}
const styles = StyleSheet.create({
  content: { gap: spacing.md },
  joinButton: { padding: spacing.md, alignItems: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.base }, text: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  code: { borderWidth: 1, borderRadius: 8, padding: spacing.md, fontSize: fontSize.lg, fontFamily: fontFamily.bold },
  disabled: { opacity: 0.4 },
});
