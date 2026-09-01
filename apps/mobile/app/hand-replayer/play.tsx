import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet, Dimensions, NativeSyntheticEvent, NativeTouchEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import Animated, { FadeIn, FadeInDown, FlipInEasyY, LayoutAnimationConfig, ZoomIn } from 'react-native-reanimated';
import { useKeepAwake } from 'expo-keep-awake';
import { Home, X, Play, Pause, Download, Share2, SkipForward } from 'lucide-react-native';
import { PlayingCard } from '../../src/components/hand/PlayingCard';
import { TABLE, seatPoint } from '../../src/components/hand/PokerTable';
import { SeatedTable } from '../../src/components/table/SeatedTable';
import type { SeatSpec } from '../../src/components/table/SeatedTable';
import { PLAY_TABLE } from '../../src/components/table/tableSize';
import { EXPORT_SLOWMO } from '../../src/lib/replayExport';
import { nextFrame } from '../../src/lib/nextFrame';
import { GameIconButton } from '../../src/components/games/GamePlayHeader';
import { useVideoExport } from '../../src/hooks/useVideoExport';
import { NoPlayersScreen } from '../../src/components/games/NoPlayersScreen';
import { TableWordmark } from '../../src/components/table/TableWordmark';
import { WinCelebration } from '../../src/components/hand/WinCelebration';
import { GlowBlob } from '../../src/components/ui/GlowBlob';
import { ProgressBar } from '../../src/components/ui/ProgressBar';
import { useHandReplayerDraft } from '../../src/store/useHandReplayerDraft';
import { fontFamily, fontSize, radius, spacing } from '../../src/design-system/theme';
import { useTheme } from '../../src/design-system/ThemeProvider';
import { formatHandAmount, roundAmount } from '../../src/lib/format';
import { strengthColor } from '../../src/lib/handStrength';
import { computeBlindPosting } from '../../src/lib/handPositions';
import { positionLabel } from '../../src/lib/handBuilder';
import {
  allInRevealIndex,
  equityCacheKey,
  equityForKey,
  evaluateShowdown,
} from '../../src/lib/handShowdown';
import { cardKey } from '../../src/types';
import {
  ACTION_STAGGER,
  RIVER_FLIP_DELAY,
  RIVER_FLIP_DURATION,
  animWindowMsFor,
  animatedActions,
  buildBeats,
  cardLeadMs,
  committedBy,
  contributionsFrom,
  revealedActionsUpTo,
  totalContributed,
} from '../../src/lib/handReplay';
import type { Card, HandAction, HandHistory, HandPlayer, Street } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AUTOPLAY_INTERVAL = 1800;

const TABLE_W = PLAY_TABLE.width;
const TABLE_H = PLAY_TABLE.height;
const POD_W = 74;
// Board cards deal left-aligned from the betting line; exact width so 5 always fit.
const BOARD_INSET = 40;
const BOARD_CARD_W = Math.min(46, Math.floor((TABLE_W - BOARD_INSET - 12 - 4 * 6) / 5));

// One background for the whole replay screen AND every exported video frame — table beats
// and the recap alike — so the app view and the encoder's letterbox read as one canvas.
// Plain black, theme-invariant (game surfaces are dark in both themes).
const EXPORT_BG = '#000000';
// Short action tag for the bubble that pops over a player's seat — standalone badge
// register (fr "Se couche"/"Relance", en "Folds"/"Raises"), distinct from poker:actions
// which reads inline after a player's name.
function bubbleLabel(a: HandAction, unitMode: HandHistory['unitMode'], t: TFunction<'replayer'>): string {
  const label = t(`actionBadges.${a.type}`);
  return a.amount && a.type !== 'fold' && a.type !== 'check' ? `${label} ${formatHandAmount(a.amount, unitMode)}` : label;
}


export default function HandReplayerPlayScreen() {
  // The video export auto-steps through the whole hand (~20-25s in slow motion) — the
  // screen must not lock mid-run.
  useKeepAwake();
  const { t } = useTranslation('replayer');
  const { colors } = useTheme();
  const router = useRouter();
  const { skip, export: exportParam } = useLocalSearchParams<{ skip?: string; export?: string }>();
  const hand = useHandReplayerDraft((s) => s.hand);
  const beats = useMemo(() => (hand ? buildBeats(hand) : []), [hand]);
  // Best-5 scores for every player with known cards, plus the winning-card set used to
  // grey out non-winning cards.
  const showdown = useMemo(() => (hand ? evaluateShowdown(hand) : null), [hand]);
  const lastIndex = beats.length - 1;
  const [index, setIndex] = useState(() => (skip === '1' ? Math.max(0, lastIndex) : 0));
  const tableShotRef = useRef<View>(null);
  const videoExport = useVideoExport({
    beats,
    shotRef: tableShotRef,
    seek: setIndex,
    stopPlayback: () => setPlaying(false),
    exportParam,
    onExportParamConsumed: () => router.setParams({ export: '' }),
  });
  const exportState = videoExport.state;
  // Slow-motion export: while exporting, every entering animation (and the stats lag below)
  // runs K× slower so the ~10 captures/s cadence samples enough frames; the encoder retimes
  // them back to true speed. Entering configs are evaluated at render, and each beat mounts
  // its animated views fresh, so scaling here reaches every animation per-beat.
  const K = exportState === 'exporting' ? EXPORT_SLOWMO : 1;
  const ms = (x: number) => x * K;
  // Run-out stats keep the previous beat's numbers while the new cards flip: statsIndex
  // trails the beat cursor, catching up only after the beat's animations (the river's
  // suspense flip included), and the equity below is computed from it. The delays stay
  // under animWindowMsFor's per-beat windows so settled frames include the refreshed stats.
  // A street is one tap, but its actions play out inside that beat one at a time — the pot,
  // the stacks and the bubbles all follow this cursor. Folding a whole street in at once was
  // why stacks emptied before the bet that emptied them, and why a check that a later bet
  // overwrote never appeared at all.
  //
  // Tagged with the beat it belongs to instead of being reset in an effect, so the render
  // where `index` moves already sees a cursor of 0.
  const [reveal, setReveal] = useState({ beat: -1, count: 0 });
  const revealCount = reveal.beat === index ? reveal.count : 0;
  useEffect(() => {
    const beat = beats[index];
    const total = animatedActions(beat).length;
    if (total === 0) return;
    const lead = beat ? cardLeadMs(beat) : 0;
    const timers = Array.from({ length: total }, (_, i) =>
      setTimeout(() => setReveal({ beat: index, count: i + 1 }), ms(lead + i * ACTION_STAGGER))
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ms is derived from K
  }, [index, beats, K]);

  const [statsIndex, setStatsIndex] = useState(-1);
  useEffect(() => {
    const beat = beats[index];
    const delay =
      beat?.kind === 'street' && beat.revealsCards
        ? beat.street === 'river'
          ? RIVER_FLIP_DELAY + RIVER_FLIP_DURATION + 200
          : 800
        : beat?.kind === 'showdown'
          ? 700
          : 300;
    const timer = setTimeout(() => setStatsIndex(index), delay * K);
    return () => clearTimeout(timer);
  }, [index, beats, K]);
  // Only simulated during an all-in run-out (and its showdown), from the LAGGED cursor —
  // so a beat's new card only moves the numbers once its flip has landed.
  const allInFrom = useMemo(() => (hand ? allInRevealIndex(beats) : null), [hand, beats]);
  const equityKey = useMemo(
    () => (hand ? equityCacheKey(beats, statsIndex, allInFrom) : null),
    [hand, beats, statsIndex, allInFrom]
  );
  const equity = useMemo(
    () => (hand && equityKey !== null ? equityForKey(hand, equityKey) : null),
    [hand, equityKey]
  );
  const [playing, setPlaying] = useState(false);
  // The hero taking the pot ALONE gets a staged celebration burst at showdown (see effect
  // below). A chop deliberately gets none: the overlay can only say "X wins the hand", and
  // saying that over a split pot is a lie — the banner under the table says "share the pot"
  // correctly, and that is the one that stays.
  const heroWins = useMemo(
    () =>
      !!hand &&
      (hand.winnerIds ?? []).length === 1 &&
      hand.players.some((p) => p.isHero && hand.winnerIds![0] === p.id),
    [hand]
  );
  const [winVisible, setWinVisible] = useState(false);

  // Autoplay stops at the last beat by DERIVING it rather than calling setPlaying(false)
  // from inside the effect below — that was a cascading render, and the play/pause icon
  // reads the same derived value, so it still flips to "play" when the replay ends.
  const isPlaying = playing && index < lastIndex;

  useEffect(() => {
    if (!isPlaying) return;
    // Autoplay gives every beat its full animation window plus breathing room — merged
    // street beats vary a lot in length now. The showdown keeps extra air for the hero-win
    // celebration.
    const beat = beats[index];
    const extra = beat?.kind === 'showdown' && heroWins ? 3400 : 900;
    const interval = Math.max(AUTOPLAY_INTERVAL, (beat ? animWindowMsFor(beat) : 0) + extra);
    const timer = setTimeout(() => setIndex((i) => Math.min(i + 1, lastIndex)), interval);
    return () => clearTimeout(timer);
  }, [isPlaying, index, lastIndex, beats, heroWins]);

  // The hero taking the pot gets a staged burst at showdown, once the villain flips have
  // landed. Suppressed while exporting: captured frames must show the table, not an overlay.
  useEffect(() => {
    if (beats[index]?.kind !== 'showdown' || !heroWins || exportState === 'exporting') return;
    const timer = setTimeout(() => setWinVisible(true), 1300);
    return () => {
      clearTimeout(timer);
      setWinVisible(false);
    };
  }, [beats, index, heroWins, exportState]);

  // Reanimated can drop entering animations scheduled on the screen's very first frame
  // (mid push-transition), leaving seats/tags frozen at their entering state until the
  // next re-render — the "half-painted table until you tap" bug. Skip entering animations
  // entirely until one frame has been presented: the intro paints instantly and complete,
  // every later beat animates normally.
  const [entranceReady, setEntranceReady] = useState(false);
  useEffect(() => {
    let live = true;
    void nextFrame().then(() => {
      if (live) setEntranceReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    // Expo Router can reuse an already-mounted screen instance when re-navigating to the
    // same route with new params, so the lazy useState initializer above won't rerun —
    // this effect re-applies `skip` on every navigation, not just a genuinely fresh mount.
    // Syncing from an external system (the router's params) is what effects are for; there
    // is no render-time derivation here, because the cursor must stay freely steppable
    // afterwards.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (skip === '1' && lastIndex >= 0) setIndex(lastIndex);
  }, [skip, lastIndex]);

  if (!hand) {
    return <NoPlayersScreen message={t('noHand')} onBack={() => router.back()} onDark />;
  }

  // Everything the viewer has actually seen — the beats already walked, plus this beat's
  // actions up to the intra-beat cursor.
  const revealedActions = revealedActionsUpTo(beats, index, revealCount);

  const foldedIds = new Set(revealedActions.filter((a) => a.type === 'fold').map((a) => a.playerId));

  const streetRevealed = (street: Street) =>
    beats.slice(0, index + 1).some((b) => b.kind === 'street' && b.street === street && b.revealsCards);
  const isShowdown = beats[index]?.kind === 'showdown';
  const allInRevealed = allInFrom !== null && index >= allInFrom;
  const dimCard = (c: Card) => isShowdown && !!showdown?.winningKeys && !showdown.winningKeys.has(cardKey(c));

  const hero = hand.players.find((p) => p.isHero);
  const winners = hand.winnerIds?.length ? hand.players.filter((p) => hand.winnerIds!.includes(p.id)) : [];
  const currentBeat = beats[index];

  // Seats in table order, hero first (he anchors the bottom of the table).
  const sortedPlayers = [...hand.players].sort((a, b) => a.seat - b.seat);
  const heroIdx = sortedPlayers.findIndex((p) => p.isHero);
  const orderedPlayers: HandPlayer[] = heroIdx <= 0 ? sortedPlayers : [...sortedPlayers.slice(heroIdx), ...sortedPlayers.slice(0, heroIdx)];

  // Latest contribution per player per street, over the actions revealed so far — same
  // "raise to" convention as the builder (an amount is a total, not an increment), so
  // summing gives the live pot and per-player committed totals as the replay advances.
  const revealedContribs = contributionsFrom(revealedActions);
  // Dead money (absent SB/BB blinds + the global ante) is on the felt as soon as preflop
  // opens, like the posts beside it — not held back until someone with a stack acts.
  const preflopReached = beats.slice(0, index + 1).some((b) => b.kind === 'street' && b.street === 'preflop');
  const deadMoneySoFar = preflopReached ? roundAmount((hand.deadBlinds ?? 0) + (hand.ante ?? 0)) : 0;
  const potSoFar = roundAmount(totalContributed(revealedContribs) + deadMoneySoFar);
  const committedFor = (playerId: string) => roundAmount(committedBy(revealedContribs, playerId));

  // Money in front of a player: what they have put in ON THE CURRENT STREET, which is what a
  // real table shows and what makes a replay readable — the blinds preflop, then the raise
  // that answered them, then each street's betting in turn. The blinds were already in the
  // pot and already off the stacks, they just had nothing of their own on the felt.
  //
  // The intro beat carries no actions at all, and that is precisely the frame Mathieu was
  // looking at when he asked for this, so the posts are read straight off the hand there.
  // At showdown the chips have been pushed to the middle, so nothing is out front.
  const blindPosts = hand.actions.filter((a) => a.street === 'preflop' && a.type === 'post');
  const betFor = (playerId: string): number | undefined => {
    if (currentBeat?.kind === 'intro') return blindPosts.find((a) => a.playerId === playerId)?.amount;
    if (currentBeat?.kind !== 'street') return undefined;
    return revealedContribs[currentBeat.street]?.[playerId];
  };

  // Each seat shows its latest REVEALED action, so a player who checks and then bets shows
  // the check first and the bet in its place — the cursor, not an animation delay, decides
  // when. Keyed by action id below so the swap re-pops the bubble.
  const bubbles = new Map<string, HandAction>();
  animatedActions(currentBeat)
    .slice(0, revealCount)
    .forEach((a) => bubbles.set(a.playerId, a));

  const handleTap = (e: NativeSyntheticEvent<NativeTouchEvent>) => {
    if (exportState === 'exporting') return; // the export loop owns the cursor
    setPlaying(false);
    const x = e.nativeEvent.locationX;
    if (x < SCREEN_WIDTH * 0.35) {
      setIndex((i) => Math.max(0, i - 1));
    } else {
      setIndex((i) => Math.min(lastIndex, i + 1));
    }
  };

  // In heads-up the button IS the small blind, and the badge says so rather than just
  // "BTN". Both facts come from the shared rule, not from a second copy of it: the copy
  // that used to live here dropped computeBlindPosting's `has('BB')` check, so a BTN+CO
  // pair was tagged BTN/SB on the felt while the engine posted the small blind as dead
  // money. Blind VALUES are irrelevant to the tag — only deadBlinds needs them, and the
  // felt reads that off the stored hand.
  const posting = computeBlindPosting(hand.players, 0, 0, hand.headsUp);
  const seatTag = (p: HandPlayer) => positionLabel(p, posting);

  // Seats for the shared table: villains reveal their hands as fans toward the felt (at
  // showdown or once everyone is all-in), each seat carrying its action bubble and either
  // its stack, its fold status, or its live win chance.
  const seatSpecs: SeatSpec[] = orderedPlayers.map((p, k) => {
    const folded = foldedIds.has(p.id);
    const bubble = bubbles.get(p.id);
    const bubbleBelow = seatPoint(k, orderedPlayers.length, TABLE_W, TABLE_H).y < TABLE_H / 2;
    const remaining =
      p.startingStack !== undefined ? Math.max(0, roundAmount(p.startingStack - committedFor(p.id))) : undefined;
    const knownCards = p.cardsKnown && !!p.holeCards;
    // Win-chance % only during an all-in run-out, where each card shifts it — a hand
    // decided by betting would only ever read 100/0, so it shows nothing. The value comes
    // from the lagged statsIndex: the previous beat's number stays up while cards flip.
    const statsActive = allInRevealed && knownCards;
    const equityPct = statsActive ? equity?.get(p.id) : undefined;
    const isAggro = bubble ? ['bet', 'raise', 'allin'].includes(bubble.type) : false;
    const revealed = !p.isHero && !folded && (isShowdown || allInRevealed) && p.cardsKnown && p.holeCards;

    return {
      id: p.id,
      name: p.name,
      entering: FadeIn.duration(ms(300)),
      ringColor: p.isHero ? TABLE.gold : TABLE.neutralBorder,
      ringWidth: p.isHero ? 2 : 1.5,
      dimmed: folded,
      tag: seatTag(p),
      bet: (() => {
        const amount = betFor(p.id);
        return amount ? formatHandAmount(amount, hand.unitMode) : undefined;
      })(),
      fan: revealed
        ? {
            cards: p.holeCards!.map((c) => ({ card: c, dimmed: dimCard(c) })),
            // No explicit size: SeatedTable falls back to fanSizeFor(cards, seats), which is
            // md up to four seats and sm from five — "big cards for the 2/3-player reveal,
            // small ones once the table is busy", which is exactly what Mathieu asked for.
            // Pinning sm here made the villain's reveal tiny even heads-up, where there is
            // all the room in the world for it.
            flipInDelay: ms(k * 120),
            flipInDuration: ms(450),
          }
        : undefined,
      secondLine: folded
        ? { text: t('folded'), color: colors.loss }
        : statsActive
          ? equityPct !== undefined
            ? {
                text: t('poker:strengthPercent', { value: equityPct }),
                color: strengthColor(equityPct),
                entering: ZoomIn.duration(ms(250)).delay(ms(k * 120)),
              }
            : null
          : remaining !== undefined
            ? { text: formatHandAmount(remaining, hand.unitMode) }
            : null,
      extras: bubble ? (
        <Animated.View
          key={bubble.id}
          entering={ZoomIn.duration(ms(220))}
          style={[styles.bubble, bubbleBelow ? styles.bubbleBelow : styles.bubbleAbove]}
        >
          <View
            style={[
              styles.bubblePill,
              {
                borderColor:
                  bubble.type === 'fold' ? colors.loss : isAggro ? TABLE.goldDeep : TABLE.neutralBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                { color: bubble.type === 'fold' ? colors.loss : isAggro ? TABLE.gold : TABLE.plateText },
              ]}
            >
              {bubbleLabel(bubble, hand.unitMode, t)}
            </Text>
          </View>
        </Animated.View>
      ) : undefined,
    };
  });

  // The hand's title stays above the table from the first frame to the last; only the street
  // label below it changes, and that one lives on the felt.
  const streetLabel =
    currentBeat?.kind === 'street'
      ? t(`poker:phases.${currentBeat.street}`)
      : currentBeat?.kind === 'showdown'
        ? t('poker:phases.showdown')
        : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <GameIconButton
          onDark
          onPress={() => {
            videoExport.cancel(); // stop a running export before leaving
            router.back();
          }}
        >
          <X size={18} color={colors.onDarkSecondary} strokeWidth={2} />
        </GameIconButton>
        {/* ❌ goes back where you came from — the builder or the hands list — and HOME goes
            home. Reaching a hand costs several screens, so getting out of one should not. */}
        <GameIconButton
          onDark
          onPress={() => {
            videoExport.cancel();
            router.dismissTo('/');
          }}
          accessibilityLabel={t('games:play.goHome')}
        >
          <Home size={17} color={colors.onDarkSecondary} strokeWidth={2} />
        </GameIconButton>
        <View style={styles.progressRow}>
          {beats.map((_, i) => (
            <TouchableOpacity
              key={i}
              style={styles.progressSegHit}
              activeOpacity={0.7}
              disabled={exportState === 'exporting'}
              onPress={() => {
                setPlaying(false);
                setIndex(i);
              }}
            >
              <View style={[styles.progressSeg, { backgroundColor: i <= index ? colors.accentBright : colors.onDarkHairline }]} />
            </TouchableOpacity>
          ))}
        </View>
        {index < lastIndex && (
          <GameIconButton
            onDark
            disabled={exportState === 'exporting'}
            onPress={() => {
              setPlaying(false);
              setIndex(lastIndex);
            }}
          >
            <SkipForward size={16} color={colors.onDarkSecondary} strokeWidth={2} />
          </GameIconButton>
        )}
        <GameIconButton onDark disabled={exportState === 'exporting'} onPress={() => setPlaying(!isPlaying)}>
          {isPlaying ? <Pause size={16} color={colors.onDarkSecondary} strokeWidth={2} /> : <Play size={16} color={colors.onDarkSecondary} strokeWidth={2} />}
        </GameIconButton>
        <GameIconButton
          onDark
          disabled={exportState !== 'idle'}
          onPress={videoExport.run}
          accessibilityLabel={t('exportReplay')}
        >
          <Download size={16} color={colors.onDarkSecondary} strokeWidth={2} />
        </GameIconButton>
        {videoExport.videoUri && (
          <GameIconButton
            onDark
            disabled={exportState !== 'idle'}
            onPress={() => videoExport.openShareSheet(videoExport.videoUri!)}
            accessibilityLabel={t('export.share')}
          >
            <Share2 size={16} color={colors.accentBright} strokeWidth={2} />
          </GameIconButton>
        )}
      </View>

        <Pressable style={styles.tableArea} onPress={handleTap}>
          {/* Everything the per-step export captures lives inside this wrapper — with an
              explicit background because screens render transparent (the root layout paints
              the app background), which would otherwise yield transparent PNGs. The tap hint
              and progress label below are siblings on purpose: never in the captures. */}
          <View ref={tableShotRef} collapsable={false} style={styles.tableShot}>
            <LayoutAnimationConfig skipEntering={!entranceReady}>
            <Text style={styles.caption} numberOfLines={1}>
              {hand.title ?? t('handStarts')}
            </Text>

            <SeatedTable
              width={TABLE_W}
              height={TABLE_H}
              style={styles.table}
              seatWidth={POD_W}
              seats={seatSpecs}
              center={
              <>
              {streetLabel && (
                <Animated.Text
                  key={`street-${index}`}
                  entering={FadeInDown.duration(ms(300))}
                  style={styles.streetLabel}
                >
                  {streetLabel}
                </Animated.Text>
              )}
              {potSoFar > 0 && (
                <Animated.View key={`pot-${potSoFar}`} entering={ZoomIn.duration(ms(250))} style={styles.potPill}>
                  <Text style={styles.potLabel}>{t('pot')}</Text>
                  <Text style={styles.potValue}>{formatHandAmount(potSoFar, hand.unitMode)}</Text>
                </Animated.View>
              )}
              <View style={styles.boardRow}>
                {hand.board.flop &&
                  streetRevealed('flop') &&
                  hand.board.flop.map((c, i) => (
                    <Animated.View key={`flop-${i}`} entering={FlipInEasyY.duration(ms(450)).delay(ms(i * 100))}>
                      <PlayingCard card={c} width={BOARD_CARD_W} dimmed={dimCard(c)} />
                    </Animated.View>
                  ))}
                {hand.board.turn && streetRevealed('turn') && (
                  <Animated.View entering={FlipInEasyY.duration(ms(450))}>
                    <PlayingCard card={hand.board.turn} width={BOARD_CARD_W} dimmed={dimCard(hand.board.turn)} />
                  </Animated.View>
                )}
                {hand.board.river && streetRevealed('river') && (
                  <Animated.View entering={FlipInEasyY.duration(ms(RIVER_FLIP_DURATION)).delay(ms(RIVER_FLIP_DELAY))}>
                    <PlayingCard card={hand.board.river} width={BOARD_CARD_W} dimmed={dimCard(hand.board.river)} />
                  </Animated.View>
                )}
              </View>
              <TableWordmark />
              </>
              }
              underSeats={
              <>
            {/* Hero cards live small next to the hero's seat for the whole hand (visible from
                the intro — no dedicated tap), then pop large and centered at showdown. Two
                rendered states, not a shared transition: the export loop only understands
                entering animations. */}
            {hero?.holeCards &&
              (isShowdown ? (
                <Animated.View key="hero-lg" entering={ZoomIn.duration(ms(300))} style={styles.heroCards} pointerEvents="none">
                  <PlayingCard card={hero.holeCards[0]} size="lg" dimmed={dimCard(hero.holeCards[0])} style={styles.heroCardLeft} />
                  <PlayingCard card={hero.holeCards[1]} size="lg" dimmed={dimCard(hero.holeCards[1])} style={styles.heroCardRight} />
                </Animated.View>
              ) : (
                <Animated.View key="hero-sm" entering={FlipInEasyY.duration(ms(450))} style={styles.heroCardsSide} pointerEvents="none">
                  <PlayingCard card={hero.holeCards[0]} size="sm" style={styles.heroCardLeft} />
                  <PlayingCard card={hero.holeCards[1]} size="sm" style={styles.heroCardRight} />
                </Animated.View>
              ))}
              </>
              }
            >
            {winVisible && hero && (
              <WinCelebration
                width={TABLE_W}
                height={TABLE_H}
                title={t('winOverlay.title')}
                subtitle={t('winsHand', { name: hero.name })}
                onDone={() => setWinVisible(false)}
              />
            )}
          </SeatedTable>
          </LayoutAnimationConfig>

          </View>

          {exportState === 'exporting' ? (
            <View style={styles.exportProgress}>
              <ProgressBar value={videoExport.percent} label={t('export.generating')} onDark />
            </View>
          ) : videoExport.message ? (
            <Text style={[styles.tapHint, { color: videoExport.message.type === 'error' ? colors.loss : colors.accentBright }]}>
              {videoExport.message.text}
            </Text>
          ) : (
            <Text style={[styles.tapHint, { color: colors.onDarkTertiary }]}>{t('tapHint')}</Text>
          )}
        </Pressable>

      {isShowdown && (
        <View style={styles.resultBanner}>
          {winners.length > 0 && <GlowBlob color={colors.accentGlow} size={220} top={-60} right={-40} />}
          {winners.length > 1 ? (
            <Text style={[styles.resultWinner, { color: colors.accentBright }]}>
              {t('splitWins', { names: winners.map((w) => w.name).join(', ') })}
            </Text>
          ) : winners.length === 1 ? (
            <Text style={[styles.resultWinner, { color: colors.accentBright }]}>{t('winsHand', { name: winners[0].name })}</Text>
          ) : (
            <Text style={[styles.resultWinner, { color: colors.onDarkSecondary }]}>{t('handOver')}</Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: EXPORT_BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
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
  tableShot: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: spacing.base,
    backgroundColor: EXPORT_BG,
  },
  // The hand's title, at the top of the capture. It speaks the felt's own typeface — the
  // same display face as the street label right under it — instead of the UI's semibold,
  // which read as a screenshot caption rather than part of the table. Bigger, and with air
  // under it: at 16pt with no margin it sat almost on top of the first seat pod.
  caption: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.display,
    textAlign: 'center',
    color: TABLE.plateText,
    letterSpacing: 1,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  streetLabel: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.display,
    textAlign: 'center',
    color: TABLE.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  table: {
    marginVertical: 42,
    alignSelf: 'center',
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
    marginBottom: spacing.md,
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
  // Deal left-aligned from the betting line — the flop lands left, turn and river extend
  // rightward, like on a real table.
  boardRow: {
    flexDirection: 'row',
    gap: 6,
    minHeight: 64,
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
    paddingLeft: BOARD_INSET,
  },
  // Showdown state: the hero hand pops large and centered.
  heroCards: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  // In-hand state: small fan parked left of the hero pod (hero is seat 0, bottom center).
  heroCardsSide: {
    position: 'absolute',
    bottom: 14,
    left: TABLE_W / 2 - POD_W / 2 - 36,
    flexDirection: 'row',
  },
  heroCardLeft: {
    transform: [{ rotate: '-7deg' }],
  },
  heroCardRight: {
    transform: [{ rotate: '7deg' }],
    marginLeft: -16,
    marginTop: 4,
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
  exportProgress: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.xl,
    right: spacing.xl,
  },
  tapHint: {
    position: 'absolute',
    bottom: spacing.lg,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
  },
  disabledBtn: {
    opacity: 0.4,
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
