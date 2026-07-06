import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, Star, Eye, EyeOff } from 'lucide-react-native';
import { Stepper } from '../../src/components/ui/Stepper';
import { PlayingCard } from '../../src/components/hand/PlayingCard';
import { CardPicker } from '../../src/components/hand/CardPicker';
import { PlayerActionRow } from '../../src/components/hand/PlayerActionRow';
import { QueuedPlayerRow } from '../../src/components/hand/QueuedPlayerRow';
import { HandRecapCard } from '../../src/components/hand/HandRecapCard';
import { useHandReplayerDraft } from '../../src/store/useHandReplayerDraft';
import { fontFamily, fontSize, radius, spacing } from '../../src/design-system/theme';
import { useTheme } from '../../src/design-system/ThemeProvider';
import type { ActionType, Card, HandAction, HandHistory, HandPlayer, PotState, Street } from '../../src/types';

const STEP_TITLES = ['Joueurs', 'Mes cartes', 'Preflop', 'Board', 'Showdown'];
const BOARD_PHASES: Street[] = ['flop', 'turn', 'river'];
const PHASE_LABELS: Record<'flop' | 'turn' | 'river', string> = { flop: 'Flop', turn: 'Turn', river: 'River' };
const ACTION_LABELS: Record<ActionType, string> = {
  fold: 'fold',
  check: 'check',
  call: 'suit',
  bet: 'mise',
  raise: 'relance',
  allin: 'all-in',
};

type CardGroupKind = 'hero' | 'flop' | 'turn' | 'river' | 'opponent';

interface PickerTarget {
  kind: CardGroupKind;
  playerId?: string;
  startIndex: number;
  slots: number;
}

interface BettingRoundState {
  street: Street;
  toAct: string[];
  lastAggressorId?: string;
}

function makePlayers(count: number): HandPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    name: i === 0 ? 'Moi' : `Joueur ${i + 1}`,
    isHero: i === 0,
    seat: i,
    cardsKnown: i === 0,
    isFolded: false,
  }));
}

function resizePlayers(prev: HandPlayer[], newCount: number): HandPlayer[] {
  let next: HandPlayer[];
  if (newCount <= prev.length) {
    next = prev.slice(0, newCount);
  } else {
    const additions: HandPlayer[] = Array.from({ length: newCount - prev.length }, (_, i) => {
      const idx = prev.length + i;
      return { id: `p${idx}`, name: `Joueur ${idx + 1}`, isHero: false, seat: idx, cardsKnown: false, isFolded: false };
    });
    next = [...prev, ...additions];
  }
  if (!next.some((p) => p.isHero)) {
    next = next.map((p, i) => (i === 0 ? { ...p, isHero: true } : p));
  }
  return next;
}

function computePots(actions: HandAction[]): PotState[] {
  const streets: Street[] = ['preflop', 'flop', 'turn', 'river'];
  let running = 0;
  const pots: PotState[] = [];
  streets.forEach((street) => {
    const streetActions = actions.filter((a) => a.street === street);
    if (streetActions.length === 0) return;
    running += streetActions.reduce((sum, a) => sum + (a.amount ?? 0), 0);
    pots.push({ street, amount: running });
  });
  return pots;
}

function cardsEqual(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

// After a bet/raise/allin, action must resume with the player immediately after the
// aggressor's seat (wrapping around), not just "seat order minus the aggressor" — otherwise
// an earlier seat gets asked to act again before a later seat has responded to the raise.
function reopenQueueFrom(players: HandPlayer[], aggressorId: string, allInIds: Set<string>): string[] {
  const eligible = players.filter((p) => !p.isFolded && !allInIds.has(p.id));
  const idx = eligible.findIndex((p) => p.id === aggressorId);
  if (idx === -1) return eligible.filter((p) => p.id !== aggressorId).map((p) => p.id);
  const after = eligible.slice(idx + 1);
  const before = eligible.slice(0, idx);
  return [...after, ...before].map((p) => p.id);
}

function CardSlot({ card, onPress }: { card?: Card; onPress: () => void }) {
  const { colors } = useTheme();
  if (card) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        <PlayingCard card={card} size="lg" />
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.emptySlot, { borderColor: colors.hairline }]} />
    </TouchableOpacity>
  );
}

export default function HandReplayerBuilderScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const setDraft = useHandReplayerDraft((s) => s.setHand);
  const actionCounter = useRef(0);

  const [step, setStep] = useState(0);
  const [players, setPlayers] = useState<HandPlayer[]>(() => makePlayers(3));
  const [actions, setActions] = useState<HandAction[]>([]);
  const [heroCards, setHeroCards] = useState<(Card | undefined)[]>([undefined, undefined]);
  const [flopCards, setFlopCards] = useState<(Card | undefined)[]>([undefined, undefined, undefined]);
  const [turnCard, setTurnCard] = useState<Card | undefined>();
  const [riverCard, setRiverCard] = useState<Card | undefined>();
  const [opponentReveal, setOpponentReveal] = useState<Record<string, boolean>>({});
  const [opponentCards, setOpponentCards] = useState<Record<string, (Card | undefined)[]>>({});
  const [winnerId, setWinnerId] = useState<string | undefined>();
  const [winningHandDescription, setWinningHandDescription] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customStakes, setCustomStakes] = useState('');
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [allInIds, setAllInIds] = useState<Set<string>>(new Set());
  const [boardPhase, setBoardPhase] = useState<'flop' | 'turn' | 'river'>('flop');
  const [round, setRound] = useState<BettingRoundState | null>(null);

  const activePlayers = useMemo(() => players.filter((p) => !p.isFolded), [players]);

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

  const openPicker = useCallback(
    (kind: CardGroupKind, tappedIndex: number, playerId?: string) => {
      const group = getGroupArray(kind, playerId);
      const allEmpty = group.every((c) => !c);
      const slots = allEmpty ? group.length : 1;
      const startIndex = allEmpty ? 0 : tappedIndex;
      setPickerTarget({ kind, playerId, startIndex, slots });
    },
    [getGroupArray]
  );

  const applyCards = useCallback((target: PickerTarget, cards: Card[]) => {
    const write = (arr: (Card | undefined)[]) => {
      const next = [...arr];
      cards.forEach((c, j) => {
        next[target.startIndex + j] = c;
      });
      return next;
    };
    if (target.kind === 'hero') {
      setHeroCards((prev) => write(prev));
    } else if (target.kind === 'flop') {
      setFlopCards((prev) => write(prev));
    } else if (target.kind === 'turn') {
      setTurnCard(cards[0]);
    } else if (target.kind === 'river') {
      setRiverCard(cards[0]);
    } else {
      setOpponentCards((prev) => {
        const pair = prev[target.playerId!] ? [...prev[target.playerId!]] : [undefined, undefined];
        cards.forEach((c, j) => {
          pair[target.startIndex + j] = c;
        });
        return { ...prev, [target.playerId!]: pair };
      });
    }
    setPickerTarget(null);
  }, []);

  const pickerDisabledCards = useMemo(() => {
    if (!pickerTarget) return usedCards;
    const group = getGroupArray(pickerTarget.kind, pickerTarget.playerId);
    const editing: Card[] = [];
    for (let j = 0; j < pickerTarget.slots; j += 1) {
      const c = group[pickerTarget.startIndex + j];
      if (c) editing.push(c);
    }
    return usedCards.filter((c) => !editing.some((e) => cardsEqual(e, c)));
  }, [pickerTarget, usedCards, getGroupArray]);

  const pickerLabel = useMemo(() => {
    if (!pickerTarget) return undefined;
    if (pickerTarget.kind === 'hero') return 'Mes cartes';
    if (pickerTarget.kind === 'flop') return 'Flop';
    if (pickerTarget.kind === 'turn') return 'Turn';
    if (pickerTarget.kind === 'river') return 'River';
    return `Cartes de ${players.find((p) => p.id === pickerTarget.playerId)?.name ?? ''}`;
  }, [pickerTarget, players]);

  const startRound = useCallback(
    (street: Street) => {
      const eligible = players.filter((p) => !p.isFolded && !allInIds.has(p.id));
      setRound({ street, toAct: eligible.map((p) => p.id), lastAggressorId: undefined });
    },
    [players, allInIds]
  );

  const recordAction = useCallback(
    (street: Street, playerId: string, type: ActionType, amount?: number) => {
      actionCounter.current += 1;
      const order = actions.filter((a) => a.street === street).length;
      const newAction: HandAction = { id: `a${actionCounter.current}`, street, playerId, type, amount, order };
      setActions((prev) => [...prev, newAction]);

      let updatedPlayers = players;
      let updatedAllIn = allInIds;

      if (type === 'fold') {
        updatedPlayers = players.map((p) => (p.id === playerId ? { ...p, isFolded: true, foldedOnStreet: street } : p));
        setPlayers(updatedPlayers);
        const stillActive = updatedPlayers.filter((p) => !p.isFolded);
        if (stillActive.length <= 1) {
          setWinnerId(stillActive[0]?.id);
          setRound(null);
          setStep(4);
          return;
        }
      }

      if (type === 'allin') {
        updatedAllIn = new Set(allInIds).add(playerId);
        setAllInIds(updatedAllIn);
      }

      setRound((prev) => {
        if (!prev || prev.street !== street) return prev;
        if (type === 'bet' || type === 'raise' || type === 'allin') {
          const reopened = reopenQueueFrom(updatedPlayers, playerId, updatedAllIn);
          return { street, toAct: reopened, lastAggressorId: playerId };
        }
        return { ...prev, toAct: prev.toAct.filter((id) => id !== playerId) };
      });
    },
    [actions, players, allInIds]
  );

  const availableActionsFor = useCallback((): ActionType[] => {
    return round?.lastAggressorId ? ['fold', 'call', 'raise', 'allin'] : ['fold', 'check', 'bet', 'allin'];
  }, [round]);

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
  }, [step, round, boardPhase]);

  const goNext = () => setStep((s) => s + 1);
  const goBack = () => (step > 0 ? setStep((s) => s - 1) : router.back());

  const reset = () => {
    setStep(0);
    setPlayers(makePlayers(3));
    setActions([]);
    setHeroCards([undefined, undefined]);
    setFlopCards([undefined, undefined, undefined]);
    setTurnCard(undefined);
    setRiverCard(undefined);
    setOpponentReveal({});
    setOpponentCards({});
    setWinnerId(undefined);
    setWinningHandDescription('');
    setCustomTitle('');
    setCustomStakes('');
    setAllInIds(new Set());
    setBoardPhase('flop');
    setRound(null);
  };

  const computeAutoTitle = useCallback((): string => {
    const finalStreet = riverCard ? 'River' : turnCard ? 'Turn' : flopCards.every(Boolean) ? 'Flop' : 'Preflop';
    const heroShort = heroCards[0] && heroCards[1] ? `${heroCards[0].rank}${heroCards[1].rank}` : '';
    const revealedOpponent = activePlayers.find(
      (p) => !p.isHero && opponentReveal[p.id] && opponentCards[p.id]?.[0] && opponentCards[p.id]?.[1]
    );
    if (heroShort && revealedOpponent) {
      const pair = opponentCards[revealedOpponent.id]!;
      return `${heroShort} vs ${pair[0]!.rank}${pair[1]!.rank} — ${finalStreet}`;
    }
    if (heroShort) {
      const opponentCount = Math.max(activePlayers.length - 1, 0);
      return `${heroShort} vs ${opponentCount} joueur${opponentCount > 1 ? 's' : ''} — ${finalStreet}`;
    }
    return `Main — ${finalStreet}`;
  }, [heroCards, flopCards, turnCard, riverCard, activePlayers, opponentReveal, opponentCards]);

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
      const result: HandPlayer['result'] = p.id === winnerId ? 'won' : p.isFolded ? 'folded' : winnerId ? 'lost' : 'unknown';
      return { ...p, holeCards, cardsKnown, result };
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
      pots: computePots(actions),
      winnerId,
      winningHandDescription: winningHandDescription.trim() || undefined,
    };
  }, [players, heroCards, opponentReveal, opponentCards, winnerId, customTitle, computeAutoTitle, customStakes, flopCards, turnCard, riverCard, actions, winningHandDescription]);

  const handleReplay = () => {
    setDraft(buildHandHistory());
    router.push('/hand-replayer/play');
  };

  const handleExport = () => {
    setDraft(buildHandHistory());
    router.push({ pathname: '/hand-replayer/play', params: { skip: '1' } });
  };

  const canContinue = () => {
    if (step === 0) return players.length >= 2;
    if (step === 1) return !!heroCards[0] && !!heroCards[1];
    if (step === 2) return !!round && round.street === 'preflop' && round.toAct.length === 0;
    if (step === 3) return boardPhase === 'river' && !!riverCard && !!round && round.street === 'river' && round.toAct.length === 0;
    return true;
  };

  const renderBettingRound = (street: Street) => {
    if (!round || round.street !== street) return null;
    const doneActions = actions.filter((a) => a.street === street).sort((a, b) => a.order - b.order);

    if (round.toAct.length === 0 && doneActions.length === 0) {
      return (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Tous les joueurs restants sont all-in — plus aucune décision à prendre, la main se termine au tapis.
        </Text>
      );
    }

    const currentId = round.toAct[0];
    const currentPlayer = currentId ? players.find((p) => p.id === currentId) : undefined;
    const queuedIds = round.toAct.slice(1);

    return (
      <View style={styles.actionsList}>
        {doneActions.map((a) => {
          const p = players.find((pp) => pp.id === a.playerId);
          return (
            <View key={a.id} style={styles.actedRow}>
              <Text style={[styles.actedText, { color: colors.textSecondary }]}>
                {p?.name} — {ACTION_LABELS[a.type]}
                {a.amount ? ` ${a.amount}€` : ''}
              </Text>
            </View>
          );
        })}
        {currentPlayer && (
          <PlayerActionRow
            player={currentPlayer}
            availableActions={availableActionsFor()}
            onAction={(type, amount) => recordAction(street, currentPlayer.id, type, amount)}
          />
        )}
        {queuedIds.map((id) => {
          const p = players.find((pp) => pp.id === id);
          return p ? <QueuedPlayerRow key={id} player={p} /> : null;
        })}
      </View>
    );
  };

  const cardsForPhase = (phase: 'flop' | 'turn' | 'river'): Card[] => {
    if (phase === 'flop') return flopCards.filter(Boolean) as Card[];
    if (phase === 'turn') return turnCard ? [turnCard] : [];
    return riverCard ? [riverCard] : [];
  };

  const actionsSummaryFor = (street: Street): string => {
    const streetActions = actions.filter((a) => a.street === street).sort((a, b) => a.order - b.order);
    if (!streetActions.length) return '';
    return streetActions
      .map((a) => {
        const p = players.find((pp) => pp.id === a.playerId);
        return `${p?.name ?? '?'} ${ACTION_LABELS[a.type]}${a.amount ? ` ${a.amount}€` : ''}`;
      })
      .join(' · ');
  };

  const renderBoardStep = () => {
    const phaseIndex = BOARD_PHASES.indexOf(boardPhase);
    return (
      <View style={styles.stepBody}>
        {BOARD_PHASES.slice(0, phaseIndex).map((phase) => (
          <View key={phase} style={styles.completedPhase}>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>{PHASE_LABELS[phase as 'flop' | 'turn' | 'river']}</Text>
            <View style={styles.cardsRow}>
              {cardsForPhase(phase as 'flop' | 'turn' | 'river').map((c, i) => (
                <PlayingCard key={i} card={c} size="sm" />
              ))}
            </View>
            {actionsSummaryFor(phase) ? (
              <Text style={[styles.actedText, { color: colors.textSecondary }]}>{actionsSummaryFor(phase)}</Text>
            ) : null}
          </View>
        ))}

        <Animated.View key={boardPhase} entering={FadeInDown.springify().damping(18).stiffness(140)} style={styles.stepBody}>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>{PHASE_LABELS[boardPhase]}</Text>
          <View style={styles.cardsRow}>
            {boardPhase === 'flop' &&
              [0, 1, 2].map((i) => <CardSlot key={i} card={flopCards[i]} onPress={() => openPicker('flop', i)} />)}
            {boardPhase === 'turn' && <CardSlot card={turnCard} onPress={() => openPicker('turn', 0)} />}
            {boardPhase === 'river' && <CardSlot card={riverCard} onPress={() => openPicker('river', 0)} />}
          </View>
          {boardPhaseCardsReady(boardPhase) && renderBettingRound(boardPhase)}
        </Animated.View>
      </View>
    );
  };

  const renderShowdownStep = () => {
    const previewHand = buildHandHistory();
    return (
      <View style={styles.stepBody}>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>Cartes adverses connues et gagnant.</Text>
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
                      {revealed ? 'Cartes connues' : 'Cartes inconnues'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {revealed && (
                  <View style={styles.cardsRow}>
                    <CardSlot card={pair[0]} onPress={() => openPicker('opponent', 0, p.id)} />
                    <CardSlot card={pair[1]} onPress={() => openPicker('opponent', 1, p.id)} />
                  </View>
                )}
              </View>
            );
          })}

        <Text style={[styles.hint, { color: colors.textSecondary, marginTop: spacing.md }]}>Qui remporte la main ?</Text>
        <View style={styles.winnerRow}>
          {activePlayers.map((p) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => setWinnerId(p.id)}
              style={[
                styles.winnerChip,
                { borderColor: colors.hairline, backgroundColor: colors.neutralTileBg },
                winnerId === p.id && { borderColor: colors.accent, backgroundColor: colors.accentTint },
              ]}
              activeOpacity={0.7}
            >
              <Text style={[styles.winnerChipText, { color: winnerId === p.id ? colors.accent : colors.textSecondary }]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          value={winningHandDescription}
          onChangeText={setWinningHandDescription}
          placeholder="Description (ex : Paire d'As)"
          placeholderTextColor={colors.textTertiary}
          style={[styles.descInput, { color: colors.textPrimary, borderColor: colors.hairline, backgroundColor: colors.surface.fieldBg }]}
        />

        <TextInput
          value={customTitle}
          onChangeText={setCustomTitle}
          placeholder={`Titre (optionnel) — ex : ${computeAutoTitle()}`}
          placeholderTextColor={colors.textTertiary}
          style={[styles.descInput, { color: colors.textPrimary, borderColor: colors.hairline, backgroundColor: colors.surface.fieldBg }]}
        />
        <TextInput
          value={customStakes}
          onChangeText={setCustomStakes}
          placeholder="Enjeux (optionnel, ex : 1€/2€)"
          placeholderTextColor={colors.textTertiary}
          style={[styles.descInput, { color: colors.textPrimary, borderColor: colors.hairline, backgroundColor: colors.surface.fieldBg }]}
        />

        <View style={styles.previewWrap}>
          <HandRecapCard hand={previewHand} />
        </View>

        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]} onPress={handleReplay} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Rejouer la main</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, { backgroundColor: colors.neutralTileBg }]}
          onPress={handleExport}
          activeOpacity={0.85}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>Exporter l'image</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: colors.neutralTileBg }]} onPress={reset} activeOpacity={0.85}>
          <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>Recommencer</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepBody}>
            <Stepper
              label="Joueurs"
              value={players.length}
              min={2}
              max={9}
              onDecrement={() => setPlayers((prev) => resizePlayers(prev, Math.max(2, prev.length - 1)))}
              onIncrement={() => setPlayers((prev) => resizePlayers(prev, Math.min(9, prev.length + 1)))}
            />
            <View style={styles.playerList}>
              {players.map((p) => (
                <View key={p.id} style={[styles.playerRow, { borderColor: colors.hairline, backgroundColor: colors.surface.fieldBg }]}>
                  <TouchableOpacity
                    onPress={() => setPlayers((prev) => prev.map((pp) => ({ ...pp, isHero: pp.id === p.id })))}
                    activeOpacity={0.7}
                  >
                    <Star
                      size={20}
                      color={p.isHero ? colors.accent : colors.textTertiary}
                      fill={p.isHero ? colors.accent : 'transparent'}
                      strokeWidth={1.5}
                    />
                  </TouchableOpacity>
                  <TextInput
                    value={p.name}
                    onChangeText={(text) => setPlayers((prev) => prev.map((pp) => (pp.id === p.id ? { ...pp, name: text } : pp)))}
                    style={[styles.nameInput, { color: colors.textPrimary }]}
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              ))}
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepBody}>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>Sélectionnez vos deux cartes.</Text>
            <View style={styles.cardsRow}>
              <CardSlot card={heroCards[0]} onPress={() => openPicker('hero', 0)} />
              <CardSlot card={heroCards[1]} onPress={() => openPicker('hero', 1)} />
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepBody}>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>Actions preflop, dans l'ordre.</Text>
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
        <Text style={[styles.title, { color: colors.textPrimary }]}>{STEP_TITLES[step]}</Text>
      </View>

      <View style={styles.dots}>
        {STEP_TITLES.map((_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i <= step ? colors.accent : colors.hairline }]} />
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.springify().damping(18).stiffness(140)}>{renderStep()}</Animated.View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {step < 4 && (
        <View style={[styles.footer, { borderTopColor: colors.hairline }]}>
          <TouchableOpacity
            style={[styles.primaryBtn, !canContinue() && styles.disabledBtn, { backgroundColor: colors.accentBright }]}
            onPress={goNext}
            disabled={!canContinue()}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Continuer</Text>
          </TouchableOpacity>
        </View>
      )}

      <CardPicker
        visible={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        onComplete={(cards) => pickerTarget && applyCards(pickerTarget, cards)}
        disabledCards={pickerDisabledCards}
        slots={pickerTarget?.slots ?? 1}
        label={pickerLabel}
      />
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
  cardsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  emptySlot: {
    width: 64,
    height: 90,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
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
