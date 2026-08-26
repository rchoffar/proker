import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { X, RotateCw, Users, WifiOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { TABLE } from '../../../src/components/hand/PokerTable';
import { WinCelebration } from '../../../src/components/hand/WinCelebration';
import { GlassCard } from '../../../src/components/ui/GlassCard';
import { OfcActorPanel } from '../../../src/components/ofc/OfcActorPanel';
import { OfcSeatsStrip } from '../../../src/components/ofc/OfcSeatsStrip';
import type { OfcSeatVM } from '../../../src/components/ofc/OfcSeatsStrip';
import { PlacementBoard } from '../../../src/components/ofc/PlacementBoard';
import { DrawPlacement } from '../../../src/components/ofc/DrawPlacement';
import { ScoreSheet } from '../../../src/components/ofc/ScoreSheet';
import { useOfcDraft } from '../../../src/store/useOfcDraft';
import { useConfirmQuitGame } from '../../../src/hooks/useConfirmQuitGame';
import { useAppStore } from '../../../src/store/useAppStore';
import { recordOfcGameEnd, recordOfcHand } from '../../../src/lib/gameStats';
import { useOfcGuest, useOfcHost } from '../../../src/hooks/useOfcOnline';
import type { OfcOnlineCommon } from '../../../src/hooks/useOfcOnline';
import { GRID_SIZE, MAX_OFC_PLAYERS, MIN_OFC_PLAYERS, VARIANT_CONFIG } from '../../../src/lib/ofc';
import type { OfcVariant } from '../../../src/lib/ofc';
import { fontFamily, fontSize, radius, spacing } from '../../../src/design-system/theme';
import { useTheme } from '../../../src/design-system/ThemeProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Server/protocol disconnect enums → ofc namespace keys, translated at render.
const DISCONNECT_KEYS = {
  host_left: 'disconnect.host_left',
  expired: 'disconnect.expired',
  hostQuit: 'disconnect.hostQuit',
} as const;

// Modal screens sit on a black sheet in BOTH themes (EnvironmentBackground lives in the
// root layout and doesn't follow modals) — so use the theme-invariant onDark* text tokens
// plus these fixed dark surfaces, same convention as the bluff online screen.
const DARK_TILE = 'rgba(255, 255, 255, 0.08)';
const SCREEN_BG = '#101114';

export default function OfcOnlineScreen() {
  const mode = useOfcDraft((s) => s.mode);
  const pseudo = useOfcDraft((s) => s.pseudo);
  const joinCode = useOfcDraft((s) => s.joinCode);
  const startingStack = useOfcDraft((s) => s.startingStack);
  const variant = useOfcDraft((s) => s.variant);

  if (mode === 'guest' && joinCode) return <GuestFlow pseudo={pseudo} joinCode={joinCode} />;
  return <HostFlow pseudo={pseudo} startingStack={startingStack} variant={variant} />;
}

function HostFlow({ pseudo, startingStack, variant }: { pseudo: string; startingStack: number; variant: OfcVariant }) {
  const online = useOfcHost(pseudo);
  return (
    <OnlineView
      online={online}
      isHost
      hostVariant={variant}
      onStart={() => online.startGame(startingStack, variant)}
      onReplay={online.replay}
    />
  );
}

function GuestFlow({ pseudo, joinCode }: { pseudo: string; joinCode: string }) {
  const online = useOfcGuest(pseudo, joinCode);
  return <OnlineView online={online} isHost={false} />;
}

interface OnlineViewProps {
  online: OfcOnlineCommon;
  isHost: boolean;
  hostVariant?: OfcVariant; // the mode this host will start — shown in the lobby
  onStart?: () => void;
  onReplay?: () => void;
}

function OnlineView({ online, isHost, hostVariant, onStart, onReplay }: OnlineViewProps) {
  // Locking the phone suspends the socket — fatal for the host, disruptive for guests.
  useKeepAwake();
  const { t } = useTranslation('ofc');
  const { colors } = useTheme();
  const router = useRouter();
  const { status, code, myId, members, view, errorMsg, closedReason, sendAction } = online;

  useConfirmQuitGame(status === 'playing' && view?.phase !== 'gameOver');

  const [celebrating, setCelebrating] = useState(false);
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  // Action errors from the host surface as a transient toast (auto-dismissed).
  useEffect(() => {
    if (!errorMsg || status === 'error') return;
    const timer = setTimeout(() => setDismissedError(errorMsg), 3000);
    return () => clearTimeout(timer);
  }, [errorMsg, status]);
  const toast = errorMsg && errorMsg !== dismissedError && status !== 'error' ? errorMsg : null;

  useEffect(() => {
    if (view?.phase !== 'gameOver') return;
    const timer = setTimeout(() => setCelebrating(true), 700);
    return () => clearTimeout(timer);
  }, [view?.phase]);

  // Every device (host and guests) records local stats for all pseudos in the game.
  // Broadcasts repeat states, so both effects dedupe: hands by hand number (the ref
  // clears while a hand is being played), the game end by a latch reset when the phase
  // moves on. The scoring/gameOver condition also covers a guest reconnecting late.
  const updateGameStats = useAppStore((s) => s.updateGameStats);
  const statsHandRef = useRef<number | null>(null);
  useEffect(() => {
    if (!view) return;
    if (view.phase === 'dealing' || view.phase === 'placing') {
      statsHandRef.current = null;
      return;
    }
    if (!view.handResult || statsHandRef.current === view.handNumber) return;
    statsHandRef.current = view.handNumber;
    updateGameStats((s) =>
      recordOfcHand(s, {
        perPlayer: view.players
          .filter((p) => view.handResult!.perPlayer[p.id])
          .map((p) => ({
            name: p.name,
            fouled: view.handResult!.perPlayer[p.id].fouled,
            fantasyNext: view.handResult!.perPlayer[p.id].fantasyNext,
          })),
      })
    );
  }, [view, updateGameStats]);

  const gameOverRecordedRef = useRef(false);
  useEffect(() => {
    if (view?.phase !== 'gameOver') {
      gameOverRecordedRef.current = false;
      return;
    }
    if (gameOverRecordedRef.current || !view.winnerId) return;
    gameOverRecordedRef.current = true;
    const winnerPlayer = view.players.find((p) => p.id === view.winnerId);
    if (!winnerPlayer) return;
    updateGameStats((s) =>
      recordOfcGameEnd(s, { players: view.players.map((p) => p.name), winner: winnerPlayer.name })
    );
  }, [view, updateGameStats]);

  const quit = () => router.dismissTo('/(tabs)/degen');

  // ── Pre-game states ──────────────────────────────────────────────────────────

  if (status === 'connecting') {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.accentBright} />
        <Text style={[styles.mutedText, { color: colors.onDarkSecondary }]}>{t('online.connecting')}</Text>
        <TouchableOpacity onPress={quit} style={[styles.secondaryBtn, { backgroundColor: DARK_TILE }]}>
          <Text style={[styles.secondaryBtnText, { color: colors.onDarkPrimary }]}>{t('common:cancel')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (status === 'error' || status === 'closed') {
    const message =
      status === 'error'
        ? errorMsg
        : t(closedReason ? DISCONNECT_KEYS[closedReason] : 'disconnect.generic');
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <StatusBar style="light" />
        <WifiOff size={28} color={colors.onDarkTertiary} strokeWidth={1.5} />
        <Text style={[styles.mutedText, { color: colors.onDarkPrimary }]}>{message}</Text>
        <TouchableOpacity onPress={quit} style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]}>
          <Text style={styles.primaryBtnText}>{t('common:back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (status === 'lobby') {
    const canStart = members.length >= MIN_OFC_PLAYERS && members.length <= MAX_OFC_PLAYERS;
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: DARK_TILE }]} onPress={quit} activeOpacity={0.7}>
            <X size={18} color={colors.onDarkSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.onDarkPrimary }]}>{t('online.title')}</Text>
          <View style={styles.iconBtn} />
        </View>

        <View style={styles.lobbyContent}>
          <Animated.View entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)} style={styles.codeBlock}>
            <Text style={[styles.codeLabel, { color: colors.onDarkTertiary }]}>{t('online.tableCode')}</Text>
            <Text style={[styles.codeValue, { color: TABLE.gold }]}>{code}</Text>
            <Text style={[styles.mutedText, { color: colors.onDarkTertiary }]}>
              {isHost ? t('online.shareCode') : t('online.waitingHostStart')}
            </Text>
            {isHost && hostVariant && (
              <Text style={[styles.mutedText, { color: colors.onDarkTertiary }]}>
                {t('online.variant', {
                  mode: t(hostVariant === 'classic' ? 'setup.variantClassic' : 'setup.variantPineapple'),
                })}
              </Text>
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}>
            <GlassCard padding={16} variant="dark">
              <View style={styles.membersHeader}>
                <Users size={16} color={colors.onDarkSecondary} strokeWidth={2} />
                <Text style={[styles.membersTitle, { color: colors.onDarkSecondary }]}>
                  {t('online.players', { current: members.length, max: MAX_OFC_PLAYERS })}
                </Text>
              </View>
              {members.map((m) => (
                <View key={m.playerId} style={styles.memberRow}>
                  <View style={[styles.dot, { backgroundColor: m.connected ? colors.accentBright : colors.onDarkTertiary }]} />
                  <Text style={[styles.memberName, { color: colors.onDarkPrimary }]}>
                    {m.playerId === myId ? t('online.youSuffix', { name: m.name }) : m.name}
                  </Text>
                </View>
              ))}
            </GlassCard>
          </Animated.View>
        </View>

        <View style={styles.footer}>
          {isHost ? (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.accentBright }, !canStart && styles.disabledBtn]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onStart?.();
              }}
              disabled={!canStart}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>{t('online.startGame')}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.mutedText, styles.waitingText, { color: colors.onDarkTertiary }]}>
              {t('online.startsWhenHostLaunches')}
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Playing ──────────────────────────────────────────────────────────────────

  if (!view || !myId) return null;

  const { phase } = view;
  const me = view.players.find((p) => p.id === myId);
  const winner = view.winnerId ? view.players.find((p) => p.id === view.winnerId) : null;
  const turnPlayer = view.players.find((p) => p.id === view.turnId);
  const nameById = Object.fromEntries(view.players.map((p) => [p.id, p.name]));

  // Seat 0 = me, first in the strip — same rotation trick as the other games.
  const myIdx = view.players.findIndex((p) => p.id === myId);
  const ordered = myIdx <= 0 ? view.players : [...view.players.slice(myIdx), ...view.players.slice(0, myIdx)];
  const seats: OfcSeatVM[] = ordered.map((p) => ({
    id: p.id,
    name: p.id === myId ? t('online.youSuffix', { name: p.name }) : p.name,
    chips: p.chips,
    eliminated: p.eliminated,
    inFantasyLand: p.inFantasyLand,
    fantasyPlaced: p.fantasyPlaced,
    isButton: p.id === view.buttonId,
    gridCounts: p.gridCounts,
    grid: p.grid,
    fouled: phase === 'scoring' || phase === 'gameOver' ? view.handResult?.perPlayer[p.id]?.fouled : undefined,
    connected: p.connected,
  }));

  const myFantasyTurn = !!me && me.inFantasyLand && !me.fantasyPlaced && (me.hand?.length ?? 0) > 0;
  const myInitialTurn =
    !!me && !me.inFantasyLand && phase === 'placing' && view.placeRound === 0 && view.turnId === myId && (me.hand?.length ?? 0) > 0;
  // The owner-only `cards` field doubles as the type guard: without it there is nothing to place.
  const myDraw =
    phase === 'placing' && view.pending?.playerId === myId && view.pending.cards ? view.pending : null;
  // While I'm acting, my board renders once, big, in the action zone — my seat leaves
  // the strip so nothing shows twice (and the strip stays short enough not to scroll).
  const iAmActing = myFantasyTurn || myInitialTurn || !!myDraw;
  const stripSeats = iAmActing ? seats.filter((s) => s.id !== myId) : seats;

  const caption = (() => {
    if (phase !== 'placing') {
      return phase === 'scoring' ? t('game.handScored', { hand: view.handNumber }) : '';
    }
    const pineapple = view.variant === 'pineapple';
    if (myFantasyTurn) {
      return pineapple
        ? t('game.fantasyYouPineapple', { count: me?.hand?.length ?? 14 })
        : t('game.fantasyYou');
    }
    if (myInitialTurn) return t('game.initialYou');
    if (myDraw) return t(pineapple ? 'game.drawYouPineapple' : 'game.drawYou');
    if (turnPlayer) {
      if (view.placeRound === 0) return t('game.initialOther', { name: turnPlayer.name });
      return t(pineapple ? 'game.drawOtherPineapple' : 'game.drawOther', { name: turnPlayer.name });
    }
    return t('game.waitingFantasy');
  })();

  const handleNextHand = () => {
    sendAction({ type: 'nextHand', playerId: myId });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: DARK_TILE }]} onPress={quit} activeOpacity={0.7}>
          <X size={18} color={colors.onDarkSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.onDarkPrimary }]}>{t('online.headerCode', { code })}</Text>
        <View style={styles.iconBtn}>
          <Text style={[styles.handBadge, { color: colors.onDarkTertiary }]}>{t('game.handBadge', { hand: view.handNumber })}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.Text key={`caption-${view.version}`} entering={FadeInDown.duration(300)} style={styles.caption}>
          {caption}
        </Animated.Text>

        <OfcSeatsStrip seats={stripSeats} activeId={phase === 'placing' ? view.turnId : null} />

        {(myFantasyTurn || myInitialTurn) && me?.hand && (
          <Animated.View entering={FadeIn.duration(200)}>
            <OfcActorPanel
              name={t('online.youSuffix', { name: me.name })}
              chips={me.chips}
              isButton={me.id === view.buttonId}
              inFantasyLand={me.inFantasyLand}
            >
              <PlacementBoard
                key={`${myId}-${view.handNumber}-${myFantasyTurn ? 'fl' : 'initial'}`}
                hand={me.hand}
                discards={myFantasyTurn ? Math.max(0, me.hand.length - GRID_SIZE) : 0}
                commitLabel={t('game.commit')}
                onCommit={(placements) => {
                  sendAction(
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
          <OfcActorPanel
            name={t('online.youSuffix', { name: me.name })}
            chips={me.chips}
            isButton={me.id === view.buttonId}
          >
            <DrawPlacement
              key={`${myId}-${view.handNumber}-${view.placeRound}`}
              cards={myDraw.cards!}
              placeCount={VARIANT_CONFIG[view.variant].placeCount}
              grid={me.grid}
              discards={me.discards}
              onCommit={(placements) => sendAction({ type: 'placeDraw', playerId: myId, placements })}
            />
          </OfcActorPanel>
        )}

        {(phase === 'scoring' || phase === 'gameOver') && view.handResult && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <ScoreSheet result={view.handResult} nameById={nameById} />
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={styles.footer}>
        {toast && (
          <Animated.Text entering={FadeIn.duration(200)} style={[styles.toast, { color: '#FF6B70' }]}>
            {toast}
          </Animated.Text>
        )}

        {phase === 'scoring' &&
          (isHost ? (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]} onPress={handleNextHand} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>{t('game.nextHand')}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.mutedText, styles.waitingText, { color: colors.onDarkTertiary }]}>
              {t('online.waitingNextHand')}
            </Text>
          ))}

        {phase === 'gameOver' && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: DARK_TILE }]} onPress={quit} activeOpacity={0.85}>
              <Text style={[styles.actionBtnText, { color: colors.onDarkPrimary }]}>{t('online.quit')}</Text>
            </TouchableOpacity>
            {isHost && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.accentBright }]}
                onPress={() => {
                  setCelebrating(false);
                  onReplay?.();
                }}
                activeOpacity={0.85}
              >
                <View style={styles.replayContent}>
                  <RotateCw size={16} color="#0A0A0F" strokeWidth={2} />
                  <Text style={styles.primaryBtnText}>{t('game.replay')}</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {celebrating && winner && (
        <View pointerEvents="none" style={styles.celebrationLayer}>
          <WinCelebration
            width={SCREEN_WIDTH}
            height={320}
            title={t('game.victory')}
            subtitle={t('game.winnerSub', { name: winner.name })}
            borderRadius={0}
            onDone={() => setCelebrating(false)}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
  },
  handBadge: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
  },
  lobbyContent: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  codeBlock: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  codeLabel: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeValue: {
    fontSize: 56,
    fontFamily: fontFamily.display,
    letterSpacing: 12,
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  membersTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  memberName: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.medium,
  },
  content: {
    paddingHorizontal: spacing.base,
    gap: spacing.md,
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
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  replayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
