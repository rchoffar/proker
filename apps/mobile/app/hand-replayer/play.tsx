import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet, Dimensions, NativeSyntheticEvent, NativeTouchEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import Animated, { FadeIn, FadeInDown, FlipInEasyY, ZoomIn } from 'react-native-reanimated';
import ViewShot, { captureRef, releaseCapture } from 'react-native-view-shot';
import type { ViewShotRef } from 'react-native-view-shot';
// The function-style API moved to /legacy in SDK 56 — importing it from the package root
// logs a deprecation warning on every call (the export loop makes many).
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import { useKeepAwake } from 'expo-keep-awake';
import FrameVideoEncoder from '../../modules/frame-video-encoder';
import { X, Play, Pause, Download, SkipForward } from 'lucide-react-native';
import { PlayingCard } from '../../src/components/hand/PlayingCard';
import { PokerTable, TABLE, seatPoint } from '../../src/components/hand/PokerTable';
import { TableSeat } from '../../src/components/hand/TableSeat';
import { HandRecapCard } from '../../src/components/hand/HandRecapCard';
import { WinCelebration } from '../../src/components/hand/WinCelebration';
import { GlowBlob } from '../../src/components/ui/GlowBlob';
import { useHandReplayerDraft } from '../../src/store/useHandReplayerDraft';
import { fontFamily, fontSize, radius, spacing } from '../../src/design-system/theme';
import { useTheme } from '../../src/design-system/ThemeProvider';
import { formatHandAmount, roundAmount } from '../../src/lib/format';
import { evaluateBestHandHoldem, type HandScore } from '../../src/lib/pokerHandEvaluator';
import { strengthColor, winningCardKeys } from '../../src/lib/handStrength';
import { estimateEquity, hashSeed, seededRng } from '../../src/lib/equity';
import { cardKey } from '../../src/types';
import type { Card, HandAction, HandHistory, HandPlayer, Street } from '../../src/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AUTOPLAY_INTERVAL = 1800;
// The river is the money card — it flips in slow, after a suspense pause.
const RIVER_FLIP_DELAY = 400;
const RIVER_FLIP_DURATION = 1000;
// A winner at or below this pre-river equity makes the river a staged bad-beat moment.
const BAD_BEAT_EQUITY_PCT = 30;

const TABLE_W = SCREEN_WIDTH - 96;
const TABLE_H = Math.min(480, Math.max(350, Math.round(SCREEN_HEIGHT * 0.5)));
const POD_W = 74;

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

type Beat =
  | { kind: 'intro' }
  | { kind: 'heroCards' }
  | { kind: 'streetCards'; street: Street }
  | { kind: 'streetActions'; street: Street; actions: HandAction[] }
  | { kind: 'showdown' }
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
  // A showdown moment on the table (villain reveal + winning-hand highlight) only when
  // there is something to show — a full run-out or at least one known villain hand;
  // pure fold-outs go straight to the recap.
  const hasShowdown =
    !!hand.board.river || hand.players.some((p) => !p.isHero && !p.isFolded && p.cardsKnown && !!p.holeCards);
  if (hasShowdown) beats.push({ kind: 'showdown' });
  beats.push({ kind: 'result' });
  return beats;
}

// Double-rAF fence: resolves once a state update's render is committed and at least one
// frame has been presented — only then is waiting out the entering animations meaningful.
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// How long a beat's entering animations run, in 1×-speed video time: card flips run 450ms
// (flop staggers +100ms/card, the river flips slow per the constants above), action bubbles
// ZoomIn 220ms staggered 200ms apart. Windows also cover the lagged stats refresh below
// (delay + a render), so the settling frames include the updated numbers. The export
// captures continuously for the whole window (times EXPORT_SLOWMO on the wall clock).
function animWindowMsFor(beat: Beat): number {
  if (beat.kind === 'streetActions') return Math.max((beat.actions.length - 1) * 200 + 220, 300) + 100;
  if (beat.kind === 'streetCards') return beat.street === 'river' ? RIVER_FLIP_DELAY + RIVER_FLIP_DURATION + 400 : 1000;
  // Villain reveals stagger flips per seat (k*120 + i*80 + 450) — cover a full 9-max table.
  if (beat.kind === 'showdown') return 1800;
  // The recap card is static — it gets a single settled frame (after a layout wait).
  if (beat.kind === 'result') return 0;
  return 500;
}

// How long the settled frame then dwells on screen, in video time — mirrors the autoplay
// pacing (AUTOPLAY_INTERVAL minus the animation part; the river and the closing recap
// breathe longer). Holds cost no wall time: they are pure PTS bookkeeping.
function holdMsFor(beat: Beat): number {
  if (beat.kind === 'result') return 2800;
  if (beat.kind === 'streetCards' && beat.street === 'river') return 1600;
  if (beat.kind === 'showdown') return 1500;
  return 900;
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
  const [statsIndex, setStatsIndex] = useState(-1);
  useEffect(() => {
    const beat = beats[index];
    const delay =
      beat?.kind === 'streetCards'
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
      if (b.kind === 'streetActions') lastActions = i;
    });
    const runOut = beats.some((b, i) => i > lastActions && b.kind === 'streetCards');
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
      if (b.kind === 'streetCards') boardLen += b.street === 'flop' ? 3 : 1;
    });
    const folded = upTo
      .filter((b): b is Extract<Beat, { kind: 'streetActions' }> => b.kind === 'streetActions')
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
  const [cardSize, setCardSize] = useState<{ width: number; height: number } | null>(null);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [exportMessage, setExportMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const viewShotRef = useRef<ViewShotRef>(null);
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
    // Write-only grant is enough for saveToLibraryAsync and triggers the lighter
    // "Add Photos Only" prompt on iOS.
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (!perm.granted) {
      showMessage('error', perm.canAskAgain === false ? t('export.permissionSettings') : t('export.permissionRequired'));
      return;
    }
    const run = ++exportRunRef.current;
    const cancelled = () => exportRunRef.current !== run;
    setExportState('exporting');
    setPlaying(false);
    setIndex(0);
    // Encoder calls are fired without awaiting — the native side serializes them — so the
    // capture loop keeps its cadence; the first error is kept and re-thrown after the walk.
    let encodeError: unknown = null;
    let chain: Promise<void> = Promise.resolve();
    const appendFrame = (uri: string, ptsMs: number) => {
      chain = chain
        .then(() => FrameVideoEncoder.appendFrame(uri, ptsMs))
        .catch((e: unknown) => {
          encodeError = encodeError ?? e;
        })
        .finally(() => releaseCapture(uri));
    };
    const repeatFrame = (ptsMs: number) => {
      chain = chain
        .then(() => FrameVideoEncoder.repeatLastFrame(ptsMs))
        .catch((e: unknown) => {
          encodeError = encodeError ?? e;
        });
    };
    try {
      await FrameVideoEncoder.createSession({ width: VIDEO_WIDTH, height: VIDEO_HEIGHT });
      let basePts = 0; // video-time cursor, ms
      for (let i = 0; i < beats.length; i++) {
        if (cancelled()) throw new Error('cancelled');
        const beat = beats[i];
        setExportProgress({ current: i + 1, total: beats.length });
        setIndex(i);
        await nextFrame();
        // The result beat swaps the table for the recap card, which has its own ViewShot
        // honoring the collapsable/onLayout contract HandRecapCard documents.
        const capture = () =>
          beat.kind === 'result'
            ? viewShotRef.current?.capture?.()
            : captureRef(tableShotRef, { format: 'jpg', quality: 0.9 });
        if (beat.kind === 'result') await wait(600); // recap layout + fade before its single frame
        // Animated window: capture as fast as view-shot allows, stamping each frame with
        // its retimed PTS. Wall clock runs at EXPORT_SLOWMO×, the video at 1×.
        const windowMs = animWindowMsFor(beat);
        const start = Date.now();
        while (Date.now() - start < windowMs * EXPORT_SLOWMO) {
          if (cancelled()) throw new Error('cancelled');
          if (encodeError) throw encodeError;
          const tCapture = Date.now() - start;
          const uri = await capture();
          if (!uri) throw new Error('capture failed');
          appendFrame(uri, basePts + Math.round(tCapture / EXPORT_SLOWMO));
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
      }
      await chain;
      if (encodeError) throw encodeError;
      if (cancelled()) throw new Error('cancelled');
      const videoUri = await FrameVideoEncoder.finish(basePts);
      if (cancelled()) throw new Error('cancelled');
      await MediaLibrary.saveToLibraryAsync(videoUri);
      showMessage('success', t('export.videoSaved'));
      setExportState('idle');
      setExportProgress(null);
      // Straight into the share sheet — publishing the story is the point of the export.
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(videoUri, { mimeType: 'video/mp4', UTI: 'public.mpeg-4' });
      }
    } catch {
      await FrameVideoEncoder.abort().catch(() => {});
      if (!cancelled()) showMessage('error', t('export.saveFailed'));
    } finally {
      if (!cancelled()) {
        setExportState('idle');
        setExportProgress(null);
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
    // The river beat needs extra air for its slow flip — and the full bad-beat burst when
    // there is one — before auto-advancing.
    const beat = beats[index];
    const isRiverBeat = beat?.kind === 'streetCards' && beat.street === 'river';
    const interval = isRiverBeat ? (badBeat ? 5200 : 2800) : AUTOPLAY_INTERVAL;
    const timer = setTimeout(() => setIndex((i) => Math.min(i + 1, lastIndex)), interval);
    return () => clearTimeout(timer);
  }, [playing, index, lastIndex, beats, badBeat]);

  useEffect(() => {
    // Stage the bad-beat burst once the slow river flip has landed. Suppressed while
    // exporting: captured frames must show the table, not the overlay.
    const beat = beats[index];
    const onRiverReveal = beat?.kind === 'streetCards' && beat.street === 'river';
    if (!onRiverReveal || !badBeat || exportState === 'exporting') return;
    const timer = setTimeout(() => setBadBeatVisible(true), RIVER_FLIP_DELAY + RIVER_FLIP_DURATION + 200);
    return () => {
      clearTimeout(timer);
      setBadBeatVisible(false);
    };
  }, [beats, index, badBeat, exportState]);

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
  // Dead money (absent SB/BB blinds + the global ante) hits the pot with the preflop action,
  // like real posts would.
  const deadMoneySoFar = revealedContribs['preflop'] ? roundAmount((hand.deadBlinds ?? 0) + (hand.ante ?? 0)) : 0;
  const potSoFar = roundAmount(
    Object.values(revealedContribs)
      .flatMap((perPlayer) => Object.values(perPlayer))
      .reduce((sum, v) => sum + v, 0) + deadMoneySoFar
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
    if (exportState === 'exporting') return; // the export loop owns the cursor
    setPlaying(false);
    const x = e.nativeEvent.locationX;
    if (x < SCREEN_WIDTH * 0.35) {
      setIndex((i) => Math.max(0, i - 1));
    } else {
      setIndex((i) => Math.min(lastIndex, i + 1));
    }
  };

  const renderCaption = () => {
    if (currentBeat?.kind === 'streetActions') return t(`poker:phases.${currentBeat.street}`);
    if (currentBeat?.kind === 'streetCards') return t(`poker:phases.${currentBeat.street}`);
    if (currentBeat?.kind === 'showdown') return t('poker:phases.showdown');
    if (currentBeat?.kind === 'heroCards') return t('steps.myCards');
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
        {!isResult && (
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
      </View>

      {isResult ? (
        <View style={styles.resultWrap}>
          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }} style={styles.recapShot}>
            <HandRecapCard hand={hand} onReady={setCardSize} />
          </ViewShot>
          <View style={styles.resultActions}>
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.accentBright }, (!cardSize || exportState !== 'idle') && styles.disabledBtn]}
              onPress={runExport}
              disabled={!cardSize || exportState !== 'idle'}
              activeOpacity={0.85}
            >
              <Download size={16} color="#0A0A0F" strokeWidth={2} />
              <Text style={styles.shareBtnText}>{t('exportReplay')}</Text>
            </TouchableOpacity>
          </View>
          {exportMessage && (
            <Text style={[styles.exportMessage, { color: exportMessage.type === 'error' ? colors.loss : colors.accentBright }]}>
              {exportMessage.text}
            </Text>
          )}
        </View>
      ) : (
        <Pressable style={styles.tableArea} onPress={handleTap}>
          {/* Everything the per-step export captures lives inside this wrapper — with an
              explicit background because screens render transparent (the root layout paints
              the app background), which would otherwise yield transparent PNGs. The tap hint
              and progress label below are siblings on purpose: never in the captures. */}
          <View ref={tableShotRef} collapsable={false} style={styles.tableShot}>
            <Animated.Text key={`caption-${index}`} entering={FadeInDown.duration(ms(300))} style={styles.caption}>
              {renderCaption()}
            </Animated.Text>

            <PokerTable width={TABLE_W} height={TABLE_H} style={styles.table}>
            <View style={styles.feltCenter} pointerEvents="none">
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
                      <PlayingCard card={c} size="md" dimmed={dimCard(c)} />
                    </Animated.View>
                  ))}
                {hand.board.turn && streetRevealed('turn') && (
                  <Animated.View entering={FlipInEasyY.duration(ms(450))}>
                    <PlayingCard card={hand.board.turn} size="md" dimmed={dimCard(hand.board.turn)} />
                  </Animated.View>
                )}
                {hand.board.river && streetRevealed('river') && (
                  <Animated.View entering={FlipInEasyY.duration(ms(RIVER_FLIP_DURATION)).delay(ms(RIVER_FLIP_DELAY))}>
                    <PlayingCard card={hand.board.river} size="md" dimmed={dimCard(hand.board.river)} />
                  </Animated.View>
                )}
              </View>
            </View>

            {heroRevealed && hero?.holeCards && (
              <Animated.View entering={FlipInEasyY.duration(ms(450))} style={styles.heroCards} pointerEvents="none">
                <PlayingCard card={hero.holeCards[0]} size="lg" dimmed={dimCard(hero.holeCards[0])} style={styles.heroCardLeft} />
                <PlayingCard card={hero.holeCards[1]} size="lg" dimmed={dimCard(hero.holeCards[1])} style={styles.heroCardRight} />
              </Animated.View>
            )}

            {orderedPlayers.map((p, k) => {
              const { x, y } = seatPoint(k, orderedPlayers.length, TABLE_W, TABLE_H);
              const folded = foldedIds.has(p.id);
              const bubble = bubbles.get(p.id);
              const bubbleBelow = y < TABLE_H / 2;
              const remaining =
                p.startingStack !== undefined ? Math.max(0, roundAmount(p.startingStack - committedFor(p.id))) : undefined;
              const knownCards = p.cardsKnown && !!p.holeCards;
              // Win-chance % only during an all-in run-out, where each card shifts it —
              // a hand decided by betting would only ever read 100/0, so it shows nothing.
              // The value comes from the lagged statsIndex: the previous beat's number
              // stays up while cards flip, refreshing once they land.
              const statsActive = allInRevealed && knownCards;
              const equityPct = statsActive ? equity?.get(p.id) : undefined;
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
                  entering={FadeIn.duration(ms(300))}
                  name={p.name}
                  ringColor={p.isHero ? TABLE.gold : TABLE.neutralBorder}
                  ringWidth={p.isHero ? 2 : 1.5}
                  dimmed={folded}
                  tag={p.position}
                  secondLine={
                    folded
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
                          : null
                  }
                >
                  {handStarted && !folded && !p.isHero && (
                    <View
                      style={
                        (isShowdown || allInRevealed) && p.cardsKnown && p.holeCards
                          ? [styles.holePeek, styles.holePeekRevealed]
                          : styles.holePeek
                      }
                    >
                      {(isShowdown || allInRevealed) && p.cardsKnown && p.holeCards ? (
                        // The static rotate lives on an inner View: FlipInEasyY drives the
                        // Animated.View's transform and would overwrite it (Reanimated warns).
                        p.holeCards.map((c, i) => (
                          <Animated.View key={`reveal-${i}`} entering={FlipInEasyY.duration(ms(450)).delay(ms(k * 120 + i * 80))}>
                            <View style={i === 0 ? styles.peekCardLeft : styles.peekCardRight}>
                              <PlayingCard card={c} size="sm" dimmed={dimCard(c)} />
                            </View>
                          </Animated.View>
                        ))
                      ) : (
                        <>
                          <PlayingCard faceDown size="sm" style={styles.peekCardLeft} />
                          <PlayingCard faceDown size="sm" style={styles.peekCardRight} />
                        </>
                      )}
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
                      entering={ZoomIn.duration(ms(220)).delay(ms(bubble.orderIdx * 200))}
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

            {badBeatVisible && badBeat && (
              <WinCelebration
                width={TABLE_W}
                height={TABLE_H}
                title={t('badBeatOverlay.title')}
                subtitle={t('badBeatOverlay.subtitle', { name: badBeat.name, percent: badBeat.percent })}
                onDone={() => setBadBeatVisible(false)}
              />
            )}
          </PokerTable>

          {/* Branding on every video frame — only while recording, invisible in normal
              playback. The recap card carries its own wordmark. */}
          {exportState === 'exporting' && (
            <Text style={[styles.wordmark, { color: colors.onDarkTertiary }]}>Ultimate Poker Kit</Text>
          )}
          </View>

          {exportState === 'exporting' && exportProgress ? (
            <Text style={[styles.tapHint, { color: colors.onDarkSecondary }]}>
              {t('export.progress', { current: exportProgress.current, total: exportProgress.total })}
            </Text>
          ) : exportMessage ? (
            <Text style={[styles.tapHint, { color: exportMessage.type === 'error' ? colors.loss : colors.accentBright }]}>
              {exportMessage.text}
            </Text>
          ) : (
            <Text style={[styles.tapHint, { color: colors.onDarkTertiary }]}>{t('tapHint')}</Text>
          )}
        </Pressable>
      )}

      {isResult && (
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
  // The recap frame gets the same explicit background — screens render transparent, which
  // would otherwise yield a transparent PNG (black on Instagram) unlike the table frames.
  // No borderRadius on either capture wrapper: rounded corners capture as transparent.
  recapShot: {
    backgroundColor: EXPORT_BG,
    padding: spacing.base,
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
  // Face-down peeks tuck behind the avatar; revealed cards at showdown lift high enough to
  // be readable while still painting BEHIND the avatar stack — only their bottom sliver is
  // covered, and the position tag stays visible on top. No zIndex on purpose: lifting the
  // cards further instead would crop them in export captures for top-rail seats.
  holePeekRevealed: {
    top: -34,
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
  // Same treatment as HandRecapCard's wordmark, on the table frames during export.
  wordmark: {
    alignSelf: 'center',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: -spacing.lg,
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
