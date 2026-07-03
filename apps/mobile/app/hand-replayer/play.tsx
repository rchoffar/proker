import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet, Dimensions, NativeSyntheticEvent, NativeTouchEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FlipInEasyY } from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';
import type { ViewShotRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { X, Play, Pause, Share2, Download } from 'lucide-react-native';
import { PlayingCard } from '../../src/components/hand/PlayingCard';
import { HandRecapCard } from '../../src/components/hand/HandRecapCard';
import { GlowBlob } from '../../src/components/ui/GlowBlob';
import { useHandReplayerDraft } from '../../src/store/useHandReplayerDraft';
import { fontFamily, fontSize, radius, spacing } from '../../src/design-system/theme';
import { useTheme } from '../../src/design-system/ThemeProvider';
import { initials } from '../../src/lib/format';
import type { HandAction, HandHistory, Street } from '../../src/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const AUTOPLAY_INTERVAL = 1800;

type Beat =
  | { kind: 'intro' }
  | { kind: 'heroCards' }
  | { kind: 'streetCards'; street: Street }
  | { kind: 'action'; action: HandAction }
  | { kind: 'result' };

const STREET_LABELS: Record<Street, string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
};

const ACTION_LABELS: Record<string, string> = {
  fold: 'se couche',
  check: 'check',
  call: 'suit',
  bet: 'mise',
  raise: 'relance',
  allin: 'part all-in',
};

function buildBeats(hand: HandHistory): Beat[] {
  const beats: Beat[] = [{ kind: 'intro' }, { kind: 'heroCards' }];
  const streets: Street[] = ['preflop', 'flop', 'turn', 'river'];
  streets.forEach((street) => {
    if (street === 'flop' && hand.board.flop) beats.push({ kind: 'streetCards', street });
    if (street === 'turn' && hand.board.turn) beats.push({ kind: 'streetCards', street });
    if (street === 'river' && hand.board.river) beats.push({ kind: 'streetCards', street });
    hand.actions
      .filter((a) => a.street === street)
      .sort((a, b) => a.order - b.order)
      .forEach((action) => beats.push({ kind: 'action', action }));
  });
  beats.push({ kind: 'result' });
  return beats;
}

export default function HandReplayerPlayScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const hand = useHandReplayerDraft((s) => s.hand);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const viewShotRef = useRef<ViewShotRef>(null);

  const beats = useMemo(() => (hand ? buildBeats(hand) : []), [hand]);
  const lastIndex = beats.length - 1;

  useEffect(() => {
    if (!playing) return;
    if (index >= lastIndex) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setIndex((i) => Math.min(i + 1, lastIndex)), AUTOPLAY_INTERVAL);
    return () => clearTimeout(timer);
  }, [playing, index, lastIndex]);

  if (!hand) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <Text style={{ color: colors.textPrimary }}>Aucune main à rejouer.</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.primaryBtn, { backgroundColor: colors.accentBright, marginTop: spacing.base }]}>
          <Text style={styles.primaryBtnText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const foldedIds = new Set(
    beats
      .slice(0, index + 1)
      .filter((b): b is { kind: 'action'; action: HandAction } => b.kind === 'action' && b.action.type === 'fold')
      .map((b) => b.action.playerId)
  );

  const heroRevealed = index >= 1;
  const streetRevealed = (street: Street) => beats.slice(0, index + 1).some((b) => b.kind === 'streetCards' && b.street === street);
  const isResult = beats[index]?.kind === 'result';

  const hero = hand.players.find((p) => p.isHero);
  const winner = hand.winnerId ? hand.players.find((p) => p.id === hand.winnerId) : undefined;
  const currentBeat = beats[index];

  const handleTap = (e: NativeSyntheticEvent<NativeTouchEvent>) => {
    setPlaying(false);
    const x = e.nativeEvent.locationX;
    if (x < SCREEN_WIDTH * 0.35) {
      setIndex((i) => Math.max(0, i - 1));
    } else {
      setIndex((i) => Math.min(lastIndex, i + 1));
    }
  };

  const captureAndShare = async () => {
    const uri = await viewShotRef.current?.capture?.();
    if (uri) await Sharing.shareAsync(uri);
  };

  const captureAndSave = async () => {
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) return;
    const uri = await viewShotRef.current?.capture?.();
    if (uri) await MediaLibrary.saveToLibraryAsync(uri);
  };

  const renderCaption = () => {
    if (currentBeat?.kind === 'action') {
      const player = hand.players.find((p) => p.id === currentBeat.action.playerId);
      const label = ACTION_LABELS[currentBeat.action.type] ?? currentBeat.action.type;
      const amount = currentBeat.action.amount ? ` (${currentBeat.action.amount}€)` : '';
      return `${player?.name ?? '?'} ${label}${amount}`;
    }
    if (currentBeat?.kind === 'streetCards') return STREET_LABELS[currentBeat.street];
    if (currentBeat?.kind === 'heroCards') return 'Mes cartes';
    if (currentBeat?.kind === 'intro') return hand.title ?? 'La main commence';
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
            <View key={i} style={[styles.progressSeg, { backgroundColor: i <= index ? colors.accent : colors.hairline }]} />
          ))}
        </View>
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
            <HandRecapCard hand={hand} />
          </ViewShot>
          <View style={styles.resultActions}>
            <TouchableOpacity style={[styles.shareBtn, { backgroundColor: colors.accentBright }]} onPress={captureAndShare} activeOpacity={0.85}>
              <Share2 size={16} color="#0A0A0F" strokeWidth={2} />
              <Text style={styles.shareBtnText}>Partager</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.shareBtn, { backgroundColor: colors.neutralTileBg }]} onPress={captureAndSave} activeOpacity={0.85}>
              <Download size={16} color={colors.textPrimary} strokeWidth={2} />
              <Text style={[styles.shareBtnText, { color: colors.textPrimary }]}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Pressable style={styles.tableArea} onPress={handleTap}>
          <Animated.Text key={`caption-${index}`} entering={FadeInDown.duration(300)} style={[styles.caption, { color: colors.textPrimary }]}>
            {renderCaption()}
          </Animated.Text>

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

          {heroRevealed && hero?.holeCards && (
            <Animated.View entering={FlipInEasyY.duration(450)} style={styles.heroRow}>
              <PlayingCard card={hero.holeCards[0]} size="lg" />
              <PlayingCard card={hero.holeCards[1]} size="lg" />
            </Animated.View>
          )}

          <View style={styles.seats}>
            {hand.players.map((p) => {
              const folded = foldedIds.has(p.id);
              return (
                <Animated.View key={p.id} entering={FadeIn.duration(300)} style={[styles.seat, folded && styles.seatFolded]}>
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: colors.neutralTileBg },
                      p.isHero && { borderWidth: 2, borderColor: colors.accent },
                    ]}
                  >
                    <Text style={[styles.avatarText, { color: colors.textSecondary }]}>{initials(p.name)}</Text>
                  </View>
                  <Text style={[styles.seatName, { color: colors.textSecondary }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  {folded && <Text style={[styles.foldedLabel, { color: colors.loss }]}>Couché</Text>}
                </Animated.View>
              );
            })}
          </View>

          <Text style={[styles.tapHint, { color: colors.textTertiary }]}>Toucher pour continuer</Text>
        </Pressable>
      )}

      {isResult && (
        <View style={styles.resultBanner}>
          {winner && <GlowBlob color={colors.accentGlow} size={220} top={-60} right={-40} />}
          {winner ? (
            <Text style={[styles.resultWinner, { color: colors.accent }]}>{winner.name} remporte la main</Text>
          ) : (
            <Text style={[styles.resultWinner, { color: colors.textSecondary }]}>Main terminée</Text>
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
  progressSeg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  tableArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing.base,
  },
  caption: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.display,
    textAlign: 'center',
  },
  boardRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 64,
  },
  heroRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  seats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.base,
  },
  seat: {
    alignItems: 'center',
    gap: 4,
    width: 64,
  },
  seatFolded: {
    opacity: 0.35,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
  },
  seatName: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
  },
  foldedLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
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
