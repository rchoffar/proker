import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { SearchCreateList } from '../ui/PickerField';
import { PlayerNameCard } from './PlayerNameCard';
import { TABLE } from '../hand/PokerTable';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Player } from '../../types';

// The shared player roster of every game setup screen: a strip of felt with the selected
// players lying on it as cards (mockup 00000980), plus the search/create picker below.
// Owns the query state and the add/remove plumbing — screens just hold `selected`.

const CARD_W = 72;

interface Props {
  // Every known player (store) — the picker proposes the ones not yet selected.
  players: Player[];
  selected: Player[];
  onChange: (selected: Player[]) => void;
  // Called when the picker creates a brand-new name (screens persist it to the store on start).
  maxPlayers?: number;
}

export function RosterSection({ players, selected, onChange, maxPlayers }: Props) {
  const { t } = useTranslation('games');
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  const atMax = maxPlayers !== undefined && selected.length >= maxPlayers;

  const add = (player: Player) => {
    if (atMax) return;
    if (!selected.some((p) => p.id === player.id)) onChange([...selected, player]);
    setQuery('');
  };

  const remove = (id: string) => onChange(selected.filter((p) => p.id !== id));

  const availableNames = players
    .filter((p) => !selected.some((s) => s.id === p.id))
    .map((p) => p.name);

  // Empty roster shows a few dashed slots instead of a sentence — the affordance IS the felt.
  const placeholders = Math.max(1, Math.min(3, (maxPlayers ?? 3) - selected.length));

  return (
    <View style={styles.stack}>
      <LinearGradient colors={[TABLE.feltTop, TABLE.feltMid, TABLE.feltBottom]} style={styles.felt}>
        <View style={styles.cardGrid}>
          {selected.map((p, i) => (
            <PlayerNameCard
              key={p.id}
              name={p.name}
              color={colors.calendarPalette[i % colors.calendarPalette.length]}
              width={CARD_W}
              onRemove={() => remove(p.id)}
            />
          ))}
          {!atMax &&
            Array.from({ length: selected.length === 0 ? placeholders : 1 }, (_, i) => (
              <PlayerNameCard
                key={`slot-${i}`}
                placeholder
                placeholderLabel={i === 0 ? t('setup.addPlayer') : undefined}
                width={CARD_W}
              />
            ))}
        </View>
      </LinearGradient>

      {atMax ? (
        <Text style={[styles.maxText, { color: colors.textTertiary }]}>{t('setup.maxPlayersReached')}</Text>
      ) : (
        <SearchCreateList
          items={availableNames}
          selected=""
          query={query}
          onQueryChange={setQuery}
          onSelect={(name) => {
            const existing = players.find((p) => p.name === name);
            if (existing) add(existing);
          }}
          onCreate={(name) => add({ id: `p-${Date.now()}`, name })}
          placeholder={t('setup.searchPlaceholder')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  felt: {
    borderRadius: radius['2xl'],
    borderWidth: 2,
    borderColor: TABLE.railEdge,
    padding: spacing.base,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    minHeight: Math.round(72 * (90 / 64)),
  },
  maxText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
});
