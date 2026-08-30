import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, radius } from '../../design-system/theme';

// A card back's pattern, for the flat colour fills the roulette deals players. Mathieu on
// those cards: "ça me paraît bizarre" — a coloured rectangle does not read as a card, and a
// real card back is a repeated motif rather than a single mark.
//
// Tiled UPK monograms at low opacity, rotated so the grid does not read as a table. Purely
// decorative: it sits behind the name and never takes a touch.

const TILE = 26;
const MONOGRAM = 'UPK';

interface Props {
  width: number;
  height: number;
  /** Ink for the monogram. Defaults to white, for the coloured cards; the roulette's cream
   *  winner twin needs a dark one or the pattern vanishes into the card. */
  color?: string;
}

export function CardTexture({ width, height, color }: Props) {
  const cols = Math.ceil(width / TILE) + 1;
  const rows = Math.ceil(height / TILE) + 1;

  return (
    <View style={styles.layer} pointerEvents="none">
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={styles.row}>
          {Array.from({ length: cols }, (_, c) => (
            // Alternate rows are offset half a tile, like a brick course.
            <Text key={c} style={[styles.mark, color ? { color } : null, r % 2 === 1 && styles.markOffset]}>
              {MONOGRAM}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderRadius: radius.lg,
  },
  row: {
    flexDirection: 'row',
    height: TILE,
    alignItems: 'center',
  },
  mark: {
    width: TILE,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.16)',
    fontSize: 9,
    fontFamily: fontFamily.extrabold,
    letterSpacing: 0.5,
    transform: [{ rotate: '-20deg' }],
  },
  markOffset: {
    marginLeft: TILE / 2,
  },
});
