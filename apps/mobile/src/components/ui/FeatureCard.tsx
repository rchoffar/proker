import type { ReactNode } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { GlassCard } from './GlassCard';
import { GlowBlob } from './GlowBlob';
import { PokerChip } from './PokerChip';
import { useTheme } from '../../design-system/ThemeProvider';

// The app's "this one matters" surface, first drawn for the featured festival on home: dark
// glass, a green glow bleeding from one corner, a chip watermark in the other. Four screens
// wanted the same three pieces stacked the same way, so it is a component rather than a
// recipe to remember.
//
// Contents must use the onDark* text tokens — `accent` is a deep emerald meant for light
// backgrounds and goes muddy here (`accentBright` is its counterpart).

interface Props {
  children: ReactNode;
  padding?: number;
  /** Corner the chip sits in. Bottom-right by default, as on the festival hero. */
  chipStyle?: ViewStyle;
  chipSize?: number;
  style?: ViewStyle;
}

export function FeatureCard({ children, padding = 20, chipStyle, chipSize = 80, style }: Props) {
  const { colors } = useTheme();

  return (
    <GlassCard variant="dark" padding={padding} style={StyleSheet.flatten([styles.card, style])}>
      <GlowBlob />
      <PokerChip size={chipSize} style={StyleSheet.flatten([styles.chip, chipStyle])} color={colors.onDarkHairline} />
      {children}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  chip: {
    position: 'absolute',
    bottom: -18,
    right: -14,
  },
});
