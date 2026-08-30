import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet, Dimensions, NativeSyntheticEvent, NativeTouchEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import Animated, { FadeIn, FadeInDown, FlipInEasyY, LayoutAnimationConfig, ZoomIn } from 'react-native-reanimated';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useKeepAwake } from 'expo-keep-awake';
import FrameVideoEncoder from '../../modules/frame-video-encoder';
import { X, Play, Pause, Download, SkipForward } from 'lucide-react-native';
import { PlayingCard } from '../../src/components/hand/PlayingCard';
import { TABLE, seatPoint } from '../../src/components/hand/PokerTable';
import { SeatedTable } from '../../src/components/table/SeatedTable';
import type { SeatSpec } from '../../src/components/table/SeatedTable';
import { PLAY_TABLE } from '../../src/components/table/tableSize';
import { WinCelebration } from '../../src/components/hand/WinCelebration';
import { GlowBlob } from '../../src/components/ui/GlowBlob';
import { ProgressBar } from '../../src/components/ui/ProgressBar';
import { useHandReplayerDraft } from '../../src/store/useHandReplayerDraft';
import { fontFamily, fontSize, radius, spacing } from '../../src/design-system/theme';
import { useTheme } from '../../src/design-system/ThemeProvider';
import { formatHandAmount, roundAmount } from '../../src/lib/format';
import { evaluateBestHandHoldem, type HandScore } from '../../src/lib/pokerHandEvaluator';
import { strengthColor, winningCardKeys } from '../../src/lib/handStrength';
import { estimateEquity, hashSeed, seededRng } from '../../src/lib/equity';
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
  holdMsFor,
  revealedActionsUpTo,
  totalContributed,
  type Beat,
} from '../../src/lib/handReplay';
import type { Card, HandAction, HandHistory, HandPlayer, Street } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AUTOPLAY_INTERVAL = 1800;
// A winner at or below this pre-river equity makes the river a staged bad-beat moment.
const BAD_BEAT_EQUITY_PCT = 30;

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
// Story format: 9:16 at 1080p, what Instagram/Snapchat expect.
const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
// The export runs every entering animation this many times slower while view-shot samples
// the live view (~10 captures/s); retiming each frame's PTS by the same factor plays the
// animations back at true speed — a ~10fps capture cadence becomes a ~30fps video.
const EXPORT_SLOWMO = 3;
// During a beat's static hold the last frame is just re-encoded at intervals (no capture,
// no decode) — some players choke on multi-second gaps between frames.
const HOLD_KEEPALIVE_MS = 500;
// Icon-button tile that works on the black background, same as the bluff screen's.
const DARK_TILE = 'rgba(255, 255, 255, 0.08)';

// Short action tag for the bubble that pops over a player's seat — standalone badge
// register (fr "Se couche"/"Relance", en "Folds"/"Raises"), distinct from poker:actions
// which reads inline after a player's name.
function bubbleLabel(a: HandAction, unitMode: HandHistory['unitMode'], t: TFunction<'replayer'>): string {
  const label = t(`actionBadges.${a.type}`);
  return a.amount && a.type !== 'fold' && a.type !== 'check' ? `${label} ${formatHandAmount(a.amount, unitMode)}` : label;
}

// Double-rAF fence: resolves once a state update's render is committed and at least one
// frame has been presented — only then is waiting out the entering animations meaningful.
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

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
  // grey out non-winning cards. Dimming only engages when every stored winner's hand is
  // computable (winners may be manual, with hidden cards) — otherwise nothing dims.
  const showdown = useMemo(() => {
    if (!hand) return null;
    const { flop, turn, river } = hand.board;
    const board = flop && turn && river ? [...flop, turn, river] : null;
    const scores = new Map<string, HandScore>();
    if (board) {
      for (const p of hand.players) {
        if (p.isFolded || !p.cardsKnown || !p.holeCards) continue;
        scores.set(p.id, evaluateBestHandHoldem(p.holeCards, board));
      }
    }
    const winnerScores = (hand.winnerIds ?? []).map((id) => scores.get(id));
    const winningKeys =
      winnerScores.length > 0 && winnerScores.every(Boolean)
        ? winningCardKeys(winnerScores as HandScore[])
        : null;
    return { scores, winningKeys };
  }, [hand]);
  const lastIndex = beats.length - 1;
  const [index, setIndex] = useState(() => (skip === '1' ? Math.max(0, lastIndex) : 0));
  const [exportState, setExportState] = useState<'idle' | 'exporting'>('idle');
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
  // All-in run-out detection: when the last betting beat happens before board cards are
  // still to come, everyone is all-in — from the next beat on, known cards are tabled like
  // a real all-in and the win-chance % runs live with each card. Null when the hand is
  // decided by betting (stats would only ever read 100/0 at showdown, so none are shown).
  const allInRevealIndex = useMemo(() => {
    if (!hand) return null;
    let lastActions = -1;
    beats.forEach((b, i) => {
      if (b.kind === 'street' && b.actions.length > 0) lastActions = i;
    });
    const runOut = beats.some((b, i) => i > lastActions && b.kind === 'street' && b.revealsCards);
    return runOut ? lastActions + 1 : null;
  }, [hand, beats]);
  // Cheap beat-derived key so the Monte-Carlo equity below only re-runs when its inputs
  // actually change (a new street or a fold), not on every tap.
  const equityKey = useMemo(() => {
    // Only simulated during an all-in run-out (and its showdown), from the LAGGED cursor —
    // so a beat's new card only moves the numbers once its flip has landed.
    if (!hand || allInRevealIndex === null || statsIndex < allInRevealIndex) return null;
    const upTo = beats.slice(0, statsIndex + 1);
    let boardLen = 0;
    upTo.forEach((b) => {
      if (b.kind === 'street' && b.revealsCards) boardLen += b.street === 'flop' ? 3 : 1;
    });
    const folded = upTo
      .filter((b): b is Extract<Beat, { kind: 'street' }> => b.kind === 'street')
      .flatMap((b) => b.actions)
      .filter((a) => a.type === 'fold')
      .map((a) => a.playerId)
      .sort();
    return `${boardLen}|${folded.join(',')}`;
  }, [hand, beats, statsIndex, allInRevealIndex]);
  // Live chance of winning the pot given the cards revealed so far — unknown villains are
  // dealt randomly in the simulation. Seeded per beat state, so revisiting a street shows
  // the same numbers instead of jittering.
  const equity = useMemo(() => {
    if (!hand || equityKey === null) return null;
    const [boardLenStr, foldedStr] = equityKey.split('|');
    const folded = new Set(foldedStr ? foldedStr.split(',') : []);
    const fullBoard: Card[] = [
      ...(hand.board.flop ?? []),
      ...(hand.board.turn ? [hand.board.turn] : []),
      ...(hand.board.river ? [hand.board.river] : []),
    ];
    const board = fullBoard.slice(0, Number(boardLenStr));
    const contenders = hand.players
      .filter((p) => !folded.has(p.id))
      .map((p) => ({ id: p.id, holeCards: p.cardsKnown && p.holeCards ? p.holeCards : null }));
    if (contenders.length < 2) return null;
    return estimateEquity(contenders, board, 'holdem', seededRng(hashSeed(`${hand.id}|${equityKey}`)));
  }, [hand, equityKey]);
  const [playing, setPlaying] = useState(false);
  const [exportPercent, setExportPercent] = useState(0);
  const [exportMessage, setExportMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const tableShotRef = useRef<View>(null);
  // Monotonic run id — bumping it aborts any in-flight export loop (cancel via X, unmount).
  const exportRunRef = useRef(0);
  const consumedExportRef = useRef(false);
  const runExportRef = useRef<() => void>(() => {});
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A staged bad-beat river: the pot went to a river showdown and the sole winner (with
  // known cards) was a heavy underdog when the river hit. Equity is computed on the turn
  // board with the same seeded Monte-Carlo as the live equity readout, so it's stable.
  const badBeat = useMemo(() => {
    if (!hand?.board.flop || !hand.board.turn || !hand.board.river) return null;
    const winnerIds = hand.winnerIds ?? [];
    if (winnerIds.length !== 1) return null;
    const winner = hand.players.find((p) => p.id === winnerIds[0]);
    if (!winner?.cardsKnown || !winner.holeCards) return null;
    const foldedBefore = new Set(
      hand.actions.filter((a) => a.type === 'fold' && a.street !== 'river').map((a) => a.playerId)
    );
    if (foldedBefore.has(winner.id)) return null;
    const contenders = hand.players
      .filter((p) => !foldedBefore.has(p.id))
      .map((p) => ({ id: p.id, holeCards: p.cardsKnown && p.holeCards ? p.holeCards : null }));
    if (contenders.length < 2) return null;
    const equities = estimateEquity(
      contenders,
      [...hand.board.flop, hand.board.turn],
      'holdem',
      seededRng(hashSeed(`${hand.id}|badbeat`))
    );
    const winnerEquity = equities.get(winner.id);
    if (winnerEquity === undefined || winnerEquity > BAD_BEAT_EQUITY_PCT) return null;
    return { name: winner.name, percent: Math.max(1, Math.round(winnerEquity)) };
  }, [hand]);
  const [badBeatVisible, setBadBeatVisible] = useState(false);
  // The hero taking the pot gets a staged celebration burst at showdown (see effect below).
  const heroWins = useMemo(
    () => !!hand && hand.players.some((p) => p.isHero && (hand.winnerIds ?? []).includes(p.id)),
    [hand]
  );
  const [winVisible, setWinVisible] = useState(false);

  const showMessage = (type: 'error' | 'success', text: string) => {
    setExportMessage({ type, text });
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setExportMessage(null), 2500);
  };

  // One tap records the WHOLE hand as a story-ready MP4: the loop walks every beat itself,
  // sampling the live view throughout each beat's (slowed) animations and streaming the
  // frames into the native encoder, which retimes them to true speed. The walk-through is
  // visible by necessity: view-shot photographs the live view, so a frame must actually be
  // on screen to be captured. Frames are cache tmpfiles released right after encoding —
  // only the finished video reaches the photo library.
  const runExport = async () => {
    if (exportState !== 'idle' || beats.length === 0) return;
    const run = ++exportRunRef.current;
    const cancelled = () => exportRunRef.current !== run;
    setExportState('exporting');
    setPlaying(false);
    setIndex(0);
    // Encoder calls are fired without awaiting — the native side serializes them — so the
    // capture loop keeps its cadence; the first error is kept and re-thrown after the walk.
    let encodeError: unknown = null;
    let chain: Promise<void> = Promise.resolve();
    // …but "without awaiting" has to stop somewhere: every unawaited append holds a
    // full-resolution JPEG in the cache and a decode buffer in flight, and a long hand puts
    // hundreds through. Beyond this many outstanding frames the loop waits for the encoder
    // to catch up before capturing another.
    const MAX_FRAMES_IN_FLIGHT = 8;
    let inFlight = 0;
    let framesAppended = 0;
    const appendFrame = (uri: string, ptsMs: number) => {
      inFlight++;
      chain = chain
        .then(() => FrameVideoEncoder.appendFrame(uri, ptsMs))
        .then(() => {
          framesAppended++;
        })
        .catch((e: unknown) => {
          encodeError = encodeError ?? e;
        })
        // Release only once the encoder is done with the file: dropping it from under a
        // decode still in progress is a prime suspect for the mid-export white screen.
        .finally(() => {
          inFlight--;
          releaseCapture(uri);
        });
    };
    const drainTo = async (limit: number) => {
      while (inFlight > limit && !encodeError && !cancelled()) await chain;
    };
    const repeatFrame = (ptsMs: number) => {
      chain = chain
        .then(() => FrameVideoEncoder.repeatLastFrame(ptsMs))
        .catch((e: unknown) => {
          encodeError = encodeError ?? e;
        });
    };
    // Progress is weighted by how long each beat actually takes to capture (its animation
    // window, stretched by the slow-motion factor) rather than by beat count — beats differ
    // by an order of magnitude, so a step counter jumps unevenly. The last slice is
    // reserved for muxing and saving, which happen after the walk.
    const CAPTURE_SHARE = 0.92;
    const beatWork = beats.map((b) => animWindowMsFor(b) * EXPORT_SLOWMO + 250);
    const totalWork = beatWork.reduce((sum, w) => sum + w, 0) || 1;
    let workDone = 0;
    let lastShown = -1;
    const reportProgress = (fraction: number) => {
      const pct = Math.round(fraction * 100);
      if (pct !== lastShown) {
        lastShown = pct;
        setExportPercent(fraction);
      }
    };

    try {
      await FrameVideoEncoder.createSession({ width: VIDEO_WIDTH, height: VIDEO_HEIGHT });
      let basePts = 0; // video-time cursor, ms
      for (let i = 0; i < beats.length; i++) {
        if (cancelled()) throw new Error('cancelled');
        const beat = beats[i];
        setIndex(i);
        await nextFrame();
        const capture = () => captureRef(tableShotRef, { format: 'jpg', quality: 0.9 });
        // Animated window: capture as fast as view-shot allows, stamping each frame with
        // its retimed PTS. Wall clock runs at EXPORT_SLOWMO×, the video at 1×.
        const windowMs = animWindowMsFor(beat);
        const start = Date.now();
        while (Date.now() - start < windowMs * EXPORT_SLOWMO) {
          await drainTo(MAX_FRAMES_IN_FLIGHT);
          if (cancelled()) throw new Error('cancelled');
          if (encodeError) throw encodeError;
          const tCapture = Date.now() - start;
          const uri = await capture();
          if (!uri) throw new Error('capture failed');
          appendFrame(uri, basePts + Math.round(tCapture / EXPORT_SLOWMO));
          reportProgress(((workDone + tCapture) / totalWork) * CAPTURE_SHARE);
        }
        // Settled frame at the window boundary, then the beat's dwell — pure PTS
        // bookkeeping, no wall time spent.
        const settledUri = await capture();
        if (!settledUri) throw new Error('capture failed');
        appendFrame(settledUri, basePts + windowMs);
        const holdMs = holdMsFor(beat);
        for (let tHold = HOLD_KEEPALIVE_MS; tHold < holdMs; tHold += HOLD_KEEPALIVE_MS) {
          repeatFrame(basePts + windowMs + tHold);
        }
        basePts += windowMs + holdMs;
        workDone += beatWork[i];
        reportProgress((workDone / totalWork) * CAPTURE_SHARE);
      }
      reportProgress(0.95); // frames are in; the encoder still has to mux and write
      await chain;
      if (encodeError) throw encodeError;
      if (cancelled()) throw new Error('cancelled');
      // Muxing a session that never took a frame produces a file no player will open.
      if (framesAppended === 0) throw new Error('no frames captured');
      const videoUri = await FrameVideoEncoder.finish(basePts);
      if (cancelled()) throw new Error('cancelled');
      reportProgress(1);
      showMessage('success', t('export.videoReady'));
      setExportState('idle');
      // Straight into the share sheet — publishing the story is the point of the export,
      // and the sheet's own "Save to Photos" is the save. Writing to the library here too
      // meant the video was already in Photos when the sheet offered to put it there.
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(videoUri, { mimeType: 'video/mp4', UTI: 'public.mpeg-4' });
      }
    } catch (e) {
      console.warn('[replayer] video export failed', {
        framesAppended,
        inFlight,
        beats: beats.length,
        error: e,
      });
      await FrameVideoEncoder.abort().catch(() => {});
      if (!cancelled()) showMessage('error', t('export.saveFailed'));
    } finally {
      if (!cancelled()) {
        setExportState('idle');
      }
    }
  };

  // Latest-ref pattern: the export-param effect below calls through this ref so it can
  // depend only on the param, not on every piece of state runExport closes over.
  useEffect(() => {
    runExportRef.current = runExport;
  });

  useEffect(() => {
    if (!playing) return;
    if (index >= lastIndex) {
      setPlaying(false);
      return;
    }
    // Autoplay gives every beat its full animation window plus breathing room — merged
    // street beats vary a lot in length now. The river keeps extra air for the bad-beat
    // burst, the showdown for the hero-win celebration.
    const beat = beats[index];
    const isRiverReveal = beat?.kind === 'street' && beat.street === 'river' && beat.revealsCards;
    const extra = isRiverReveal && badBeat ? 3400 : beat?.kind === 'showdown' && heroWins ? 3400 : 900;
    const interval = Math.max(AUTOPLAY_INTERVAL, (beat ? animWindowMsFor(beat) : 0) + extra);
    const timer = setTimeout(() => setIndex((i) => Math.min(i + 1, lastIndex)), interval);
    return () => clearTimeout(timer);
  }, [playing, index, lastIndex, beats, badBeat, heroWins]);

  useEffect(() => {
    // Stage the bad-beat burst once the slow river flip has landed. Suppressed while
    // exporting: captured frames must show the table, not the overlay.
    const beat = beats[index];
    const onRiverReveal = beat?.kind === 'street' && beat.street === 'river' && beat.revealsCards;
    if (!onRiverReveal || !badBeat || exportState === 'exporting') return;
    const timer = setTimeout(() => setBadBeatVisible(true), RIVER_FLIP_DELAY + RIVER_FLIP_DURATION + 200);
    return () => {
      clearTimeout(timer);
      setBadBeatVisible(false);
    };
  }, [beats, index, badBeat, exportState]);

  // The hero taking the pot deserves the same staged burst at showdown, once the villain
  // flips have landed. Suppressed while exporting, like the bad beat.
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
    if (skip === '1' && lastIndex >= 0) setIndex(lastIndex);
  }, [skip, lastIndex]);

  useEffect(() => {
    // Same screen-reuse caveat as `skip` above: the param flips '' -> '1' on every fresh
    // push even when the instance is reused. setParams + the consumed ref make each
    // navigation trigger exactly one export run.
    if (exportParam === '1' && !consumedExportRef.current && lastIndex >= 0) {
      consumedExportRef.current = true;
      router.setParams({ export: '' });
      runExportRef.current();
    }
  }, [exportParam, lastIndex, router]);

  useEffect(() => {
    if (exportParam !== '1') consumedExportRef.current = false;
  }, [exportParam]);

  useEffect(() => () => {
    exportRunRef.current++; // abort any in-flight export on unmount (Android back included)
    FrameVideoEncoder.abort().catch(() => {});
    if (messageTimer.current) clearTimeout(messageTimer.current);
  }, []);

  if (!hand) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <Text style={{ color: colors.onDarkPrimary }}>{t('noHand')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.primaryBtn, { backgroundColor: colors.accentBright, marginTop: spacing.base }]}>
          <Text style={styles.primaryBtnText}>{t('common:back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Everything the viewer has actually seen — the beats already walked, plus this beat's
  // actions up to the intra-beat cursor.
  const revealedActions = revealedActionsUpTo(beats, index, revealCount);

  const foldedIds = new Set(revealedActions.filter((a) => a.type === 'fold').map((a) => a.playerId));

  const streetRevealed = (street: Street) =>
    beats.slice(0, index + 1).some((b) => b.kind === 'street' && b.street === street && b.revealsCards);
  const isShowdown = beats[index]?.kind === 'showdown';
  const allInRevealed = allInRevealIndex !== null && index >= allInRevealIndex;
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
      tag: p.position,
      fan: revealed
        ? {
            cards: p.holeCards!.map((c) => ({ card: c, dimmed: dimCard(c) })),
            // Villain hands stay small on the rail: this table is narrower than the other
            // games' (smaller pods, board cards scaled to fit five across), and the hero's
            // hand growing large at showdown is meant to be the only big card moment.
            size: 'sm' as const,
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

  const renderCaption = () => {
    if (currentBeat?.kind === 'street') return t(`poker:phases.${currentBeat.street}`);
    if (currentBeat?.kind === 'showdown') return t('poker:phases.showdown');
    if (currentBeat?.kind === 'intro') return hand.title ?? t('handStarts');
    return '';
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: DARK_TILE }]}
          onPress={() => {
            exportRunRef.current++; // cancel a running export before leaving
            FrameVideoEncoder.abort().catch(() => {});
            router.back();
          }}
          activeOpacity={0.7}
        >
          <X size={18} color={colors.onDarkSecondary} strokeWidth={2} />
        </TouchableOpacity>
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
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: DARK_TILE }, exportState === 'exporting' && styles.disabledBtn]}
            disabled={exportState === 'exporting'}
            onPress={() => {
              setPlaying(false);
              setIndex(lastIndex);
            }}
            activeOpacity={0.7}
          >
            <SkipForward size={16} color={colors.onDarkSecondary} strokeWidth={2} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: DARK_TILE }, exportState === 'exporting' && styles.disabledBtn]}
          disabled={exportState === 'exporting'}
          onPress={() => setPlaying((p) => !p)}
          activeOpacity={0.7}
        >
          {playing ? <Pause size={16} color={colors.onDarkSecondary} strokeWidth={2} /> : <Play size={16} color={colors.onDarkSecondary} strokeWidth={2} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: DARK_TILE }, exportState !== 'idle' && styles.disabledBtn]}
          disabled={exportState !== 'idle'}
          onPress={runExport}
          activeOpacity={0.7}
          accessibilityLabel={t('exportReplay')}
        >
          <Download size={16} color={colors.onDarkSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

        <Pressable style={styles.tableArea} onPress={handleTap}>
          {/* Everything the per-step export captures lives inside this wrapper — with an
              explicit background because screens render transparent (the root layout paints
              the app background), which would otherwise yield transparent PNGs. The tap hint
              and progress label below are siblings on purpose: never in the captures. */}
          <View ref={tableShotRef} collapsable={false} style={styles.tableShot}>
            <LayoutAnimationConfig skipEntering={!entranceReady}>
            <Animated.Text key={`caption-${index}`} entering={FadeInDown.duration(ms(300))} style={styles.caption}>
              {renderCaption()}
            </Animated.Text>

            <SeatedTable
              width={TABLE_W}
              height={TABLE_H}
              style={styles.table}
              seatWidth={POD_W}
              seats={seatSpecs}
              center={
              <>
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
            {badBeatVisible && badBeat && (
              <WinCelebration
                width={TABLE_W}
                height={TABLE_H}
                title={t('badBeatOverlay.title')}
                subtitle={t('badBeatOverlay.subtitle', { name: badBeat.name, percent: badBeat.percent })}
                onDone={() => setBadBeatVisible(false)}
              />
            )}
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

          {/* Branding on every video frame — only while recording, invisible in normal
              playback. The recap card carries its own wordmark. */}
          {exportState === 'exporting' && (
            <Text style={[styles.wordmark, { color: colors.onDarkTertiary }]}>Ultimate Poker Kit</Text>
          )}
          </View>

          {exportState === 'exporting' ? (
            <View style={styles.exportProgress}>
              <ProgressBar value={exportPercent} label={t('export.generating')} onDark />
            </View>
          ) : exportMessage ? (
            <Text style={[styles.tapHint, { color: exportMessage.type === 'error' ? colors.loss : colors.accentBright }]}>
              {exportMessage.text}
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
  tableShot: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: spacing.base,
    backgroundColor: EXPORT_BG,
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
    left: TABLE_W / 2 - POD_W / 2 - 54,
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
  // Same treatment as HandRecapCard's wordmark, on the table frames during export.
  wordmark: {
    alignSelf: 'center',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: -spacing.lg,
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
