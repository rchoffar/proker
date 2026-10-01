import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { WifiOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { PlayingCard } from '../../../src/components/hand/PlayingCard';
import { TABLE } from '../../../src/components/hand/PokerTable';
import { WinCelebration } from '../../../src/components/hand/WinCelebration';
import { BluffTable, BLUFF_TABLE_MARGIN_Y } from '../../../src/components/bluff/BluffTable';
import { SeatTableBoard } from '../../../src/components/games/SeatTableBoard';
import { LobbyFelt } from '../../../src/components/games/LobbyFelt';
import { shareTableCode } from '../../../src/lib/shareTableCode';
import { PLAY_TABLE, playTableHeight } from '../../../src/components/table/tableSize';
import { DARK_CARD_BG, DARK_TILE, LOSS_ON_DARK, SCREEN_BG } from '../../../src/components/games/gameSurface';
import { GamePlayHeader } from '../../../src/components/games/GamePlayHeader';
import { GameOverActions } from '../../../src/components/games/GameOverActions';
import type { BluffSeatVM } from '../../../src/components/bluff/BluffTable';
import { ClaimPickerSheet } from '../../../src/components/bluff/ClaimPickerSheet';
import { DarkStepper } from '../../../src/components/bluff/DarkStepper';
import { useBluffGame } from '../../../src/hooks/useBluffOnline';
import type { BluffOnlineCommon } from '../../../src/hooks/useBluffOnline';
import { MAX_BOARD_CARDS, claimLabel } from '../../../src/lib/bluff';
import { bluffPlayView, bluffSeatData } from '../../../src/lib/bluff/view';
import type { Claim } from '../../../src/lib/bluff';
import { fontFamily, fontSize, radius, spacing } from '../../../src/design-system/theme';
import { useTheme } from '../../../src/design-system/ThemeProvider';

const TABLE_W = PLAY_TABLE.width;

const HAND_FAN_ANGLES: Record<number, number[]> = {
  1: [0],
  2: [-6, 6],
  3: [-8, 0, 8],
  4: [-12, -4, 4, 12],
  5: [-14, -7, 0, 7, 14],
};

export default function BluffOnlineScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const online = useBluffGame(id);
  return <OnlineView online={online} />;
}
function OnlineView({ online }: { online: BluffOnlineCommon }) {
  const { t } = useTranslation('bluff');
  const { colors } = useTheme();
  const router = useRouter();
  const { status, code, myId, members, view, errorMsg, reconnecting, sendAction, sending: inFlight, game, leave } = online;

  const sendPlay = sendAction;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [faceUpCount, setFaceUpCount] = useState(3);
  const [faceDownCount, setFaceDownCount] = useState(0);
  const [celebrating, setCelebrating] = useState(false);

  // The felt is fitted to the room this screen actually has, not to a fraction of the window:
  // with a fixed height inside a `flex: 1` container the overflow went into the felt's own
  // top and bottom and sliced the seat pods off. BluffTable's own vertical margin (pod
  // clearance) is not room the felt can use, so it comes off the measurement.
  const [areaH, setAreaH] = useState<number | null>(null);
  const onTableAreaLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.height) - BLUFF_TABLE_MARGIN_Y * 2;
    if (next > 0 && next !== areaH) setAreaH(next);
  };
  const tableH = playTableHeight(areaH);

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

  const quit = () => router.back();
  const quitHome = () => router.dismissTo('/');
  const abandon = () => Alert.alert(t('online.leaveTitle'), t(status === 'lobby' ? 'online.leaveWaitingMessage' : 'online.forfeitMessage'), [
    { text: t('common:cancel'), style: 'cancel' },
    { text: t('online.leaveConfirm'), style: 'destructive', onPress: () => { void leave().then(ok => { if (ok) quit(); }); } },
  ]);

  // ── Pre-game states ──────────────────────────────────────────────────────────

  if (status === 'connecting') {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.accentBright} />
        <Text style={[styles.mutedText, { color: colors.onDarkSecondary }]}>{t('games:online.connecting')}</Text>
        <TouchableOpacity onPress={quit} style={[styles.secondaryBtn, { backgroundColor: DARK_TILE }]}>
          <Text style={[styles.secondaryBtnText, { color: colors.onDarkPrimary }]}>{t('common:cancel')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    const message = errorMsg;
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
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <GamePlayHeader title={t('online.title')} onClose={quit} onHome={quitHome} onDark />

        {/* The room IS the table: the code sits on the felt and the seats fill as people
            join, instead of a code card above a list of names. */}
        <View style={styles.lobbyContent}>
          <Animated.View entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)}>
            <SeatTableBoard
              players={[]}
              selected={members.map((m) => ({
                id: m.playerId,
                name: m.playerId === myId ? t('games:online.youSuffix', { name: m.name }) : m.name,
              }))}
              onChange={() => {}}
              maxPlayers={game?.capacity ?? 2}
              seatsInteractive={false}
              emptySeatLabel={t('games:online.waitingSeat')}
              dimmedIds={members.filter((m) => !m.connected).map((m) => m.playerId)}
              center={(feltWidth) => (
                <LobbyFelt
                  code={code ?? ''}
                  codeLabel={t('games:online.tableCode')}
                  caption={t('online.autoStartHint', { count: game?.capacity ?? 2 })}
                  inviteLabel={t('games:online.invite')}
                  onInvite={
                    code
                      ? () => shareTableCode(t('games:online.inviteMessage', { game: t('degen:names.bluff'), code }))
                      : undefined
                  }
                  rules={[
                    t(game?.config.jeuMax ? 'online.jeuMaxEnabled' : 'online.jeuMaxDisabledLobby'),
                    t(game?.config.variant === 'quick' ? 'online.variantQuick' : 'online.variantStandard'),
                  ]}
                  width={feltWidth}
                />
              )}
            />
          </Animated.View>
          <Text style={[styles.mutedText, { color: colors.onDarkTertiary }]}>
            {t('games:online.players', { current: members.length, max: game?.capacity ?? 2 })}
          </Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity onPress={abandon} disabled={inFlight} style={styles.secondaryBtn}>
            <Text style={[styles.secondaryBtnText, { color: colors.onDarkSecondary }]}>{t('online.leaveRoom')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Playing ──────────────────────────────────────────────────────────────────

  // Playing, but this device has no state to draw yet — normally the beat between the host
  // dealing and its first broadcast reaching us. It used to `return null`, which is a fully
  // black screen with no way out, and a late joiner could sit in it indefinitely (the relay
  // now refuses them outright, but a silent hole is still the wrong thing to render).
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

  const { phase, reveal } = view;
  // Seat 0 = me, at bottom center, and my plate says "(you)" — the two things that make
  // this an online table rather than a shared phone. Everything else about the felt is
  // the same rules for both modes, so it comes out of the shared view module.
  const v = bluffPlayView(view, { viewerId: myId, rotateToViewer: true, addressViewerAsYou: true });
  const { turnPlayer, starter, winner, isViewerTurn: myTurn, isViewerStarter: isStarter, canCatch, mustCatch } = v;
  const loser = reveal ? view.players.find((p) => p.id === reveal.loserId) : null;
  const catcher = reveal ? view.players.find((p) => p.id === reveal.catcherId) : null;
  const claimer = reveal ? view.players.find((p) => p.id === reveal.claimerId) : null;

  // No "(you)" suffix on the felt: online seats you at the bottom of the table, so the seat
  // is already unmistakably yours. It also fed a decorated name to the pod's avatar, whose
  // initials are the first letter of the first two words — "mathieuchfd (toi)" came out as
  // "M(", which is what Mathieu was asking about.
  const seats: BluffSeatVM[] = bluffSeatData(v, (p) => p.name);

  const myHand = v.viewer?.hand ?? [];
  const fanAngles = HAND_FAN_ANGLES[myHand.length] ?? HAND_FAN_ANGLES[2];

  const caption =
    v.caption.kind === 'none'
      ? ''
      : v.caption.kind === 'claim'
        ? claimLabel(v.caption.claim, t)
        : t(v.caption.key, { name: v.caption.name });

  const handleClaim = (claim: Claim) => {
    setPickerOpen(false);
    sendPlay({ type: 'claim', playerId: myId, claim });
  };

  const handleCatch = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    sendPlay({ type: 'catch', playerId: myId });
  };

  const handleJeuMax = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    sendPlay({ type: 'jeuMax', playerId: myId });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <GamePlayHeader
        title={t('online.headerCode', { code })}
        onClose={quit}
        onHome={quitHome}
        onDark
        right={
          <Text style={[styles.roundBadge, { color: colors.onDarkTertiary }]}>{t('game.roundBadge', { round: view.round })}</Text>
        }
      />
      {reconnecting && (
        <View style={styles.reconnectBar}>
          <WifiOff size={13} color={TABLE.gold} strokeWidth={2} />
          <Text style={styles.reconnectText}>{t('games:online.reconnecting')}</Text>
        </View>
      )}

      <View style={styles.tableArea} onLayout={onTableAreaLayout}>
        <BluffTable
          width={TABLE_W}
          height={tableH}
          players={seats}
          board={view.board}
          hiddenCount={view.hiddenBoardCount}
          hiddenBoard={view.hiddenBoard}
          turnId={phase === 'bidding' ? view.turnId : null}
          reveal={reveal}
          roundToken={view.round}
          announcement={
            reveal ? (
            <Animated.View entering={FadeIn.duration(300)} style={styles.resultBanners}>
              {reveal.kind === 'jeuMax' ? (
                <Text style={[styles.resultBanner, { color: reveal.jeuMaxSuccess ? TABLE.gold : LOSS_ON_DARK }]}>
                  {reveal.jeuMaxSuccess
                    ? t(reveal.jeuMaxShedsLast ? 'game.jeuMaxLastCard' : 'game.jeuMaxSuccess', { name: catcher?.name })
                    : reveal.holds
                      ? t('game.jeuMaxFailHigher', {
                          name: catcher?.name,
                          best: reveal.bestClaim ? claimLabel(reveal.bestClaim, t) : '',
                        })
                      : t('game.jeuMaxFailNotHeld', { name: catcher?.name })}
                </Text>
              ) : (
                <Text style={[styles.resultBanner, { color: reveal.holds ? TABLE.gold : LOSS_ON_DARK }]}>
                  {reveal.holds
                    ? t('game.revealHolds', { name: catcher?.name })
                    : t('game.revealBluff', { name: claimer?.name })}
                </Text>
              )}
              <Text style={[styles.resultSub, { color: colors.onDarkTertiary }]}>
                {reveal.eliminatesLoser
                  ? t('game.revealSubEliminated', { claim: claimLabel(reveal.claim, t), name: loser?.name })
                  : claimLabel(reveal.claim, t)}
              </Text>
              {reveal.kind === 'jeuMax' && catcher && phase !== 'gameOver' && (
                <Text style={[styles.resultSub, { color: colors.onDarkTertiary }]}>
                  {t('game.jeuMaxStatLine', {
                    name: catcher.name,
                    successes: catcher.jeuMaxSuccesses,
                    attempts: catcher.jeuMaxAttempts,
                  })}
                </Text>
              )}
              {phase === 'gameOver' &&
                view.players
                  .filter((p) => p.jeuMaxAttempts > 0)
                  .map((p) => (
                    <Text key={p.id} style={[styles.resultSub, { color: colors.onDarkTertiary }]}>
                      {t('game.jeuMaxStatLine', {
                        name: p.name,
                        successes: p.jeuMaxSuccesses,
                        attempts: p.jeuMaxAttempts,
                      })}
                    </Text>
                  ))}
            </Animated.View>
          ) : (
            <Animated.Text key={`caption-${view.version}`} entering={FadeInDown.duration(300)} style={styles.caption}>
              {caption}
            </Animated.Text>
            )
          }
        >
          {celebrating && winner && (
            <WinCelebration
              width={TABLE_W}
              height={tableH}
              title={t('games:game.victory')}
              subtitle={t('game.winnerSub', { name: winner.name })}
              onDone={() => setCelebrating(false)}
            />
          )}
        </BluffTable>
      </View>

      {/* Own hand — always visible, it's my device. */}
      {!v.handsPublic && myHand.length > 0 && !v.viewer?.eliminated && (
        <View style={[styles.handZone, { borderColor: colors.onDarkHairline, backgroundColor: DARK_CARD_BG }]}>
          {phase === 'chooseBoard' && isStarter && (
            <View style={styles.boardChoice}>
              <DarkStepper
                label={t('game.faceUpStepper')}
                value={faceUpCount}
                min={0}
                max={MAX_BOARD_CARDS - faceDownCount}
                onDecrement={() => setFaceUpCount((v) => Math.max(0, v - 1))}
                onIncrement={() =>
                  setFaceUpCount((v) => Math.min(MAX_BOARD_CARDS - faceDownCount, v + 1))
                }
              />
              <DarkStepper
                label={t('game.faceDownStepper')}
                value={faceDownCount}
                min={0}
                max={MAX_BOARD_CARDS - faceUpCount}
                onDecrement={() => setFaceDownCount((v) => Math.max(0, v - 1))}
                onIncrement={() =>
                  setFaceDownCount((v) => Math.min(MAX_BOARD_CARDS - faceUpCount, v + 1))
                }
              />
            </View>
          )}
          {phase === 'chooseBoard' && isStarter ? (
            // The starter sizes the middle BLIND — their own fan only unlocks once the board
            // split is validated (rule decision; no explanatory sentence, the reveal button
            // sits right here next to the steppers). Other players keep their hand.
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]}
              onPress={() => sendPlay({ type: 'chooseBoard', playerId: myId, faceUpCount, faceDownCount })}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>{t('game.revealBoard')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.ownFan}>
              {myHand.map((card, i) => (
                <View
                  key={`own-${view.round}-${i}`}
                  style={[
                    // Pin the fan stacking left→right so overlapped cards layer predictably.
                    { zIndex: i + 1, elevation: i + 1 },
                    { transform: [{ rotate: `${fanAngles[i] ?? 0}deg` }] },
                    i > 0 && styles.ownFanOverlap,
                  ]}
                >
                  <PlayingCard card={card} size="md" />
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.footer}>
        {toast && (
          <Animated.Text entering={FadeIn.duration(200)} style={[styles.toast, { color: LOSS_ON_DARK }]}>
            {toast}
          </Animated.Text>
        )}

        {phase === 'chooseBoard' && !isStarter && (
          <Text style={[styles.mutedText, styles.waitingText, { color: colors.onDarkTertiary }]}>
            {t('online.waitingBoard', { name: starter?.name })}
          </Text>
        )}

        {phase === 'bidding' &&
          (myTurn ? (
            <>
              {mustCatch && (
                <Text style={[styles.mutedText, styles.waitingText, { color: colors.onDarkTertiary }]}>
                  {t(view.config.jeuMax ? 'game.royalFlushHintJeuMax' : 'game.royalFlushHint')}
                </Text>
              )}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.loss }, !canCatch && styles.disabledBtn]}
                  onPress={handleCatch}
                  disabled={!canCatch}
                  activeOpacity={0.85}
                >
                  <Text style={styles.actionBtnText}>{t('game.liar')}</Text>
                </TouchableOpacity>
                {view.config.jeuMax && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: TABLE.gold }, !canCatch && styles.disabledBtn]}
                    onPress={handleJeuMax}
                    disabled={!canCatch}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryBtnText}>{t('game.jeuMax')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.accentBright }, mustCatch && styles.disabledBtn]}
                  onPress={() => setPickerOpen(true)}
                  disabled={mustCatch}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>{t('game.announce')}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={[styles.mutedText, styles.waitingText, { color: colors.onDarkTertiary }]}>
              {t('online.waitingTurn', { name: turnPlayer?.name })}
            </Text>
          ))}

        {inFlight && (
          <View style={styles.sending}>
            <ActivityIndicator size="small" color={colors.onDarkTertiary} />
            <Text style={[styles.mutedText, { color: colors.onDarkTertiary }]}>{t('games:online.sending')}</Text>
          </View>
        )}
        {(phase === 'reveal' || phase === 'roundEnd') && (
          <Text style={[styles.mutedText, styles.waitingText, { color: colors.onDarkTertiary }]}>
            {t('online.advancing')}
          </Text>
        )}

        {phase !== 'gameOver' && <TouchableOpacity onPress={abandon} disabled={inFlight}><Text style={[styles.mutedText, { color: colors.onDarkTertiary }]}>{t('online.forfeit')}</Text></TouchableOpacity>}
        {phase === 'gameOver' && (
          <GameOverActions
            finishLabel={t('games:online.quit')}
            replayLabel={t('games:game.replay')}
            waitingLabel={t('games:online.waitingHostReplay')}
            onFinish={quitHome}
            onReplay={() => router.replace('/games/bluff/create')}
          />
        )}
      </View>

      <ClaimPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentClaim={view.currentClaim}
        board={view.board}
        onSubmit={handleClaim}
      />
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
  // The table stays on screen while the socket is down — without this it looked perfectly
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
  roundBadge: {
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
  tableArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
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
  resultBanners: {
    gap: 2,
    alignItems: 'center',
  },
  resultBanner: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
    textAlign: 'center',
  },
  resultSub: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textAlign: 'center',
  },
  handZone: {
    marginHorizontal: spacing.base,
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: 88,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  boardChoice: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  ownFan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownFanOverlap: {
    marginLeft: -18,
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
});
