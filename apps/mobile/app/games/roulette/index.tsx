import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, X } from 'lucide-react-native';
import { GlassCard } from '../../../src/components/ui/GlassCard';
import { PickerField, SearchCreateList } from '../../../src/components/ui/PickerField';
import { useAppStore } from '../../../src/store/useAppStore';
import { useRouletteDraft } from '../../../src/store/useRouletteDraft';
import { fontFamily, fontSize, radius, spacing } from '../../../src/design-system/theme';
import { useTheme } from '../../../src/design-system/ThemeProvider';
import type { Player } from '../../../src/types';

export default function RouletteSetupScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { players, addPlayer, rouletteLastPlayers, setRouletteLastPlayers } = useAppStore();
  const setDraftPlayers = useRouletteDraft((s) => s.setPlayers);

  const [selected, setSelected] = useState<Player[]>(rouletteLastPlayers);
  const [pickerExpanded, setPickerExpanded] = useState(false);
  const [query, setQuery] = useState('');

  const canSpin = selected.length >= 2;

  const addToSelection = (player: Player) => {
    setSelected((prev) => (prev.some((p) => p.id === player.id) ? prev : [...prev, player]));
    setQuery('');
    setPickerExpanded(false);
  };

  const removeFromSelection = (id: string) => {
    setSelected((prev) => prev.filter((p) => p.id !== id));
  };

  const availableNames = players
    .filter((p) => !selected.some((s) => s.id === p.id))
    .map((p) => p.name);

  const handleStart = () => {
    const newPlayers = selected.filter((p) => !players.some((existing) => existing.id === p.id));
    for (const p of newPlayers) addPlayer(p);
    setRouletteLastPlayers(selected);
    setDraftPlayers(selected);
    router.push('/games/roulette/play');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.neutralTileBg }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={18} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Roulette</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.stack}>
          <Animated.View entering={FadeInDown.delay(0).springify().damping(18).stiffness(140)}>
            <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
              Qui est à la table ? Ajoutez au moins 2 joueurs, la roue en désigne un pour payer l’addition.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}>
            <GlassCard padding={16}>
              <View style={styles.chipGrid}>
                {selected.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Aucun joueur pour l’instant</Text>
                ) : (
                  selected.map((p) => (
                    <View key={p.id} style={[styles.playerChip, { borderColor: colors.accent, backgroundColor: colors.accentTint }]}>
                      <Text style={[styles.playerChipText, { color: colors.accent }]}>{p.name}</Text>
                      <TouchableOpacity onPress={() => removeFromSelection(p.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <X size={13} color={colors.accent} strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)}>
            <PickerField
              label="Ajouter un joueur"
              value=""
              placeholder="Chercher ou créer un joueur…"
              expanded={pickerExpanded}
              onToggleExpand={() => setPickerExpanded((e) => !e)}
            >
              <SearchCreateList
                items={availableNames}
                selected=""
                query={query}
                onQueryChange={setQuery}
                onSelect={(name) => {
                  const existing = players.find((p) => p.name === name);
                  if (existing) addToSelection(existing);
                }}
                onCreate={(name) => addToSelection({ id: `p-${Date.now()}`, name })}
                placeholder="Chercher ou créer un joueur…"
              />
            </PickerField>
          </Animated.View>

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryBtn, !canSpin && styles.disabledBtn, { backgroundColor: colors.accentBright }]}
          onPress={handleStart}
          disabled={!canSpin}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Lancer la roulette</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
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
  headerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  stack: {
    gap: spacing.md,
  },
  subtitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    lineHeight: 18,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  playerChipText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
  },
  footer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  primaryBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
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
