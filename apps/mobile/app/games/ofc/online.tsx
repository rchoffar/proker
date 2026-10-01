import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { WifiOff } from 'lucide-react-native';
import { useOfcGame } from '../../../src/hooks/useOfcOnline';
import { BottomSheet } from '../../../src/components/ui/BottomSheet';
import { TABLE } from '../../../src/components/hand/PokerTable';
import { WinCelebration } from '../../../src/components/hand/WinCelebration';
import { OfcActorPanel } from '../../../src/components/ofc/OfcActorPanel';
import { SeatTableBoard } from '../../../src/components/games/SeatTableBoard';
import { LobbyFelt } from '../../../src/components/games/LobbyFelt';
import { shareTableCode } from '../../../src/lib/shareTableCode';
import { OfcTableFelt } from '../../../src/components/ofc/OfcTableFelt';
import { OfcSeatsStrip } from '../../../src/components/ofc/OfcSeatsStrip';
import type { OfcSeatVM } from '../../../src/components/ofc/OfcSeatsStrip';
import { PlacementBoard } from '../../../src/components/ofc/PlacementBoard';
import { DrawPlacement } from '../../../src/components/ofc/DrawPlacement';
import { ScoreSheet } from '../../../src/components/ofc/ScoreSheet';
import { GRID_SIZE, VARIANT_CONFIG } from '../../../src/lib/ofc';
import { ofcPlayView, ofcSeatData } from '../../../src/lib/ofc/view';
import { fontFamily, fontSize, radius, spacing } from '../../../src/design-system/theme';
import { useTheme } from '../../../src/design-system/ThemeProvider';
import { DARK_TILE, SCREEN_BG } from '../../../src/components/games/gameSurface';
import { GamePlayHeader } from '../../../src/components/games/GamePlayHeader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OfcOnlineScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation('ofc');
  const router = useRouter();
  if (!id) return <SafeAreaView style={[styles.screen, styles.centered]}>
    <Text style={styles.caption}>{t('online.errors.notFound')}</Text>
    <TouchableOpacity onPress={() => router.replace('/games/ofc')}><Text style={styles.reconnectText}>{t('common:back')}</Text></TouchableOpacity>
  </SafeAreaView>;
  return <OnlineView key={id} id={id} />;
}

function OnlineView({ id }: { id: string }) {
  const { t } = useTranslation('ofc');
  const { colors } = useTheme();
  const router = useRouter();
  const { game, history, error, sending, sendAction, leave, refresh } = useOfcGame(id);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const code = game?.code;
  const myId = game?.myPlayerId;
  const view = game?.state ? { ...game.state, players: game.state.players.map(p => ({ ...p, name: p.name || t('online.deletedPlayer') })) } : null;
  const inFlight = sending;
  const sendPlay = sendAction;
  const quit = () => router.back();
  const quitHome = () => router.dismissTo('/');
  useEffect(() => {
    if (game?.status !== 'finished') return;
    const timer = setTimeout(() => setCelebrating(true), 700);
    return () => clearTimeout(timer);
  }, [game?.status]);
  const abandon = () => Alert.alert(t('online.leaveTitle'), t(game?.status === 'waiting' ? 'online.leaveWaitingMessage' : 'online.forfeitMessage'), [
    { text: t('common:cancel'), style: 'cancel' },
    { text: t('online.leaveConfirm'), style: 'destructive', onPress: () => { void leave().then(ok => { if (ok) quit(); }); } },
  ]);
  const errorBanner = error && <TouchableOpacity onPress={refresh} style={styles.reconnectBar}>
    <WifiOff size={13} color={TABLE.gold} />
    <Text style={styles.reconnectText}>{error} · {t('common:retry')}</Text>
  </TouchableOpacity>;
  const historySheet = <BottomSheet visible={historyOpen} onClose={() => setHistoryOpen(false)} title={t('online.history')}>
    {history.length === 0 && <Text style={{ color: colors.textSecondary }}>{t('online.noHistory')}</Text>}
    {[...history].reverse().map(hand => <View key={hand.handNumber} style={{ gap: spacing.sm, marginBottom: spacing.md }}>
      <Text style={{ color: colors.textPrimary, fontFamily: fontFamily.bold }}>{t('online.historyHand', { hand: hand.handNumber })}</Text>
      {hand.result ? <View style={{ backgroundColor: SCREEN_BG, borderRadius: radius.md }}><ScoreSheet result={hand.result} nameById={Object.fromEntries((game?.members ?? []).map(m => [m.playerId, m.name ?? t('online.deletedPlayer')]))} /></View> :
        <Text style={{ color: colors.textSecondary }}>{t('online.cancelledHand')}</Text>}
    </View>)}
  </BottomSheet>;

  if (!game) return <SafeAreaView style={[styles.screen, styles.centered]}>
    <StatusBar style="light" />
    {!error && <ActivityIndicator color={colors.accentBright} />}
    {errorBanner}
    <TouchableOpacity onPress={quit}><Text style={styles.reconnectText}>{t('common:back')}</Text></TouchableOpacity>
  </SafeAreaView>;

  if (game.status === 'waiting') return <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <StatusBar style="light" />
    <GamePlayHeader title={t('online.title')} onClose={quit} onHome={quitHome} onDark />
    {errorBanner}
    <View style={styles.lobbyContent}>
      <SeatTableBoard players={[]} selected={game.members.map(m => ({ id: m.playerId, name: m.playerId === myId ? t('games:online.youSuffix', { name: m.name }) : m.name ?? t('online.deletedPlayer') }))}
        onChange={() => {}} maxPlayers={game.capacity} seatsInteractive={false} emptySeatLabel={t('games:online.waitingSeat')}
        center={width => <LobbyFelt code={game.code} codeLabel={t('games:online.tableCode')} caption={t('online.autoStartHint', { count: game.capacity })}
          inviteLabel={t('games:online.invite')} onInvite={() => shareTableCode(t('games:online.inviteMessage', { game: t('degen:names.ofc'), code: game.code }))}
          rules={[t('online.variant', { mode: t(game.variant === 'classic' ? 'setup.variantClassic' : 'setup.variantPineapple') }), t(game.visibility === 'public' ? 'online.public' : 'online.private')]} width={width} />} />
      <Text style={[styles.mutedText, { color: colors.onDarkTertiary }]}>{t('online.waitingPlayers', { current: game.members.length, max: game.capacity })}</Text>
    </View>
    <View style={styles.footer}><TouchableOpacity disabled={sending} onPress={abandon} style={styles.secondaryBtn}>
      <Text style={[styles.secondaryBtnText, { color: colors.onDarkSecondary }]}>{t('online.leaveRoom')}</Text>
    </TouchableOpacity></View>
  </SafeAreaView>;

  // ── Playing ──────────────────────────────────────────────────────────────────

  // Keep a way back if a response does not contain a playable state.
  if (!view || !myId) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.accentBright} />
        <Text style={[styles.mutedText, { color: colors.onDarkSecondary }]}>{t('games:online.joiningGame')}</Text>
        <TouchableOpacity onPress={quit} style={[styles.secondaryBtn, { backgroundColor: DARK_TILE }]}>
          <Text style={[styles.secondaryBtnText, { color: colors.onDarkPrimary }]}>{t('games:online.quit')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { phase } = view;
  // Online, "the actor" and "the viewer" are the same person, so the one redacted state
  // this device already has serves both roles the shared view module distinguishes.
  const v = ofcPlayView(view, { actorId: myId, rotateToActor: true, addressActorAsYou: true });
  const { actor: me, winner, nameById } = v;

  // Seat 0 = me, first in the strip — and while I'm acting my seat leaves it, since my
  // board is already rendered once, big, in the action zone.
  const stripSeats: OfcSeatVM[] = ofcSeatData(v, view, (p) =>
    p.id === myId ? t('games:online.youSuffix', { name: p.name }) : p.name
  );

  const myFantasyTurn = v.role === 'fantasy';
  const myInitialTurn = v.role === 'initial';
  const myDraw = v.role === 'draw' ? view.pending : null;

  const caption = v.caption.kind === 'none' ? '' : t(v.caption.key, v.caption.params);
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <GamePlayHeader
        title={t('online.headerCode', { code })}
        onClose={quit}
        onHome={quitHome}
        onDark
        right={
          <Text style={[styles.handBadge, { color: colors.onDarkTertiary }]}>{t('game.handBadge', { hand: view.handNumber })}</Text>
        }
      />
      {errorBanner}

      {/* One screen, no scrolling — see the Pass & Play twin for why. */}
      <View style={styles.content}>
        <Animated.Text key={`caption-${caption}`} entering={FadeInDown.duration(300)} style={styles.caption}>
          {caption}
        </Animated.Text>

        <OfcTableFelt>
          {(inner) => (
            <OfcSeatsStrip
              seats={stripSeats}
              activeId={phase === 'placing' ? view.turnId : null}
              inner={inner}
            />
          )}
        </OfcTableFelt>

        {(myFantasyTurn || myInitialTurn) && me?.hand && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.actorSlot}>
            <OfcActorPanel
              name={t('games:online.youSuffix', { name: me.name })}
              chips={me.chips}
              isButton={me.id === view.buttonId}
              inFantasyLand={me.inFantasyLand}
            >
              <PlacementBoard
                disabled={sending}
                key={`${myId}-${view.handNumber}-${myFantasyTurn ? 'fl' : 'initial'}`}
                hand={me.hand}
                discards={myFantasyTurn ? Math.max(0, me.hand.length - GRID_SIZE) : 0}
                commitLabel={t('game.commit')}
                onCommit={(placements) => {
                  sendPlay(
                    myFantasyTurn
                      ? { type: 'placeFantasy', playerId: myId, placements }
                      : { type: 'placeInitial', playerId: myId, placements },
                  );
                }}
              />
            </OfcActorPanel>
          </Animated.View>
        )}

        {!myFantasyTurn && myDraw && me?.grid && (
          <View style={styles.actorSlot}>
          <OfcActorPanel
            name={t('games:online.youSuffix', { name: me.name })}
            chips={me.chips}
            isButton={me.id === view.buttonId}
          >
            <DrawPlacement
              disabled={sending}
              draftKey={`ofc-draft:${id}:${myId}:${view.handNumber}:draw:${view.placeRound}`}
              key={`${myId}-${view.handNumber}-${view.placeRound}`}
              cards={myDraw.cards!}
              placeCount={VARIANT_CONFIG[view.variant].placeCount}
              grid={me.grid}
              discards={me.discards}
              onCommit={(placements) => sendPlay({ type: 'placeDraw', playerId: myId, placements })}
            />
          </OfcActorPanel>
          </View>
        )}

        {/* The one block with no natural ceiling, so the one that scrolls inside itself. */}
        {(phase === 'scoring' || phase === 'gameOver') && view.handResult && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.sheetSlot}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <ScoreSheet result={view.handResult} nameById={nameById} />
            </ScrollView>
          </Animated.View>
        )}
      </View>

      <View style={styles.footer}>
        {inFlight && (
          <View style={styles.sending}>
            <ActivityIndicator size="small" color={colors.onDarkTertiary} />
            <Text style={[styles.mutedText, { color: colors.onDarkTertiary }]}>{t('games:online.sending')}</Text>
          </View>
        )}
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={() => setHistoryOpen(true)} style={styles.secondaryBtn}>
            <Text style={[styles.secondaryBtnText, { color: colors.onDarkSecondary }]}>{t('online.history')}</Text>
          </TouchableOpacity>
          {game.status === 'playing' && !view.players.find(p => p.id === myId)?.eliminated && <TouchableOpacity disabled={sending} onPress={abandon}>
            <Text style={[styles.mutedText, { color: colors.onDarkTertiary }]}>{t('online.forfeit')}</Text>
          </TouchableOpacity>}
          {phase === 'gameOver' && <TouchableOpacity onPress={quit}><Text style={styles.reconnectText}>{t('common:back')}</Text></TouchableOpacity>}
        </View>

      </View>

      {historySheet}
      {celebrating && winner && (
        <View pointerEvents="none" style={styles.celebrationLayer}>
          <WinCelebration
            width={SCREEN_WIDTH}
            height={320}
            title={t('games:game.victory')}
            subtitle={t('online.winner', { name: winner.name })}
            borderRadius={0}
            onDone={() => setCelebrating(false)}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
  },
  // The table stays on screen while a refresh fails — without this it looked perfectly
  // alive, and nothing said why an action was going nowhere.
  sending: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  reconnectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(231, 195, 111, 0.12)',
  },
  reconnectText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    color: TABLE.gold,
  },
  handBadge: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
  },
  lobbyContent: {
    flex: 1,
    paddingHorizontal: spacing.base,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.base,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  // The placement board keeps its full height; the felt above it absorbs the difference.
  actorSlot: {
    flexShrink: 0,
  },
  sheetSlot: {
    flexShrink: 1,
  },
  caption: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.display,
    textAlign: 'center',
    color: TABLE.gold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    minHeight: 22,
  },
  footer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  toast: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
    textAlign: 'center',
  },
  waitingText: {
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  mutedText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  primaryBtn: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryBtn: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  disabledBtn: {
    opacity: 0.4,
  },
  primaryBtnText: {
    color: '#0A0A0F',
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  celebrationLayer: {
    position: 'absolute',
    top: '25%',
    left: 0,
    right: 0,
  },
});
