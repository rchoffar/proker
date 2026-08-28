import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { X } from 'lucide-react-native';
import { fontFamily, fontSize, radius } from '../../design-system/theme';
import { TABLE } from '../hand/PokerTable';

// A player as a physical card lying on the felt — the shared visual for game setup
// rosters and the roulette draw. Fixed "physical object" colors, theme-invariant on
// purpose (same rationale as PlayingCard / PokerTable).

const CARD_RATIO = 90 / 64;

interface Props {
  name?: string;
  // Card background — callers usually feed colors.calendarPalette[i % length] so
  // simultaneous players are told apart at a glance.
  color?: string;
  width: number;
  onRemove?: () => void;
  // Dashed empty slot ("+ add a player") shown in setup rosters.
  placeholder?: boolean;
  placeholderLabel?: string;
  dimmed?: boolean;
  style?: ViewStyle | ViewStyle[];
}

export function PlayerNameCard({
  name,
  color = TABLE.plateBg,
  width,
  onRemove,
  placeholder = false,
  placeholderLabel,
  dimmed = false,
  style,
}: Props) {
  const height = Math.round(width * CARD_RATIO);

  if (placeholder) {
    return (
      <View style={[styles.card, styles.placeholder, { width, height }, style]}>
        <Text style={styles.placeholderPlus}>+</Text>
        {placeholderLabel ? <Text style={styles.placeholderText}>{placeholderLabel}</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.card, { width, height, backgroundColor: color }, dimmed && styles.dimmed, style]}>
      <Text style={styles.name} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
        {name}
      </Text>
      {onRemove ? (
        <TouchableOpacity
          style={styles.removeBadge}
          onPress={onRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <X size={11} color={TABLE.plateText} strokeWidth={2.5} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    // Bright light border like the mockup's cards — they must read as physical cards
    // against the felt, not tinted tiles.
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  name: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
    textAlign: 'center',
  },
  removeBadge: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  placeholder: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: 2,
  },
  placeholderPlus: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: fontSize.xl,
    fontFamily: fontFamily.regular,
    lineHeight: 26,
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontFamily: fontFamily.medium,
    textAlign: 'center',
  },
  dimmed: {
    opacity: 0.35,
  },
});
