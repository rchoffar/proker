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
const EDGE_DOTS = 8;

const UNIT_DOTS = Array.from({ length: EDGE_DOTS }, (_, i) => {
  const angle = (i / EDGE_DOTS) * Math.PI * 2;
  return { key: i, cos: Math.cos(angle), sin: Math.sin(angle) };
});

interface Props {
  width: number;
  height: number;
  /** Ink for the motif. Defaults to white, for the coloured cards; the roulette's cream
   *  winner twin needs a dark one or the pattern vanishes into the card. */
  color?: string;
  /**
   * Draw this many times larger and display it scaled back down. A Skia canvas is a
   * fixed-size surface, so a card that is later blown up by a transform magnifies those
   * pixels — the roulette's winner grows 2.4x and its hairline chips washed out. Pass the
   * factor the card will grow by and it is rasterised for the size it ends at.
   */
  superSample?: number;
}

export function CardTexture({ width, height, color = 'rgba(255,255,255,0.18)', superSample = 1 }: Props) {
  const ss = superSample;
  const canvasW = width * ss;
  const canvasH = height * ss;
  const tile = TILE * ss;
  const outerR = (CHIP * ss) / 2 - 2 * ss;
  const innerR = outerR * 0.62;
  const dotR = CHIP * ss * 0.055;
  const dotOrbit = outerR * 0.84;

  const chips = [];
  for (let r = 0; r < Math.ceil(canvasH / tile) + 1; r++) {
    for (let c = 0; c < Math.ceil(canvasW / tile) + 1; c++) {
      // Alternate rows shift half a tile, like a brick course — a square grid reads as a
      // table rather than a pattern.
      chips.push({
        key: `${r}-${c}`,
        cx: c * tile + (r % 2 === 1 ? tile / 2 : 0) - tile / 4,
        cy: r * tile - tile / 4,
      });
    }
  }

  return (
    <View style={styles.layer} pointerEvents="none">
      {/* Centred on the layer, so scaling about its middle lands it exactly on the card. */}
      <View
        style={{
          width: canvasW,
          height: canvasH,
          marginLeft: -(canvasW - width) / 2,
          marginTop: -(canvasH - height) / 2,
          transform: [{ scale: 1 / ss }],
        }}
      >
        <Canvas style={{ width: canvasW, height: canvasH }}>
          {chips.map((chip) => (
            <Group key={chip.key} transform={[{ translateX: chip.cx }, { translateY: chip.cy }]}>
              <Circle cx={0} cy={0} r={outerR} color={color} style="stroke" strokeWidth={1.4 * ss} />
              <Circle cx={0} cy={0} r={innerR} color={color} style="stroke" strokeWidth={1 * ss} />
              {UNIT_DOTS.map((d) => (
                <Circle key={d.key} cx={d.cos * dotOrbit} cy={d.sin * dotOrbit} r={dotR} color={color} />
              ))}
            </Group>
          ))}
        </Canvas>
      </View>
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
