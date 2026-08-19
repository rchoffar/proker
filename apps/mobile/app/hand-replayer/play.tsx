import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet, Dimensions, NativeSyntheticEvent, NativeTouchEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import Animated, { FadeInDown, FlipInEasyY, ZoomIn } from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';
import type { ViewShotRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { X, Play, Pause, Share2, Download, SkipForward } from 'lucide-react-native';
import { PlayingCard } from '../../src/components/hand/PlayingCard';
import { PokerTable, TABLE, seatPoint } from '../../src/components/hand/PokerTable';
import { TableSeat } from '../../src/components/hand/TableSeat';
import { HandRecapCard } from '../../src/components/hand/HandRecapCard';
import { GlowBlob } from '../../src/components/ui/GlowBlob';
import { useHandReplayerDraft } from '../../src/store/useHandReplayerDraft';
import { fontFamily, fontSize, radius, spacing } from '../../src/design-system/theme';
import { useTheme } from '../../src/design-system/ThemeProvider';
import { formatHandAmount, roundAmount } from '../../src/lib/format';
import type { HandAction, HandHistory, HandPlayer, Street } from '../../src/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AUTOPLAY_INTERVAL = 1800;

const TABLE_W = SCREEN_WIDTH - 96;
const TABLE_H = Math.min(480, Math.max(350, Math.round(SCREEN_HEIGHT * 0.5)));
const POD_W = 74;

type Beat =
  | { kind: 'intro' }
  | { kind: 'heroCards' }
  | { kind: 'streetCards'; street: Street }
  | { kind: 'streetActions'; street: Street; actions: HandAction[] }
  | { kind: 'result' };

// Short action tag for the bubble that pops over a player's seat — standalone badge
// register (fr "Se couche"/"Relance", en "Folds"/"Raises"), distinct from poker:actions
// which reads inline after a player's name.
function bubbleLabel(a: HandAction, unitMode: HandHistory['unitMode'], t: TFunction<'replayer'>): string {
  const label = t(`actionBadges.${a.type}`);
  return a.amount && a.type !== 'fold' && a.type !== 'check' ? `${label} ${formatHandAmount(a.amount, unitMode)}` : label;
}

function buildBeats(hand: HandHistory): Beat[] {
  const beats: Beat[] = [{ kind: 'intro' }, { kind: 'heroCards' }];
  const streets: Street[] = ['preflop', 'flop', 'turn', 'river'];
  streets.forEach((street) => {
    if (street === 'flop' && hand.board.flop) beats.push({ kind: 'streetCards', street });
    if (street === 'turn' && hand.board.turn) beats.push({ kind: 'streetCards', street });
    if (street === 'river' && hand.board.river) beats.push({ kind: 'streetCards', street });
    const streetActions = hand.actions.filter((a) => a.street === street).sort((a, b) => a.order - b.order);
    if (streetActions.length > 0) beats.push({ kind: 'streetActions', street, actions: streetActions });
  });
  beats.push({ kind: 'result' });
  return beats;
}

export default function HandReplayerPlayScreen() {
  const { t } = useTranslation('replayer');
  const { colors } = useTheme();
  const router = useRouter();
  const { skip } = useLocalSearchParams<{ skip?: string }>();
  const hand = useHandReplayerDraft((s) => s.hand);
  const beats = useMemo(() => (hand ? buildBeats(hand) : []), [hand]);
  const lastIndex = beats.length - 1;
  const [index, setIndex] = useState(() => (skip === '1' ? Math.max(0, lastIndex) : 0));
  const [playing, setPlaying] = useState(false);
  const [cardSize, setCardSize] = useState<{ width: number; height: number } | null>(null);
  const [exportState, setExportState] = useState<'idle' | 'capturing'>('idle');
  const [exportMessage, setExportMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const viewShotRef = useRef<ViewShotRef>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!playing) return;
    if (index >= lastIndex) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setIndex((i) => Math.min(i + 1, lastIndex)), AUTOPLAY_INTERVAL);
    return () => clearTimeout(timer);
  }, [playing, index, lastIndex]);

  useEffect(() => {
    // Expo Router can reuse an already-mounted screen instance when re-navigating to the
    // same route with new params, so the lazy useState initializer above won't rerun —
    // this effect re-applies `skip` on every navigation, not just a genuinely fresh mount.
    if (skip === '1' && lastIndex >= 0) setIndex(lastIndex);
  }, [skip, lastIndex]);

  useEffect(() => () => {
    if (messageTimer.current) clearTimeout(messageTimer.current);
  }, []);

  if (!hand) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <Text style={{ color: colors.textPrimary }}>{t('noHand')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.primaryBtn, { backgroundColor: colors.accentBright, marginTop: spacing.base }]}>
          <Text style={styles.primaryBtnText}>{t('common:back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const foldedIds = new Set(
    beats
      .slice(0, index + 1)
      .filter((b): b is { kind: 'streetActions'; street: Street; actions: HandAction[] } => b.kind === 'streetActions')
      .flatMap((b) => b.actions)
      .filter((a) => a.type === 'fold')
      .map((a) => a.playerId)
  );

  const heroRevealed = index >= 1;
  const streetRevealed = (street: Street) => beats.slice(0, index + 1).some((b) => b.kind === 'streetCards' && b.street === street);
  const isResult = beats[index]?.kind === 'result';

  const hero = hand.players.find((p) => p.isHero);
  const winner = hand.winnerId ? hand.players.find((p) => p.id === hand.winnerId) : undefined;
  const currentBeat = beats[index];

  // Seats in table order, hero first (he anchors the bottom of the table).
  const sortedPlayers = [...hand.players].sort((a, b) => a.seat - b.seat);
  const heroIdx = sortedPlayers.findIndex((p) => p.isHero);
  const orderedPlayers: HandPlayer[] = heroIdx <= 0 ? sortedPlayers : [...sortedPlayers.slice(heroIdx), ...sortedPlayers.slice(0, heroIdx)];

  // Latest contribution per player per street, across the street beats revealed so far —
  // same "raise to" convention as the builder, so summing gives the live pot and per-player
  // committed totals as the replay advances.
  const revealedContribs: Record<string, Record<string, number>> = {};
  beats.slice(0, index + 1).forEach((b) => {
    if (b.kind !== 'streetActions') return;
    const perPlayer = revealedContribs[b.street] ?? {};
    b.actions.forEach((a) => {
      if (a.amount !== undefined) perPlayer[a.playerId] = a.amount;
    });
    revealedContribs[b.street] = perPlayer;
  });
  const potSoFar = roundAmount(
    Object.values(revealedContribs)
      .flatMap((perPlayer) => Object.values(perPlayer))
      .reduce((sum, v) => sum + v, 0)
  );
  const committedFor = (playerId: string) =>
    roundAmount(Object.values(revealedContribs).reduce((sum, perPlayer) => sum + (perPlayer[playerId] ?? 0), 0));

  // During a street beat, each player's latest action pops as a bubble on their seat,
  // staggered in true action order.
  const bubbles = new Map<string, { action: HandAction; orderIdx: number }>();
  if (currentBeat?.kind === 'streetActions') {
    currentBeat.actions.forEach((a, i) => bubbles.set(a.playerId, { action: a, orderIdx: i }));
  }

  const dealerId = hand.players.find((p) => p.position === 'BTN')?.id;
  const handStarted = index >= 1;

  const handleTap = (e: NativeSyntheticEvent<NativeTouchEvent>) => {
    setPlaying(false);
    const x = e.nativeEvent.locationX;
    if (x < SCREEN_WIDTH * 0.35) {
      setIndex((i) => Math.max(0, i - 1));
    } else {
      setIndex((i) => Math.min(lastIndex, i + 1));
    }
  };

  const showMessage = (type: 'error' | 'success', text: string) => {
    setExportMessage({ type, text });
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setExportMessage(null), 2500);
  };

  const captureAndShare = async () => {
    if (exportState === 'capturing') return;
    setExportState('capturing');
    try {
      // The native view has settled per onLayout, but the GPU-composited frame can still
      // lag a beat behind — a short wait here is the standard workaround for view-shot
      // otherwise snapshotting a stale/undersized frame on iOS.
      await new Promise((r) => setTimeout(r, 250));
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) throw new Error('capture failed');
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        showMessage('error', t('export.shareUnavailable'));
        return;
      }
      await Sharing.shareAsync(uri);
    } catch {
      showMessage('error', t('export.shareFailed'));
    } finally {
      setExportState('idle');
    }
  };

  const captureAndSave = async () => {
    if (exportState === 'capturing') return;
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        showMessage(
          'error',
          perm.canAskAgain === false ? t('export.permissionSettings') : t('export.permissionRequired')
        );
        return;
      }
      setExportState('capturing');
      await new Promise((r) => setTimeout(r, 250));
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) throw new Error('capture failed');
      await MediaLibrary.saveToLibraryAsync(uri);
      showMessage('success', t('export.imageSaved'));
    } catch {
      showMessage('error', t('export.saveFailed'));
    } finally {
      setExportState('idle');
    }
  };

  const renderCaption = () => {
    if (currentBeat?.kind === 'streetActions') return t(`poker:phases.${currentBeat.street}`);
    if (currentBeat?.kind === 'streetCards') return t(`poker:phases.${currentBeat.street}`);
    if (currentBeat?.kind === 'heroCards') return t('steps.myCards');
    if (currentBeat?.kind === 'intro') return hand.title ?? t('handStarts');
    return '';
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.neutralTileBg }]} onPress={() => router.back()} activeOpacity={0.7}>
          <X size={18} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.progressRow}>
          {beats.map((_, i) => (
            <TouchableOpacity
              key={i}
              style={styles.progressSegHit}
              activeOpacity={0.7}
              onPress={() => {
                setPlaying(false);
                setIndex(i);
              }}
            >
              <View style={[styles.progressSeg, { backgroundColor: i <= index ? colors.accent : colors.hairline }]} />
            </TouchableOpacity>
          ))}
        </View>
        {!isResult && (
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.neutralTileBg }]}
            onPress={() => {
              setPlaying(false);
              setIndex(lastIndex);
            }}
            activeOpacity={0.7}
          >
            <SkipForward size={16} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.neutralTileBg }]}
          onPress={() => setPlaying((p) => !p)}
          activeOpacity={0.7}
        >
          {playing ? <Pause size={16} color={colors.textSecondary} strokeWidth={2} /> : <Play size={16} color={colors.textSecondary} strokeWidth={2} />}
        </TouchableOpacity>
      </View>

      {isResult ? (
        <View style={styles.resultWrap}>
          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
            <HandRecapCard hand={hand} onReady={setCardSize} />
          </ViewShot>
          <View style={styles.resultActions}>
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.accentBright }, (!cardSize || exportState === 'capturing') && styles.disabledBtn]}
              onPress={captureAndShare}
              disabled={!cardSize || exportState === 'capturing'}
              activeOpacity={0.85}
            >
              <Share2 size={16} color="#0A0A0F" strokeWidth={2} />
              <Text style={styles.shareBtnText}>{t('share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.onDarkHairline }, (!cardSize || exportState === 'capturing') && styles.disabledBtn]}
              onPress={captureAndSave}
              disabled={!cardSize || exportState === 'capturing'}
              activeOpacity={0.85}
            >
              <Download size={16} color={colors.onDarkPrimary} strokeWidth={2} />
              <Text style={[styles.shareBtnText, { color: colors.onDarkPrimary }]}>{t('common:save')}</Text>
            </TouchableOpacity>
          </View>
          {exportMessage && (
            <Text style={[styles.exportMessage, { color: exportMessage.type === 'error' ? colors.loss : colors.accent }]}>
              {exportMessage.text}
            </Text>
          )}
        </View>
      ) : (
        <Pressable style={styles.tableArea} onPress={handleTap}>
          <Animated.Text key={`caption-${index}`} entering={FadeInDown.duration(300)} style={styles.caption}>
            {renderCaption()}
          </Animated.Text>

          <PokerTable width={TABLE_W} height={TABLE_H} style={styles.table}>
            <View style={styles.feltCenter} pointerEvents="none">
              {potSoFar > 0 && (
                <Animated.View key={`pot-${potSoFar}`} entering={ZoomIn.duration(250)} style={styles.potPill}>
                  <Text style={styles.potLabel}>{t('pot')}</Text>
                  <Text style={styles.potValue}>{formatHandAmount(potSoFar, hand.unitMode)}</Text>
                </Animated.View>
              )}
              <View style={styles.boardRow}>
                {hand.board.flop &&
                  streetRevealed('flop') &&
                  hand.board.flop.map((c, i) => (
                    <Animated.View key={`flop-${i}`} entering={FlipInEasyY.duration(450).delay(i * 100)}>
                      <PlayingCard card={c} size="md" />
                    </Animated.View>
                  ))}
                {hand.board.turn && streetRevealed('turn') && (
                  <Animated.View entering={FlipInEasyY.duration(450)}>
                    <PlayingCard card={hand.board.turn} size="md" />
                  </Animated.View>
                )}
                {hand.board.river && streetRevealed('river') && (
                  <Animated.View entering={FlipInEasyY.duration(450)}>
                    <PlayingCard card={hand.board.river} size="md" />
                  </Animated.View>
                )}
              </View>
            </View>

            {heroRevealed && hero?.holeCards && (
              <Animated.View entering={FlipInEasyY.duration(450)} style={styles.heroCards} pointerEvents="none">
                <PlayingCard card={hero.holeCards[0]} size="lg" style={styles.heroCardLeft} />
                <PlayingCard card={hero.holeCards[1]} size="lg" style={styles.heroCardRight} />
              </Animated.View>
            )}

            {orderedPlayers.map((p, k) => {
              const { x, y } = seatPoint(k, orderedPlayers.length, TABLE_W, TABLE_H);
              const folded = foldedIds.has(p.id);
              const bubble = bubbles.get(p.id);
              const bubbleBelow = y < TABLE_H / 2;
              const remaining =
                p.startingStack !== undefined ? Math.max(0, roundAmount(p.startingStack - committedFor(p.id))) : undefined;
              const isAggro = bubble ? ['bet', 'raise', 'allin'].includes(bubble.action.type) : false;
              // Dealer button sits between the pod and the felt center.
              const toCenter = { x: TABLE_W / 2 - x, y: TABLE_H / 2 - y };
              const dist = Math.hypot(toCenter.x, toCenter.y) || 1;
              return (
                <TableSeat
                  key={p.id}
                  x={x}
                  y={y}
                  width={POD_W}
                  name={p.name}
                  ringColor={p.isHero ? TABLE.gold : TABLE.neutralBorder}
                  ringWidth={p.isHero ? 2 : 1.5}
                  dimmed={folded}
                  tag={p.position}
                  secondLine={
                    folded
                      ? { text: t('folded'), color: colors.loss }
                      : remaining !== undefined
                        ? { text: formatHandAmount(remaining, hand.unitMode) }
                        : null
                  }
                >
                  {handStarted && !folded && !p.isHero && (
                    <View style={styles.holePeek}>
                      <PlayingCard faceDown size="sm" style={styles.peekCardLeft} />
                      <PlayingCard faceDown size="sm" style={styles.peekCardRight} />
                    </View>
                  )}
                  {dealerId === p.id && (
                    <View
                      style={[
                        styles.dealerBtn,
                        {
                          left: POD_W / 2 + (toCenter.x / dist) * 52 - 10,
                          top: 20 + (toCenter.y / dist) * 52 - 10,
                        },
                      ]}
                    >
                      <Text style={styles.dealerBtnText}>D</Text>
                    </View>
                  )}
                  {bubble && (
                    <Animated.View
                      key={bubble.action.id}
                      entering={ZoomIn.duration(220).delay(bubble.orderIdx * 200)}
                      style={[styles.bubble, bubbleBelow ? styles.bubbleBelow : styles.bubbleAbove]}
                    >
                      <View
                        style={[
                          styles.bubblePill,
                          {
                            borderColor:
                              bubble.action.type === 'fold' ? colors.loss : isAggro ? TABLE.goldDeep : TABLE.neutralBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.bubbleText,
                            { color: bubble.action.type === 'fold' ? colors.loss : isAggro ? TABLE.gold : TABLE.plateText },
                          ]}
                        >
                          {bubbleLabel(bubble.action, hand.unitMode, t)}
                        </Text>
                      </View>
                    </Animated.View>
                  )}
                </TableSeat>
              );
            })}
          </PokerTable>

          <Text style={[styles.tapHint, { color: colors.textTertiary }]}>{t('tapHint')}</Text>
        </Pressable>
      )}

      {isResult && (
        <View style={styles.resultBanner}>
          {winner && <GlowBlob color={colors.accentGlow} size={220} top={-60} right={-40} />}
          {winner ? (
            <Text style={[styles.resultWinner, { color: colors.accent }]}>{t('winsHand', { name: winner.name })}</Text>
          ) : (
            <Text style={[styles.resultWinner, { color: colors.textSecondary }]}>{t('handOver')}</Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  progressSegHit: {
    flex: 1,
    paddingVertical: 6,
  },
  progressSeg: {
    height: 3,
    borderRadius: 2,
  },
  tableArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  caption: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.display,
    textAlign: 'center',
    color: TABLE.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  table: {
    marginVertical: 42,
    alignSelf: 'center',
  },
  feltCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: 64,
  },
  potPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: TABLE.plateBg,
    borderWidth: 1,
    borderColor: TABLE.goldDeep,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  potLabel: {
    fontSize: 9,
    fontFamily: fontFamily.extrabold,
    letterSpacing: 1.5,
    color: 'rgba(231, 195, 111, 0.65)',
  },
  potValue: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
    color: TABLE.gold,
  },
  boardRow: {
    flexDirection: 'row',
    gap: 6,
    minHeight: 64,
    alignItems: 'center',
  },
  heroCards: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  heroCardLeft: {
    transform: [{ rotate: '-7deg' }],
  },
  heroCardRight: {
    transform: [{ rotate: '7deg' }],
    marginLeft: -16,
    marginTop: 4,
  },
  holePeek: {
    position: 'absolute',
    top: -14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  peekCardLeft: {
    transform: [{ rotate: '-10deg' }],
  },
  peekCardRight: {
    transform: [{ rotate: '10deg' }],
    marginLeft: -14,
    marginTop: 2,
  },
  dealerBtn: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F4EFE4',
    borderWidth: 1,
    borderColor: '#C9BFA8',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  dealerBtnText: {
    fontSize: 10,
    fontFamily: fontFamily.extrabold,
    color: '#1A150F',
  },
  bubble: {
    position: 'absolute',
    left: -44,
    right: -44,
    alignItems: 'center',
    zIndex: 4,
  },
  bubbleAbove: {
    top: -38,
  },
  bubbleBelow: {
    top: 74,
  },
  bubblePill: {
    backgroundColor: TABLE.plateBg,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  bubbleText: {
    fontSize: 10,
    fontFamily: fontFamily.bold,
  },
  tapHint: {
    position: 'absolute',
    bottom: spacing.lg,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
  },
  resultWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  resultActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  shareBtnText: {
    color: '#0A0A0F',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
  },
  disabledBtn: {
    opacity: 0.4,
  },
  exportMessage: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    textAlign: 'center',
  },
  resultBanner: {
    alignItems: 'center',
    paddingBottom: spacing.base,
    overflow: 'hidden',
  },
  resultWinner: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  primaryBtn: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  primaryBtnText: {
    color: '#0A0A0F',
    fontFamily: fontFamily.bold,
  },
});
