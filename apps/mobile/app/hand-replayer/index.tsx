import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, Star, Eye, EyeOff } from 'lucide-react-native';
import { Stepper } from '../../src/components/ui/Stepper';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { PlayingCard } from '../../src/components/hand/PlayingCard';
import { CardPicker } from '../../src/components/hand/CardPicker';
import { PlayerActionRow } from '../../src/components/hand/PlayerActionRow';
import { useHandReplayerDraft } from '../../src/store/useHandReplayerDraft';
import { fontFamily, fontSize, radius, spacing } from '../../src/design-system/theme';
import { useTheme } from '../../src/design-system/ThemeProvider';
import type { ActionType, Card, HandAction, HandHistory, HandPlayer, PotState, Street } from '../../src/types';

const STEP_TITLES = ['Joueurs', 'Mes cartes', 'Preflop', 'Flop', 'Turn', 'River', 'Showdown', 'Récap'];

type PickerTarget =
  | { kind: 'hero'; index: 0 | 1 }
  | { kind: 'flop'; index: 0 | 1 | 2 }
  | { kind: 'turn' }
  | { kind: 'river' }
  | { kind: 'opponent'; playerId: string; index: 0 | 1 };

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
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [allInIds, setAllInIds] = useState<Set<string>>(new Set());

  const activePlayers = useMemo(() => players.filter((p) => !p.isFolded), [players]);
  // Once a player is all-in they have no more decisions to make on later streets —
  // only players who are still active AND not all-in can be prompted for an action.
  const playersNeedingAction = useMemo(() => activePlayers.filter((p) => !allInIds.has(p.id)), [activePlayers, allInIds]);

  const usedCards = useMemo(() => {
    const list: Card[] = [];
    heroCards.forEach((c) => c && list.push(c));
    flopCards.forEach((c) => c && list.push(c));
    if (turnCard) list.push(turnCard);
    if (riverCard) list.push(riverCard);
    Object.values(opponentCards).forEach((pair) => pair.forEach((c) => c && list.push(c)));
    return list;
  }, [heroCards, flopCards, turnCard, riverCard, opponentCards]);

  const getTargetCard = useCallback(
    (target: PickerTarget): Card | undefined => {
      if (target.kind === 'hero') return heroCards[target.index];
      if (target.kind === 'flop') return flopCards[target.index];
      if (target.kind === 'turn') return turnCard;
      if (target.kind === 'river') return riverCard;
      return opponentCards[target.playerId]?.[target.index];
    },
    [heroCards, flopCards, turnCard, riverCard, opponentCards]
  );

  const applyCard = useCallback((target: PickerTarget, card: Card) => {
    if (target.kind === 'hero') {
      setHeroCards((prev) => {
        const next = [...prev];
        next[target.index] = card;
        return next;
      });
    } else if (target.kind === 'flop') {
      setFlopCards((prev) => {
        const next = [...prev];
        next[target.index] = card;
        return next;
      });
    } else if (target.kind === 'turn') {
      setTurnCard(card);
    } else if (target.kind === 'river') {
      setRiverCard(card);
    } else {
      setOpponentCards((prev) => {
        const pair = prev[target.playerId] ? [...prev[target.playerId]] : [undefined, undefined];
        pair[target.index] = card;
        return { ...prev, [target.playerId]: pair };
      });
    }
    setPickerTarget(null);
  }, []);

  const recordAction = useCallback(
    (street: Street, playerId: string, type: ActionType, amount?: number) => {
      actionCounter.current += 1;
      const order = actions.filter((a) => a.street === street).length;
      const newAction: HandAction = { id: `a${actionCounter.current}`, street, playerId, type, amount, order };
      setActions((prev) => [...prev, newAction]);

      if (type === 'fold') {
        const updatedPlayers = players.map((p) => (p.id === playerId ? { ...p, isFolded: true, foldedOnStreet: street } : p));
        setPlayers(updatedPlayers);
        const stillActive = updatedPlayers.filter((p) => !p.isFolded);
        if (stillActive.length <= 1) {
          setWinnerId(stillActive[0]?.id);
          setStep(7);
        }
      }

      if (type === 'allin') {
        setAllInIds((prev) => new Set(prev).add(playerId));
      }
    },
    [actions, players]
  );

  const hasActed = useCallback((street: Street, playerId: string) => actions.some((a) => a.street === street && a.playerId === playerId), [actions]);

  const allActed = useCallback(
    (street: Street) => activePlayers.length > 0 && playersNeedingAction.every((p) => hasActed(street, p.id)),
    [activePlayers, playersNeedingAction, hasActed]
  );

  const availableActionsFor = useCallback(
    (street: Street): ActionType[] => {
      const streetActions = actions.filter((a) => a.street === street);
      const facingBet = streetActions.some((a) => a.type === 'bet' || a.type === 'raise' || a.type === 'allin');
      return facingBet ? ['fold', 'call', 'raise', 'allin'] : ['fold', 'check', 'bet', 'allin'];
    },
    [actions]
  );

  const goNext = () => {
    if (step === 5 && activePlayers.length < 2) {
      setStep(7);
      return;
    }
    setStep((s) => s + 1);
  };
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
    setAllInIds(new Set());
  };

  const buildHandHistory = (): HandHistory => {
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
      gameType: 'NLH',
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
  };

  const handleReplay = () => {
    setDraft(buildHandHistory());
    router.push('/hand-replayer/play');
  };

  const canContinue = () => {
    if (step === 0) return players.length >= 2;
    if (step === 1) return !!heroCards[0] && !!heroCards[1];
    if (step === 2) return allActed('preflop');
    if (step === 3) return flopCards.every(Boolean) && allActed('flop');
    if (step === 4) return !!turnCard && allActed('turn');
    if (step === 5) return !!riverCard && (activePlayers.length < 2 || allActed('river'));
    return true;
  };

  const renderActionsList = (street: Street) => {
    if (playersNeedingAction.length === 0) {
      return (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Tous les joueurs restants sont all-in — plus aucune décision à prendre, la main se termine au tapis.
        </Text>
      );
    }
    return (
      <View style={styles.actionsList}>
        {playersNeedingAction.map((p) => {
          if (hasActed(street, p.id)) {
            const act = actions.find((a) => a.street === street && a.playerId === p.id);
            return (
              <View key={p.id} style={styles.actedRow}>
                <Text style={[styles.actedText, { color: colors.textSecondary }]}>
                  {p.name} — {act?.type}
                  {act?.amount ? ` ${act.amount}€` : ''}
                </Text>
              </View>
            );
          }
          return (
            <PlayerActionRow
              key={p.id}
              player={p}
              availableActions={availableActionsFor(street)}
              onAction={(type, amount) => recordAction(street, p.id, type, amount)}
            />
          );
        })}
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
              <CardSlot card={heroCards[0]} onPress={() => setPickerTarget({ kind: 'hero', index: 0 })} />
              <CardSlot card={heroCards[1]} onPress={() => setPickerTarget({ kind: 'hero', index: 1 })} />
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepBody}>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>Actions preflop, dans l'ordre.</Text>
            {renderActionsList('preflop')}
          </View>
        );

      case 3:
        return (
          <View style={styles.stepBody}>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>Le flop.</Text>
            <View style={styles.cardsRow}>
              {[0, 1, 2].map((i) => (
                <CardSlot key={i} card={flopCards[i]} onPress={() => setPickerTarget({ kind: 'flop', index: i as 0 | 1 | 2 })} />
              ))}
            </View>
            {flopCards.every(Boolean) && renderActionsList('flop')}
          </View>
        );

      case 4:
        return (
          <View style={styles.stepBody}>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>Le turn.</Text>
            <View style={styles.cardsRow}>
              <CardSlot card={turnCard} onPress={() => setPickerTarget({ kind: 'turn' })} />
            </View>
            {turnCard && renderActionsList('turn')}
          </View>
        );

      case 5:
        return (
          <View style={styles.stepBody}>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>La river.</Text>
            <View style={styles.cardsRow}>
              <CardSlot card={riverCard} onPress={() => setPickerTarget({ kind: 'river' })} />
            </View>
            {riverCard && renderActionsList('river')}
          </View>
        );

      case 6:
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
                        <CardSlot card={pair[0]} onPress={() => setPickerTarget({ kind: 'opponent', playerId: p.id, index: 0 })} />
                        <CardSlot card={pair[1]} onPress={() => setPickerTarget({ kind: 'opponent', playerId: p.id, index: 1 })} />
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
          </View>
        );

      case 7:
      default:
        return (
          <View style={styles.stepBody}>
            <GlassCard padding={20}>
              <Text style={[styles.recapTitle, { color: colors.textPrimary }]}>Main prête</Text>
              <Text style={[styles.recapLine, { color: colors.textSecondary }]}>{players.length} joueurs</Text>
              <Text style={[styles.recapLine, { color: colors.textSecondary }]}>{actions.length} actions enregistrées</Text>
              {winnerId ? (
                <Text style={[styles.recapLine, { color: colors.accent }]}>
                  Gagnant : {players.find((p) => p.id === winnerId)?.name}
                </Text>
              ) : null}
            </GlassCard>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]} onPress={handleReplay} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Rejouer la main</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: colors.neutralTileBg }]} onPress={reset} activeOpacity={0.85}>
              <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>Recommencer</Text>
            </TouchableOpacity>
          </View>
        );
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
          <View
            key={i}
            style={[styles.dot, { backgroundColor: i <= step ? colors.accent : colors.hairline }]}
          />
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.springify().damping(18).stiffness(140)}>{renderStep()}</Animated.View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {step < 7 && (
        <View style={[styles.footer, { borderTopColor: colors.hairline, backgroundColor: colors.surface.sheetBg }]}>
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
        onSelect={(card) => pickerTarget && applyCard(pickerTarget, card)}
        disabledCards={pickerTarget ? usedCards.filter((c) => {
          const current = getTargetCard(pickerTarget);
          return !current || c.rank !== current.rank || c.suit !== current.suit;
        }) : usedCards}
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
  recapTitle: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
    marginBottom: spacing.sm,
  },
  recapLine: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    marginBottom: 4,
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
