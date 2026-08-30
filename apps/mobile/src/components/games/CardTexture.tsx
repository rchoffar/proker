import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import { radius } from '../../design-system/theme';

// A card back's pattern, for the flat colour fills the roulette deals players. Mathieu on
// those cards: "ça me paraît bizarre" — a coloured rectangle does not read as a card, and a
// real card back is a repeated motif rather than a single mark.
//
// The motif is the app's chip, at PokerChip's proportions so it reads as the same mark. The
// whole grid is ONE Skia canvas: PokerChip draws a canvas per chip, and a card holds enough
// tiles that a canvas each would be dozens of surfaces per card, times nine cards on the
// felt. Purely decorative — it sits behind the name and never takes a touch.

const TILE = 30;
const CHIP = 22;
// PokerChip's geometry, so the watermark and the real chip are the same drawing.
const OUTER_R = CHIP / 2 - 2;
const INNER_R = OUTER_R * 0.62;
const DOT_R = CHIP * 0.055;
const DOT_ORBIT = OUTER_R * 0.84;
const EDGE_DOTS = 8;

const DOTS = Array.from({ length: EDGE_DOTS }, (_, i) => {
  const angle = (i / EDGE_DOTS) * Math.PI * 2;
  return { key: i, dx: DOT_ORBIT * Math.cos(angle), dy: DOT_ORBIT * Math.sin(angle) };
});

interface Props {
  width: number;
  height: number;
  /** Ink for the motif. Defaults to white, for the coloured cards; the roulette's cream
   *  winner twin needs a dark one or the pattern vanishes into the card. */
  color?: string;
}

export function CardTexture({ width, height, color = 'rgba(255,255,255,0.18)' }: Props) {
  const cols = Math.ceil(width / TILE) + 1;
  const rows = Math.ceil(height / TILE) + 1;

  const chips = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Alternate rows shift half a tile, like a brick course — a square grid reads as a
      // table rather than a pattern.
      chips.push({
        key: `${r}-${c}`,
        cx: c * TILE + (r % 2 === 1 ? TILE / 2 : 0) - TILE / 4,
        cy: r * TILE - TILE / 4,
      });
    }
  }

  return (
    <View style={styles.layer} pointerEvents="none">
      <Canvas style={{ width, height }}>
        {chips.map((chip) => (
          <Group key={chip.key} transform={[{ translateX: chip.cx }, { translateY: chip.cy }]}>
            <Circle cx={0} cy={0} r={OUTER_R} color={color} style="stroke" strokeWidth={1.4} />
            <Circle cx={0} cy={0} r={INNER_R} color={color} style="stroke" strokeWidth={1} />
            {DOTS.map((d) => (
              <Circle key={d.key} cx={d.dx} cy={d.dy} r={DOT_R} color={color} />
            ))}
          </Group>
        ))}
      </Canvas>
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
});
