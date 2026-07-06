import { Fragment, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Text as SvgText, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { fontFamily, fontSize } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Player } from '../../types';

const SPIN_DURATION = 3500;
const SPIN_TURNS = 7;
const TICK_STYLE = Haptics.ImpactFeedbackStyle.Light;
const LAND_TYPE = Haptics.NotificationFeedbackType.Success;

// Classic clay poker-chip colors — fixed regardless of app theme, like the app's other
// "physical object" color pairs (playing cards), so the chip reads the same in light/dark mode.
const CHIP_EDGE_LIGHT = '#F4EFE6';
const CHIP_EDGE_DARK = '#23252B';
const CHIP_EDGE_SEGMENTS = 20;

function triggerTick() {
  Haptics.impactAsync(TICK_STYLE);
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

/** Donut-shaped segment between innerR/outerR — used for the poker-chip edge spots. */
function describeAnnulusSegment(cx: number, cy: number, innerR: number, outerR: number, startAngle: number, endAngle: number) {
  const outerStart = polarToCartesian(cx, cy, outerR, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${outerStart.x} ${outerStart.y} A ${outerR} ${outerR} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${innerR} ${innerR} 0 ${largeArcFlag} 1 ${innerStart.x} ${innerStart.y} Z`;
}

function truncate(name: string, max: number) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function labelFontSize(count: number) {
  if (count <= 6) return fontSize.sm;
  if (count <= 10) return fontSize.xs;
  return 8;
}

/** Picks a random winner and the next (always-increasing) rotation that lands its slice under the fixed top pointer. */
function computeSpin(currentRotation: number, sliceCount: number) {
  const winnerIndex = Math.floor(Math.random() * sliceCount);
  const sliceAngle = 360 / sliceCount;
  const midAngle = winnerIndex * sliceAngle + sliceAngle / 2;
  const targetMod = (((360 - midAngle) % 360) + 360) % 360;
  const currentMod = ((currentRotation % 360) + 360) % 360;
  const delta = ((targetMod - currentMod) % 360 + 360) % 360;
  const rotation = currentRotation + SPIN_TURNS * 360 + delta;
  return { winnerIndex, rotation, sliceAngle };
}

interface RouletteWheelProps {
  players: Player[];
  /** Increment to trigger a new spin. 0 means "not spun yet". */
  spinToken: number;
  onResult: (player: Player) => void;
  size?: number;
}

export function RouletteWheel({ players, spinToken, onResult, size = 280 }: RouletteWheelProps) {
  const { colors } = useTheme();
  const rotation = useSharedValue(0);
  const sliceAngleShared = useSharedValue(360 / Math.max(players.length, 1));
  const lastTickSlice = useSharedValue(0);

  const n = Math.max(players.length, 1);
  const sliceAngle = 360 / n;
  const radius = size / 2;
  const rimWidth = size * 0.09;
  const pieRadius = radius - rimWidth;
  const edgeSpots = Array.from({ length: CHIP_EDGE_SEGMENTS }, (_, i) => i).filter((i) => i % 2 === 0);

  useEffect(() => {
    if (spinToken === 0 || players.length < 2) return;

    const { winnerIndex, rotation: target, sliceAngle: sa } = computeSpin(rotation.value, players.length);
    const winner = players[winnerIndex];
    sliceAngleShared.value = sa;
    lastTickSlice.value = Math.floor(rotation.value / sa);
    triggerTick();

    rotation.value = withTiming(
      target,
      { duration: SPIN_DURATION, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(Haptics.notificationAsync)(LAND_TYPE);
          runOnJS(onResult)(winner);
        }
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinToken]);

  useAnimatedReaction(
    () => rotation.value,
    (value) => {
      const currentSlice = Math.floor(value / sliceAngleShared.value);
      if (currentSlice !== lastTickSlice.value) {
        lastTickSlice.value = currentSlice;
        runOnJS(triggerTick)();
      }
    }
  );

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={[styles.wrap, { width: size, height: size + 20 }]}>
      <View style={[styles.pointer, { borderBottomColor: colors.textPrimary }]} />
      <Animated.View style={[{ width: size, height: size }, wheelStyle]}>
        <Svg width={size} height={size}>
          {/* Poker-chip rim: cream base + alternating dark edge spots, classic clay-chip look */}
          <Circle cx={radius} cy={radius} r={radius - 1} fill={CHIP_EDGE_LIGHT} />
          {edgeSpots.map((i) => {
            const segAngle = 360 / CHIP_EDGE_SEGMENTS;
            const start = i * segAngle;
            return (
              <Path
                key={`edge-${i}`}
                d={describeAnnulusSegment(radius, radius, pieRadius + 3, radius - 3, start, start + segAngle)}
                fill={CHIP_EDGE_DARK}
              />
            );
          })}
          <Circle cx={radius} cy={radius} r={pieRadius + 1} fill="none" stroke={CHIP_EDGE_LIGHT} strokeWidth={3} />

          {players.map((player, i) => {
            const start = i * sliceAngle;
            const end = start + sliceAngle;
            const mid = start + sliceAngle / 2;
            const labelPos = polarToCartesian(radius, radius, pieRadius * 0.6, mid);
            const flip = mid > 90 && mid < 270;
            const sliceIsLight = i % 2 === 0;
            return (
              <Fragment key={player.id}>
                <Path
                  d={describeSlice(radius, radius, pieRadius, start, end)}
                  fill={sliceIsLight ? CHIP_EDGE_LIGHT : CHIP_EDGE_DARK}
                  stroke={CHIP_EDGE_DARK}
                  strokeWidth={1.5}
                />
                <SvgText
                  x={labelPos.x}
                  y={labelPos.y}
                  dy={4}
                  fill={sliceIsLight ? CHIP_EDGE_DARK : CHIP_EDGE_LIGHT}
                  fontSize={labelFontSize(players.length)}
                  fontFamily={fontFamily.semibold}
                  textAnchor="middle"
                  rotation={flip ? mid + 180 : mid}
                  origin={`${labelPos.x}, ${labelPos.y}`}
                >
                  {truncate(player.name, 12)}
                </SvgText>
              </Fragment>
            );
          })}
          <Circle cx={radius} cy={radius} r={size * 0.07} fill={CHIP_EDGE_DARK} />
          <Circle cx={radius} cy={radius} r={size * 0.07} fill="none" stroke={CHIP_EDGE_LIGHT} strokeWidth={2} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    zIndex: 1,
  },
});
