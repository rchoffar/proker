import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import { Stepper } from '../../src/components/ui/Stepper';
import { AmountInput } from '../../src/components/ui/AmountInput';
import { SegmentedControl } from '../../src/components/ui/SegmentedControl';
import { PlayingCard } from '../../src/components/hand/PlayingCard';
import { CardGrid } from '../../src/components/hand/CardGrid';
import { PlayerActionRow } from '../../src/components/hand/PlayerActionRow';
import { QueuedPlayerRow } from '../../src/components/hand/QueuedPlayerRow';
import { HandRecapCard } from '../../src/components/hand/HandRecapCard';
import { useHandReplayerDraft } from '../../src/store/useHandReplayerDraft';
import { useAuthStore } from '../../src/store/useAuthStore';
import { fontFamily, fontSize, radius, spacing } from '../../src/design-system/theme';
import { useTheme } from '../../src/design-system/ThemeProvider';
import { formatHandAmount, roundAmount } from '../../src/lib/format';
import { DEFAULT_ASSIGN_ORDER, computeBlindPosting, nextFreePosition, orderForStreet, sortByPreflopOrder } from '../../src/lib/handPositions';
import { evaluateBestHandHoldem, findBestHands } from '../../src/lib/pokerHandEvaluator';
import type { HandScore } from '../../src/lib/pokerHandEvaluator';
import { POSITIONS_PREFLOP_ORDER, cardKey } from '../../src/types';
import type { ActionType, Card, HandAction, HandHistory, HandPlayer, Position, PotState, Street, UnitMode } from '../../src/types';

const BOARD_PHASES: Street[] = ['flop', 'turn', 'river'];

// One uniform size for every board card, flop through river — big enough to read, small
// enough that 5 cards + gaps always fit on one row (only narrow screens scale below lg).
const BOARD_CARD_WIDTH = Math.min(64, Math.floor((Dimensions.get('window').width - spacing.base * 2 - spacing.sm * 4) / 5));

type CardGroupKind = 'hero' | 'flop' | 'turn' | 'river' | 'opponent';

interface BettingRoundState {
  street: Street;
  toAct: string[];
  lastAggressorId?: string;
  // The total amount ("bet to") a caller must match this street — 0 while nobody has
  // bet yet. Without this, "Call" had no amount to attach to its action at all.
  currentBet: number;
  // Each player's total contribution this street so far — drives per-player check-vs-call
  // legality (owed = currentBet - contribution), which is what lets the Big Blind "check"
  // when unraised while everyone else who owes money still has to call/raise/fold.
  contributions: Record<string, number>;
}

// Invariant everywhere in this builder: the players array is sorted in preflop action order
// (UTG first … blinds last) with `seat` re-stamped to the array index after every position
// change or resize — array order IS action order, which is what keeps the circular rotation
// logic (seatOrderFrom/reopenQueueFrom) street-agnostic.
function sortAndSeat(players: HandPlayer[]): HandPlayer[] {
  return sortByPreflopOrder(players).map((p, i) => ({ ...p, seat: i }));
}

function makePlayers(count: number, heroName: string, defaultName: (seatNumber: number) => string): HandPlayer[] {
  return sortAndSeat(
    Array.from({ length: count }, (_, i) => ({
      id: `p${i}`,
      name: i === 0 ? heroName : defaultName(i + 1),
      isHero: i === 0,
      seat: i,
      cardsKnown: i === 0,
      isFolded: false,
      position: DEFAULT_ASSIGN_ORDER[i],
    }))
  );
}

function resizePlayers(prev: HandPlayer[], newCount: number, defaultName: (seatNumber: number) => string): HandPlayer[] {
  const next = [...prev];
  while (next.length > newCount) {
    // Remove the most recently added non-hero player (highest numeric id) — the hero can sit
    // anywhere in the array now that it's sorted by position, so slicing would be wrong.
    let removeIdx = -1;
    let highest = -1;
    next.forEach((p, i) => {
      if (p.isHero) return;
      const num = Number(p.id.slice(1));
      if (num > highest) {
        highest = num;
        removeIdx = i;
      }
    });
    if (removeIdx === -1) break;
    next.splice(removeIdx, 1);
  }
  while (next.length < newCount) {
    const taken = new Set(next.map((p) => p.position).filter(Boolean) as Position[]);
    const usedIds = new Set(next.map((p) => p.id));
    let idx = next.length;
    while (usedIds.has(`p${idx}`)) idx += 1;
    next.push({
      id: `p${idx}`,
      name: defaultName(idx + 1),
      isHero: false,
      seat: idx,
      cardsKnown: false,
      isFolded: false,
      position: nextFreePosition(taken),
    });
  }
  return sortAndSeat(next);
}

function computePots(actions: HandAction[], deadBlinds = 0): PotState[] {
  const streets: Street[] = ['preflop', 'flop', 'turn', 'river'];
  let running = deadBlinds;
  const pots: PotState[] = [];
  streets.forEach((street) => {
    const streetActions = actions.filter((a) => a.street === street).sort((a, b) => a.order - b.order);
    if (streetActions.length === 0) return;
    // Each bet/raise/call amount is the player's TOTAL contribution this street (a "raise
    // to", not a "raise by"), so a player who calls a bet and later calls a re-raise appears
    // twice — take their latest amount per street, not the sum of every action they took.
    const contribution: Record<string, number> = {};
    streetActions.forEach((a) => {
      if (a.amount !== undefined) contribution[a.playerId] = a.amount;
    });
    running = roundAmount(running + Object.values(contribution).reduce((sum, v) => sum + v, 0));
    pots.push({ street, amount: running });
  });
  return pots;
}

function cardsEqual(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

// Rotates a full seat list so `anchorId` ends up last — i.e. the seat right after the
// anchor acts first. Shared by the mid-street reopen-on-raise logic (anchor = aggressor)
// and by round-start ordering (anchor = Big Blind preflop, Button postflop). The anchor
// doesn't need to still be in the list by the time it's filtered down to eligible players —
// it's found in the full roster first, so a folded button/aggressor still works as a pivot.
function seatOrderFrom<T extends { id: string }>(players: T[], anchorId: string): T[] {
  const idx = players.findIndex((p) => p.id === anchorId);
  if (idx === -1) return players;
  return [...players.slice(idx + 1), ...players.slice(0, idx + 1)];
}

// After a bet/raise/allin, action must resume with the player immediately after the
// aggressor's seat (wrapping around), not just "seat order minus the aggressor" — otherwise
// an earlier seat gets asked to act again before a later seat has responded to the raise.
function reopenQueueFrom(players: HandPlayer[], aggressorId: string, allInIds: Set<string>): string[] {
  const eligible = players.filter((p) => !p.isFolded && !allInIds.has(p.id));
  return seatOrderFrom(eligible, aggressorId)
    .filter((p) => p.id !== aggressorId)
    .map((p) => p.id);
}

// Lenient comma-aware positive-number parse for user-typed amounts ("12,5" → 12.5, junk → 0).
function parsePositiveAmount(raw: string): number {
  const value = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export default function HandReplayerBuilderScreen() {
  const { t } = useTranslation('replayer');
  const { colors } = useTheme();
  const router = useRouter();
  const setDraft = useHandReplayerDraft((s) => s.setHand);
  const heroName = useAuthStore((s) => s.user?.pseudo) ?? t('common:me');
  const actionCounter = useRef(0);

  const defaultPlayerName = useCallback((seatNumber: number) => t('defaultPlayerName', { index: seatNumber }), [t]);

  const stepTitles = useMemo(
    () => [t('steps.players'), t('steps.myCards'), t('steps.preflop'), t('steps.board'), t('steps.showdown')],
    [t]
  );

  const [step, setStep] = useState(0);
  const [players, setPlayers] = useState<HandPlayer[]>(() => makePlayers(3, heroName, defaultPlayerName));
  const [actions, setActions] = useState<HandAction[]>([]);
  const [heroCards, setHeroCards] = useState<(Card | undefined)[]>([undefined, undefined]);
  const [flopCards, setFlopCards] = useState<(Card | undefined)[]>([undefined, undefined, undefined]);
  const [turnCard, setTurnCard] = useState<Card | undefined>();
  const [riverCard, setRiverCard] = useState<Card | undefined>();
  const [opponentReveal, setOpponentReveal] = useState<Record<string, boolean>>({});
  const [opponentCards, setOpponentCards] = useState<Record<string, (Card | undefined)[]>>({});
  // Manual winner pick, used only when the showdown can't be evaluated automatically.
  // Multiple ids = manually declared split pot.
  const [winnerIds, setWinnerIds] = useState<string[]>([]);
  const [winningHandDescription, setWinningHandDescription] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customStakes, setCustomStakes] = useState('');
  const [allInIds, setAllInIds] = useState<Set<string>>(new Set());
  const [boardPhase, setBoardPhase] = useState<'flop' | 'turn' | 'river'>('flop');
  const [round, setRound] = useState<BettingRoundState | null>(null);
  // Which player's position picker is open in step 0 (null = none).
  const [positionPickerFor, setPositionPickerFor] = useState<string | null>(null);
  const [bigBlindAmount, setBigBlindAmount] = useState('2');
  const [unitMode, setUnitMode] = useState<UnitMode>('bb');
  // Per-player stack strings; absent/empty = the mode's default (100 BB / 200 chips).
  const [stackOverrides, setStackOverrides] = useState<Record<string, string>>({});
  const [editingBoard, setEditingBoard] = useState(false);
  const [editingOpponentId, setEditingOpponentId] = useState<string | null>(null);

  const activePlayers = useMemo(() => players.filter((p) => !p.isFolded), [players]);

  // In BB mode the blinds are the unit itself: SB = 0.5, BB = 1, nothing to type.
  const bigBlindValue = useMemo(() => {
    if (unitMode === 'bb') return 1;
    return parsePositiveAmount(bigBlindAmount);
  }, [unitMode, bigBlindAmount]);
  const smallBlindValue = unitMode === 'bb' ? 0.5 : Math.round(bigBlindValue / 2);

  // Every player has a stack; it's the hard cap on what they can put in. Default is 100 BB
  // (in chips mode: 100 × the big blind); a typed value per player overrides it.
  const defaultStackValue = unitMode === 'bb' ? 100 : roundAmount(bigBlindValue * 100) || 200;

  const stackFor = useCallback(
    (playerId: string): number => {
      const override = parsePositiveAmount(stackOverrides[playerId] ?? '');
      return override > 0 ? override : defaultStackValue;
    },
    [stackOverrides, defaultStackValue]
  );

  // Total already committed across all streets, latest-amount-per-street like computePots
  // ("raise to" convention: a player's later action on a street supersedes their earlier one).
  const committedByPlayer = useMemo(() => {
    const streets: Street[] = ['preflop', 'flop', 'turn', 'river'];
    const totals: Record<string, number> = {};
    streets.forEach((street) => {
      const latest: Record<string, number> = {};
      actions
        .filter((a) => a.street === street)
        .sort((a, b) => a.order - b.order)
        .forEach((a) => {
          if (a.amount !== undefined) latest[a.playerId] = a.amount;
        });
      Object.entries(latest).forEach(([id, v]) => {
        totals[id] = roundAmount((totals[id] ?? 0) + v);
      });
    });
    return totals;
  }, [actions]);

  const remainingStackFor = useCallback(
    (playerId: string): number => Math.max(0, roundAmount(stackFor(playerId) - (committedByPlayer[playerId] ?? 0))),
    [stackFor, committedByPlayer]
  );

  // Largest legal "bet/raise to" this street: what's already in front of the player plus
  // everything left behind. Committing exactly this amount IS an all-in.
  const maxToFor = useCallback(
    (playerId: string): number => roundAmount((round?.contributions[playerId] ?? 0) + remainingStackFor(playerId)),
    [round, remainingStackFor]
  );

  const handleUnitModeChange = (mode: UnitMode) => {
    if (mode === unitMode) return;
    setUnitMode(mode);
    // Stacks are expressed in the unit — carrying values across a unit switch would corrupt them.
    setStackOverrides({});
  };

  const blindPosting = useMemo(
    () => computeBlindPosting(players, smallBlindValue, bigBlindValue),
    [players, smallBlindValue, bigBlindValue]
  );
  const deadBlinds = blindPosting.deadBlinds;

  // Swap-aware: picking a position another player holds trades positions with them, so the
  // roster can never hold duplicates or lose an assignment.
  const assignPosition = useCallback((playerId: string, pos: Position) => {
    setPlayers((prev) => {
      const target = prev.find((p) => p.id === playerId);
      if (!target) return prev;
      const holder = prev.find((p) => p.position === pos);
      return sortAndSeat(
        prev.map((p) => {
          if (p.id === playerId) return { ...p, position: pos };
          if (holder && p.id === holder.id) return { ...p, position: target.position };
          return p;
        })
      );
    });
    setPositionPickerFor(null);
  }, []);

  const usedCards = useMemo(() => {
    const list: Card[] = [];
    heroCards.forEach((c) => c && list.push(c));
    flopCards.forEach((c) => c && list.push(c));
    if (turnCard) list.push(turnCard);
    if (riverCard) list.push(riverCard);
    Object.values(opponentCards).forEach((pair) => pair.forEach((c) => c && list.push(c)));
    return list;
  }, [heroCards, flopCards, turnCard, riverCard, opponentCards]);

  const getGroupArray = useCallback(
    (kind: CardGroupKind, playerId?: string): (Card | undefined)[] => {
      if (kind === 'hero') return heroCards;
      if (kind === 'flop') return flopCards;
      if (kind === 'turn') return [turnCard];
      if (kind === 'river') return [riverCard];
      return opponentCards[playerId!] ?? [undefined, undefined];
    },
    [heroCards, flopCards, turnCard, riverCard, opponentCards]
  );

  // Cards a grid may not offer: everything used elsewhere, minus the group's own picks
  // (those must stay pressable so the user can deselect them).
  const disabledCardsFor = useCallback(
    (kind: CardGroupKind, playerId?: string): Card[] => {
      const group = getGroupArray(kind, playerId);
      return usedCards.filter((c) => !group.some((g) => g && cardsEqual(g, c)));
    },
    [usedCards, getGroupArray]
  );

  const handleBoardCardsChange = useCallback(
    (next: (Card | undefined)[]) => {
      if (boardPhase === 'flop') setFlopCards(next);
      else if (boardPhase === 'turn') setTurnCard(next[0]);
      else setRiverCard(next[0]);
      if (!next.every(Boolean)) return;
      setEditingBoard(false);
      // All-in run-out: no betting round will happen on this phase, so jump to the next one
      // in the same commit. Leaving it to the effects paints the phase's full-size card row
      // for a frame before it collapses into the small completed row — a visible flash.
      const eligible = players.filter((p) => !p.isFolded && !allInIds.has(p.id));
      if (eligible.length <= 1 && boardPhase !== 'river') {
        setBoardPhase(boardPhase === 'flop' ? 'turn' : 'river');
      }
    },
    [boardPhase, players, allInIds]
  );

  const handleOpponentCardsChange = useCallback((playerId: string, next: (Card | undefined)[]) => {
    setOpponentCards((prev) => ({ ...prev, [playerId]: next }));
    if (next.every(Boolean)) setEditingOpponentId(null);
  }, []);

  const startRound = useCallback(
    (street: Street) => {
      const eligible = players.filter((p) => !p.isFolded && !allInIds.has(p.id));

      // Betting needs at least two players who can still act on each other. Once everyone
      // else is all-in, the lone remaining player (who may have only just called, not gone
      // all-in themselves) has no one left to respond to a bet — don't prompt them again on
      // later streets, just run the board out. Preflop always starts with 2+ such players
      // (nobody's folded or shoved yet), so this never blocks the very first action.
      if (eligible.length <= 1) {
        setRound({ street, toAct: [], lastAggressorId: undefined, currentBet: 0, contributions: {} });
        return;
      }

      if (street === 'preflop') {
        // Only players actually entered in the hand post; absent SB/BB are dead blinds
        // already accounted into pots via computePots. Posts are capped at the poster's
        // stack — the step-0 gate (every stack >= BB) makes a short post unreachable in
        // practice, but the cap keeps pot math honest regardless.
        const { sbPosterId, bbPosterId } = blindPosting;
        const baseOrder = actions.filter((a) => a.street === 'preflop').length;
        const posts: HandAction[] = [];
        const contributions: Record<string, number> = {};
        if (sbPosterId) {
          const amount = roundAmount(Math.min(smallBlindValue, stackFor(sbPosterId)));
          actionCounter.current += 1;
          posts.push({ id: `a${actionCounter.current}`, street, playerId: sbPosterId, type: 'post', amount, order: baseOrder + posts.length });
          contributions[sbPosterId] = amount;
        }
        let bbPostAmount: number | undefined;
        if (bbPosterId) {
          bbPostAmount = roundAmount(Math.min(bigBlindValue, stackFor(bbPosterId)));
          actionCounter.current += 1;
          posts.push({ id: `a${actionCounter.current}`, street, playerId: bbPosterId, type: 'post', amount: bbPostAmount, order: baseOrder + posts.length });
          contributions[bbPosterId] = bbPostAmount;
        }
        if (posts.length > 0) setActions((prev) => [...prev, ...posts]);
        setRound({
          street,
          // The players array is already in preflop action order (UTG first, blinds last).
          toAct: eligible.map((p) => p.id),
          lastAggressorId: undefined,
          // Entering the pot always costs the big blind, even when the BB player was left
          // out of the hand (their post is dead money, not a discount).
          currentBet: bbPostAmount ?? bigBlindValue,
          contributions,
        });
        return;
      }

      // Postflop the SB (or the earliest remaining position) opens and the BTN closes; the
      // button itself may be absent, so sort by position instead of anchoring on a player.
      const ordered = orderForStreet(eligible, street);
      setRound({ street, toAct: ordered.map((p) => p.id), lastAggressorId: undefined, currentBet: 0, contributions: {} });
    },
    [players, allInIds, blindPosting, bigBlindValue, smallBlindValue, actions, stackFor]
  );

  const recordAction = useCallback(
    (street: Street, playerId: string, type: ActionType, amount?: number) => {
      // A call always matches the street's outstanding bet — the caller never types this
      // amount themselves, so pull it from the round instead of trusting an undefined arg.
      const maxTo = maxToFor(playerId);
      let resolvedType = type;
      let finalAmount = type === 'call' ? round?.currentBet : amount;
      if (finalAmount !== undefined && (type === 'call' || type === 'bet' || type === 'raise' || type === 'allin')) {
        // Nobody can put in more than they have; committing everything IS an all-in, whatever
        // button produced it (short-stack "call" of a bigger bet included).
        finalAmount = roundAmount(Math.min(finalAmount, maxTo));
        if (finalAmount >= maxTo) resolvedType = 'allin';
      }
      actionCounter.current += 1;
      const order = actions.filter((a) => a.street === street).length;
      const newAction: HandAction = { id: `a${actionCounter.current}`, street, playerId, type: resolvedType, amount: finalAmount, order };
      setActions((prev) => [...prev, newAction]);

      let updatedPlayers = players;
      let updatedAllIn = allInIds;

      if (type === 'fold') {
        updatedPlayers = players.map((p) => (p.id === playerId ? { ...p, isFolded: true, foldedOnStreet: street } : p));
        setPlayers(updatedPlayers);
        const stillActive = updatedPlayers.filter((p) => !p.isFolded);
        if (stillActive.length <= 1) {
          setWinnerIds(stillActive[0] ? [stillActive[0].id] : []);
          setRound(null);
          setStep(4);
          return;
        }
      }

      if (resolvedType === 'allin') {
        updatedAllIn = new Set(allInIds).add(playerId);
        setAllInIds(updatedAllIn);
      }

      setRound((prev) => {
        if (!prev || prev.street !== street) return prev;
        const contributions =
          finalAmount !== undefined ? { ...prev.contributions, [playerId]: finalAmount } : prev.contributions;
        // Only an amount that actually raises the outstanding bet reopens the action — a
        // short-stack all-in below (or matching) the current bet is a call, and forcing
        // players who already matched to act again would be wrong.
        const aggressionBet =
          (resolvedType === 'bet' || resolvedType === 'raise' || resolvedType === 'allin') &&
          finalAmount !== undefined &&
          finalAmount > prev.currentBet
            ? finalAmount
            : undefined;
        if (aggressionBet !== undefined) {
          const reopened = reopenQueueFrom(updatedPlayers, playerId, updatedAllIn);
          return {
            street,
            toAct: reopened,
            lastAggressorId: playerId,
            currentBet: aggressionBet,
            contributions,
          };
        }
        return { ...prev, toAct: prev.toAct.filter((id) => id !== playerId), contributions };
      });
    },
    [actions, players, allInIds, round, maxToFor]
  );

  const availableActionsFor = useCallback(
    (playerId: string): ActionType[] => {
      const owed = (round?.currentBet ?? 0) - (round?.contributions[playerId] ?? 0);
      if (owed > 0) {
        // Too short to raise above the current bet → calling already means all-in.
        if (maxToFor(playerId) <= (round?.currentBet ?? 0)) return ['fold', 'call', 'allin'];
        return ['fold', 'call', 'raise', 'allin'];
      }
      return ['fold', 'check', 'bet', 'allin'];
    },
    [round, maxToFor]
  );

  // Preflop's round starts as soon as the builder reaches the Preflop step.
  useEffect(() => {
    if (step === 2 && (!round || round.street !== 'preflop')) startRound('preflop');
  }, [step, round, startRound]);

  const boardPhaseCardsReady = useCallback(
    (phase: 'flop' | 'turn' | 'river') => {
      if (phase === 'flop') return flopCards.every(Boolean);
      if (phase === 'turn') return !!turnCard;
      return !!riverCard;
    },
    [flopCards, turnCard, riverCard]
  );

  // A board phase's round only starts once that phase's cards are all placed.
  useEffect(() => {
    if (step !== 3) return;
    if (boardPhaseCardsReady(boardPhase) && (!round || round.street !== boardPhase)) {
      startRound(boardPhase);
    }
  }, [step, boardPhase, boardPhaseCardsReady, round, startRound]);

  // Once a phase's betting round closes, auto-advance to the next phase — no "Continuer" tap needed between them.
  useEffect(() => {
    if (step !== 3 || !round || round.street !== boardPhase) return;
    if (round.toAct.length !== 0) return;
    if (boardPhase === 'flop') setBoardPhase('turn');
    else if (boardPhase === 'turn') setBoardPhase('river');
    else return;
    setEditingBoard(false);
  }, [step, round, boardPhase]);

  const goNext = () => setStep((s) => s + 1);
  const goBack = () => (step > 0 ? setStep((s) => s - 1) : router.back());

  const reset = () => {
    setStep(0);
    setPlayers(makePlayers(3, heroName, defaultPlayerName));
    setActions([]);
    setHeroCards([undefined, undefined]);
    setFlopCards([undefined, undefined, undefined]);
    setTurnCard(undefined);
    setRiverCard(undefined);
    setOpponentReveal({});
    setOpponentCards({});
    setWinnerIds([]);
    setWinningHandDescription('');
    setCustomTitle('');
    setCustomStakes('');
    setAllInIds(new Set());
    setBoardPhase('flop');
    setRound(null);
    setPositionPickerFor(null);
    setBigBlindAmount('2');
    setUnitMode('bb');
    setStackOverrides({});
    setEditingBoard(false);
    setEditingOpponentId(null);
  };

  const computeAutoTitle = useCallback((): string => {
    const finalStreetId = riverCard ? 'river' : turnCard ? 'turn' : flopCards.every(Boolean) ? 'flop' : 'preflop';
    const street = t(`poker:phases.${finalStreetId}`);
    const heroShort = heroCards[0] && heroCards[1] ? `${heroCards[0].rank}${heroCards[1].rank}` : '';
    const revealedOpponent = activePlayers.find(
      (p) => !p.isHero && opponentReveal[p.id] && opponentCards[p.id]?.[0] && opponentCards[p.id]?.[1]
    );
    if (heroShort && revealedOpponent) {
      const pair = opponentCards[revealedOpponent.id]!;
      return t('autoTitle.vsHand', { hero: heroShort, villain: `${pair[0]!.rank}${pair[1]!.rank}`, street });
    }
    if (heroShort) {
      const opponentCount = Math.max(activePlayers.length - 1, 0);
      return t('autoTitle.vsPlayers', { hero: heroShort, count: opponentCount, street });
    }
    return t('autoTitle.generic', { street });
  }, [t, heroCards, flopCards, turnCard, riverCard, activePlayers, opponentReveal, opponentCards]);

  // Automatic showdown result: once the board is complete and every non-folded player's
  // cards are known, the evaluator decides — ties come back as multiple ids (split pot).
  // Derived, never stored: toggling an opponent's "cards known" eye off instantly falls
  // back to the manual picker with its previous selection intact.
  const boardComplete = flopCards.every(Boolean) && !!turnCard && !!riverCard;
  const showdownEval = useMemo(() => {
    if (!boardComplete) return null; // hand ended before the river — nothing to evaluate
    if (activePlayers.length < 2) return null; // fold-out path already set the winner
    const board = [...(flopCards as Card[]), turnCard!, riverCard!];
    const scored: { playerId: string; score: HandScore }[] = [];
    for (const p of activePlayers) {
      const pair = p.isHero ? heroCards : opponentReveal[p.id] ? (opponentCards[p.id] ?? []) : [];
      if (!pair[0] || !pair[1]) return null; // any unknown hand → manual mode
      scored.push({ playerId: p.id, score: evaluateBestHandHoldem([pair[0], pair[1]], board) });
    }
    const ids = findBestHands(scored);
    const winning = scored.find((s) => s.playerId === ids[0]);
    return winning ? { winnerIds: ids, categoryId: winning.score.categoryId } : null;
  }, [boardComplete, activePlayers, heroCards, opponentReveal, opponentCards, flopCards, turnCard, riverCard]);

  const effectiveWinnerIds = showdownEval?.winnerIds ?? winnerIds;
  const effectiveWinningDescription = showdownEval
    ? t(`poker:handCategories.${showdownEval.categoryId}`)
    : winningHandDescription.trim() || undefined;

  const buildHandHistory = useCallback((): HandHistory => {
    const finalPlayers: HandPlayer[] = players.map((p) => {
      let holeCards: [Card, Card] | undefined;
      let cardsKnown = false;
      if (p.isHero) {
        holeCards = heroCards[0] && heroCards[1] ? [heroCards[0], heroCards[1]] : undefined;
        cardsKnown = true;
      } else {
        const revealed = !!opponentReveal[p.id];
        const pair = opponentCards[p.id];
        holeCards = revealed && pair?.[0] && pair?.[1] ? [pair[0], pair[1]] : undefined;
        cardsKnown = revealed && !!holeCards;
      }
      const result: HandPlayer['result'] = effectiveWinnerIds.includes(p.id)
        ? 'won'
        : p.isFolded
          ? 'folded'
          : effectiveWinnerIds.length > 0
            ? 'lost'
            : 'unknown';
      return { ...p, holeCards, cardsKnown, result, startingStack: stackFor(p.id) };
    });

    return {
      id: `hand-${Date.now()}`,
      createdAt: new Date().toISOString(),
      title: customTitle.trim() || computeAutoTitle(),
      gameType: 'NLH',
      stakes: customStakes.trim() || undefined,
      players: finalPlayers,
      board: {
        flop: flopCards[0] && flopCards[1] && flopCards[2] ? [flopCards[0], flopCards[1], flopCards[2]] : undefined,
        turn: turnCard,
        river: riverCard,
      },
      actions,
      pots: computePots(actions, deadBlinds),
      winnerIds: effectiveWinnerIds.length > 0 ? effectiveWinnerIds : undefined,
      winningHandDescription: effectiveWinningDescription,
      deadBlinds: deadBlinds > 0 ? deadBlinds : undefined,
      unitMode,
    };
  }, [players, heroCards, opponentReveal, opponentCards, effectiveWinnerIds, customTitle, computeAutoTitle, customStakes, flopCards, turnCard, riverCard, actions, effectiveWinningDescription, deadBlinds, stackFor, unitMode]);

  const handleReplay = () => {
    setDraft(buildHandHistory());
    router.push('/hand-replayer/play');
  };

  const handleExport = () => {
    setDraft(buildHandHistory());
    router.push({ pathname: '/hand-replayer/play', params: { skip: '1' } });
  };

  const canContinue = () => {
    if (step === 0)
      return (
        players.length >= 2 &&
        players.every((p) => !!p.position) &&
        bigBlindValue > 0 &&
        // Every stack must at least cover the BB post — a sub-blind stack breaks the engine's
        // assumption that blinds are always fully posted.
        players.every((p) => stackFor(p.id) >= bigBlindValue)
      );
    if (step === 1) return !!heroCards[0] && !!heroCards[1];
    if (step === 2) return !!round && round.street === 'preflop' && round.toAct.length === 0;
    if (step === 3) return boardPhase === 'river' && !!riverCard && !!round && round.street === 'river' && round.toAct.length === 0;
    return true;
  };

  const renderBettingRound = (street: Street) => {
    if (!round || round.street !== street) return null;
    const doneActions = actions.filter((a) => a.street === street).sort((a, b) => a.order - b.order);

    if (round.toAct.length === 0 && doneActions.length === 0) {
      return <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('noMoreBetting')}</Text>;
    }

    const currentId = round.toAct[0];
    const currentPlayer = currentId ? players.find((p) => p.id === currentId) : undefined;
    const queuedIds = round.toAct.slice(1);

    return (
      <View style={styles.actionsList}>
        {doneActions.map((a) => {
          const p = players.find((pp) => pp.id === a.playerId);
          const position = p?.position;
          return (
            <View key={a.id} style={styles.actedRow}>
              <Text style={[styles.actedText, { color: colors.textSecondary }]}>
                {a.type === 'post' ? (
                  <>
                    {p?.name}
                    {position ? ` (${position})` : ''}
                    {a.amount ? ` ${formatHandAmount(a.amount, unitMode)}` : ''}
                  </>
                ) : (
                  <>
                    {p?.name}
                    {position ? ` (${position})` : ''} — {t(`poker:actions.${a.type}`)}
                    {a.amount ? ` ${formatHandAmount(a.amount, unitMode)}` : ''}
                  </>
                )}
              </Text>
            </View>
          );
        })}
        {currentPlayer && (
          <PlayerActionRow
            player={currentPlayer}
            availableActions={availableActionsFor(currentPlayer.id)}
            position={currentPlayer.position}
            currentBet={round.currentBet}
            unitMode={unitMode}
            remainingStack={remainingStackFor(currentPlayer.id)}
            maxTo={maxToFor(currentPlayer.id)}
            onAction={(type, amount) => recordAction(street, currentPlayer.id, type, amount)}
          />
        )}
        {queuedIds.map((id) => {
          const p = players.find((pp) => pp.id === id);
          return p ? (
            <QueuedPlayerRow key={id} player={p} position={p.position} stackLabel={formatHandAmount(remainingStackFor(id), unitMode)} />
          ) : null;
        })}
      </View>
    );
  };

  const actionsSummaryFor = (street: Street): string => {
    const streetActions = actions.filter((a) => a.street === street).sort((a, b) => a.order - b.order);
    if (!streetActions.length) return '';
    return streetActions
      .map((a) => {
        const p = players.find((pp) => pp.id === a.playerId);
        return `${p?.name ?? '?'} ${t(`poker:actions.${a.type}`)}${a.amount ? ` ${formatHandAmount(a.amount, unitMode)}` : ''}`;
      })
      .join(' · ');
  };

  const renderBoardStep = () => {
    const phaseIndex = BOARD_PHASES.indexOf(boardPhase);
    // Every picked board card lives in one row at one uniform size — earlier streets never
    // shrink when the picker advances from flop to turn to river.
    const boardSoFar = [...flopCards, turnCard, riverCard].filter(Boolean) as Card[];
    return (
      <View style={styles.stepBody}>
        {boardSoFar.length > 0 && (
          <View style={styles.boardCardsRow}>
            {boardSoFar.map((c) => (
              <Animated.View key={cardKey(c)} entering={FadeInDown.springify().damping(18).stiffness(140)}>
                <PlayingCard card={c} width={BOARD_CARD_WIDTH} />
              </Animated.View>
            ))}
            {boardPhaseCardsReady(boardPhase) && !editingBoard && (
              <TouchableOpacity onPress={() => setEditingBoard(true)} activeOpacity={0.7} style={styles.editCardsBtn}>
                <Text style={[styles.editCardsText, { color: colors.textTertiary }]}>{t('common:edit')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {BOARD_PHASES.slice(0, phaseIndex).map((phase) =>
          actionsSummaryFor(phase) ? (
            <View key={phase} style={styles.completedPhase}>
              <Text style={[styles.actedText, { color: colors.textSecondary }]}>
                {t(`poker:phases.${phase as 'flop' | 'turn' | 'river'}`)} — {actionsSummaryFor(phase)}
              </Text>
            </View>
          ) : null
        )}

        <Animated.View key={boardPhase} entering={FadeInDown.springify().damping(18).stiffness(140)} style={styles.stepBody}>
          {!boardPhaseCardsReady(boardPhase) || editingBoard ? (
            <CardGrid
              value={boardPhase === 'flop' ? flopCards : boardPhase === 'turn' ? [turnCard] : [riverCard]}
              onChange={handleBoardCardsChange}
              disabledCards={disabledCardsFor(boardPhase)}
              label={t(`poker:phases.${boardPhase}`)}
            />
          ) : (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>{t(`poker:phases.${boardPhase}`)}</Text>
          )}
          {boardPhaseCardsReady(boardPhase) && renderBettingRound(boardPhase)}
        </Animated.View>
      </View>
    );
  };

  const renderShowdownStep = () => {
    const previewHand = buildHandHistory();
    return (
      <View style={styles.stepBody}>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('showdownHint')}</Text>
        {activePlayers
          .filter((p) => !p.isHero)
          .map((p) => {
            const revealed = !!opponentReveal[p.id];
            const pair = opponentCards[p.id] ?? [undefined, undefined];
            return (
              <View key={p.id} style={styles.opponentBlock}>
                <View style={styles.opponentHeader}>
                  <Text style={[styles.opponentName, { color: colors.textPrimary }]}>{p.name}</Text>
                  <TouchableOpacity
                    style={[styles.revealToggle, { borderColor: colors.hairline }]}
                    onPress={() => setOpponentReveal((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                    activeOpacity={0.7}
                  >
                    {revealed ? (
                      <Eye size={14} color={colors.accent} strokeWidth={2} />
                    ) : (
                      <EyeOff size={14} color={colors.textTertiary} strokeWidth={2} />
                    )}
                    <Text style={[styles.revealText, { color: revealed ? colors.accent : colors.textTertiary }]}>
                      {revealed ? t('cardsKnown') : t('cardsUnknown')}
                    </Text>
                  </TouchableOpacity>
                </View>
                {revealed &&
                  (pair[0] && pair[1] && editingOpponentId !== p.id ? (
                    <TouchableOpacity style={styles.cardsRow} onPress={() => setEditingOpponentId(p.id)} activeOpacity={0.75}>
                      <PlayingCard card={pair[0]} size="lg" />
                      <PlayingCard card={pair[1]} size="lg" />
                    </TouchableOpacity>
                  ) : (
                    <CardGrid
                      value={pair}
                      onChange={(next) => handleOpponentCardsChange(p.id, next)}
                      disabledCards={disabledCardsFor('opponent', p.id)}
                      label={t('opponentCardsLabel', { name: p.name })}
                    />
                  ))}
              </View>
            );
          })}

        {showdownEval ? (
          <View style={[styles.autoWinnerBox, { borderColor: colors.accent, backgroundColor: colors.accentTint }]}>
            <Text style={[styles.autoWinnerText, { color: colors.accent }]}>
              {showdownEval.winnerIds.length > 1
                ? t('autoWinnerSplit', {
                    names: players
                      .filter((p) => showdownEval.winnerIds.includes(p.id))
                      .map((p) => p.name)
                      .join(', '),
                    hand: t(`poker:handCategories.${showdownEval.categoryId}`),
                  })
                : t('autoWinnerSingle', {
                    name: players.find((p) => p.id === showdownEval.winnerIds[0])?.name ?? '',
                    hand: t(`poker:handCategories.${showdownEval.categoryId}`),
                  })}
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.hint, { color: colors.textSecondary, marginTop: spacing.md }]}>{t('whoWins')}</Text>
            <View style={styles.winnerRow}>
              {activePlayers.map((p) => {
                const selected = winnerIds.includes(p.id);
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() =>
                      setWinnerIds((prev) => (prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]))
                    }
                    style={[
                      styles.winnerChip,
                      { borderColor: colors.hairline, backgroundColor: colors.neutralTileBg },
                      selected && { borderColor: colors.accent, backgroundColor: colors.accentTint },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.winnerChipText, { color: selected ? colors.accent : colors.textSecondary }]}>{p.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              value={winningHandDescription}
              onChangeText={setWinningHandDescription}
              placeholder={t('descriptionPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              style={[styles.descInput, { color: colors.textPrimary, borderColor: colors.hairline, backgroundColor: colors.surface.fieldBg }]}
            />
          </>
        )}

        <TextInput
          value={customTitle}
          onChangeText={setCustomTitle}
          placeholder={t('titlePlaceholder', { example: computeAutoTitle() })}
          placeholderTextColor={colors.textTertiary}
          style={[styles.descInput, { color: colors.textPrimary, borderColor: colors.hairline, backgroundColor: colors.surface.fieldBg }]}
        />
        <TextInput
          value={customStakes}
          onChangeText={setCustomStakes}
          placeholder={t('stakesPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          style={[styles.descInput, { color: colors.textPrimary, borderColor: colors.hairline, backgroundColor: colors.surface.fieldBg }]}
        />

        <View style={styles.previewWrap}>
          <HandRecapCard hand={previewHand} />
        </View>

        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]} onPress={handleReplay} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>{t('replayHand')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, { backgroundColor: colors.neutralTileBg }]}
          onPress={handleExport}
          activeOpacity={0.85}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>{t('exportImage')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: colors.neutralTileBg }]} onPress={reset} activeOpacity={0.85}>
          <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>{t('restart')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepBody}>
            <SegmentedControl
              options={[
                { key: 'bb', label: t('unitBlinds') },
                { key: 'chips', label: t('unitChips') },
              ]}
              value={unitMode}
              onChange={handleUnitModeChange}
            />
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {unitMode === 'bb' ? t('unitHintBb') : t('unitHintChips')}
            </Text>
            <Stepper
              label={t('steps.players')}
              value={players.length}
              min={2}
              max={9}
              onDecrement={() => setPlayers((prev) => resizePlayers(prev, Math.max(2, prev.length - 1), defaultPlayerName))}
              onIncrement={() => setPlayers((prev) => resizePlayers(prev, Math.min(9, prev.length + 1), defaultPlayerName))}
            />
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {t('setupHint', { stack: formatHandAmount(defaultStackValue, unitMode) })}
            </Text>
            <View style={styles.playerList}>
              {players.map((p) => {
                const overridden = !!(stackOverrides[p.id] ?? '').trim();
                const pickerOpen = positionPickerFor === p.id;
                return (
                  <View key={p.id}>
                    <View style={[styles.playerRow, { borderColor: colors.hairline, backgroundColor: colors.surface.fieldBg }]}>
                      <TouchableOpacity
                        onPress={() => setPositionPickerFor((cur) => (cur === p.id ? null : p.id))}
                        activeOpacity={0.7}
                        style={[
                          styles.posBadge,
                          { borderColor: colors.hairline },
                          (pickerOpen || !p.position) && { borderColor: colors.accent, backgroundColor: colors.accentTint },
                        ]}
                      >
                        <Text style={[styles.posBadgeText, { color: pickerOpen || !p.position ? colors.accent : colors.textSecondary }]}>
                          {p.position ?? t('noPosition')}
                        </Text>
                      </TouchableOpacity>
                      <TextInput
                        value={p.name}
                        onChangeText={(text) => setPlayers((prev) => prev.map((pp) => (pp.id === p.id ? { ...pp, name: text } : pp)))}
                        style={[styles.nameInput, { color: colors.textPrimary }]}
                        placeholderTextColor={colors.textTertiary}
                      />
                      <TextInput
                        value={stackOverrides[p.id] ?? ''}
                        onChangeText={(text) =>
                          setStackOverrides((prev) => ({ ...prev, [p.id]: text.replace(/[^0-9.,]/g, '') }))
                        }
                        placeholder={String(defaultStackValue)}
                        placeholderTextColor={colors.textSecondary}
                        keyboardType={unitMode === 'bb' ? 'decimal-pad' : 'numeric'}
                        style={[
                          styles.stackInput,
                          { color: colors.textPrimary, borderColor: colors.hairline, backgroundColor: colors.neutralTileBg },
                          overridden && { borderColor: colors.accent, backgroundColor: colors.accentTint },
                        ]}
                      />
                      <Text style={[styles.stackUnit, { color: colors.textTertiary }]}>{unitMode === 'bb' ? 'BB' : t('chipsUnit')}</Text>
                    </View>
                    {pickerOpen && (
                      <View style={styles.posPicker}>
                        <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('positionPickerHint', { name: p.name })}</Text>
                        <View style={styles.winnerRow}>
                          {POSITIONS_PREFLOP_ORDER.map((pos) => {
                            const current = p.position === pos;
                            const takenByOther = !current && players.some((pp) => pp.position === pos);
                            return (
                              <TouchableOpacity
                                key={pos}
                                onPress={() => assignPosition(p.id, pos)}
                                style={[
                                  styles.winnerChip,
                                  { borderColor: colors.hairline, backgroundColor: colors.neutralTileBg },
                                  takenByOther && { opacity: 0.45 },
                                  current && { borderColor: colors.accent, backgroundColor: colors.accentTint },
                                ]}
                                activeOpacity={0.7}
                              >
                                <Text style={[styles.winnerChipText, { color: current ? colors.accent : colors.textSecondary }]}>{pos}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
            {deadBlinds > 0 && (
              <Text style={[styles.hint, { color: colors.textTertiary }]}>
                {!blindPosting.sbPosterId && !blindPosting.bbPosterId
                  ? t('deadBlindsHintBoth')
                  : !blindPosting.bbPosterId
                    ? t('deadBlindsHintBb')
                    : t('deadBlindsHintSb')}
              </Text>
            )}
            {unitMode === 'chips' && (
              <AmountInput label={t('bigBlindLabel')} value={bigBlindAmount} onChange={setBigBlindAmount} unit="" placeholder="2" />
            )}
          </View>
        );

      case 1:
        return (
          <View style={styles.stepBody}>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('heroCardsHint')}</Text>
            {heroCards.some(Boolean) && (
              <View style={styles.cardsRow}>
                {heroCards.filter(Boolean).map((c, i) => (
                  <PlayingCard key={i} card={c!} size="md" />
                ))}
              </View>
            )}
            <CardGrid value={heroCards} onChange={setHeroCards} disabledCards={disabledCardsFor('hero')} />
          </View>
        );

      case 2:
        return (
          <View style={styles.stepBody}>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('preflopHint')}</Text>
            {renderBettingRound('preflop')}
          </View>
        );

      case 3:
        return renderBoardStep();

      case 4:
      default:
        return renderShowdownStep();
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.neutralTileBg }]}
          onPress={goBack}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={18} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{stepTitles[step]}</Text>
      </View>

      <View style={styles.dots}>
        {stepTitles.map((_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i <= step ? colors.accent : colors.hairline }]} />
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.springify().damping(18).stiffness(140)}>{renderStep()}</Animated.View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {step < 4 && (step !== 1 || canContinue()) && (
        <View style={[styles.footer, { borderTopColor: colors.hairline }]}>
          <TouchableOpacity
            style={[styles.primaryBtn, !canContinue() && styles.disabledBtn, { backgroundColor: colors.accentBright }]}
            onPress={goNext}
            disabled={!canContinue()}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>{step === 1 ? t('common:confirm') : t('common:continue')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize['2xl'],
    fontFamily: fontFamily.display,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.base,
  },
  stepBody: {
    gap: spacing.base,
  },
  hint: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  playerList: {
    gap: spacing.sm,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  nameInput: {
    flex: 1,
    fontSize: fontSize.md,
    fontFamily: fontFamily.medium,
  },
  posBadge: {
    minWidth: 44,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  posBadgeText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
  },
  posPicker: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  boardCardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  autoWinnerBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  autoWinnerText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  cardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stackInput: {
    minWidth: 56,
    textAlign: 'right',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  stackUnit: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
  },
  editCardsBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  editCardsText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
    textDecorationLine: 'underline',
  },
  actionsList: {
    gap: spacing.xs,
  },
  actedRow: {
    paddingVertical: spacing.sm,
  },
  actedText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
  },
  completedPhase: {
    gap: spacing.sm,
    opacity: 0.6,
  },
  opponentBlock: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  opponentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  opponentName: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  revealToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  revealText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
  },
  winnerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  winnerChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  winnerChipText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
  },
  descInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    fontFamily: fontFamily.regular,
  },
  previewWrap: {
    marginTop: spacing.sm,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  primaryBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#0A0A0F',
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  secondaryBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryBtnText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
  },
  disabledBtn: {
    opacity: 0.4,
  },
});
