import { Fragment, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Path,
  Text as SvgText,
  Circle,
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { fontFamily, fontSize, shadow } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Player } from '../../types';

const SPIN_DURATION = 7000;
// The wheel spins fast one way (flipping side on every spin) while the center arrow OSCILLATES:
// it swings one way, reverses, swings back, each pass slower, and settles onto the winner as the
// wheel's own deceleration ends — so the winner stays in doubt until the very end.
const WHEEL_TURNS_MIN = 6; // + 0..2 random extra turns → 6, 7 or 8
const WHEEL_TURNS_RANDOM = 3;
// Arrow swing amplitudes (degrees, ± random spread), shrinking each pass; the last leg is the
// slow settle onto the final angle. Durations must sum to SPIN_DURATION.
const SWING1 = 540;
const SWING1_RANDOM = 180; // first swing: 1.5–2 turns
const SWING2_PAST = 240;
const SWING2_RANDOM = 120; // second swing overshoots past the final angle
const SWING3_PAST = 100;
const SWING3_RANDOM = 60; // third swing overshoots slightly the other way
const SWING_DURATIONS = [1700, 1800, 1800, 1700];
const SWING_EASING = Easing.inOut(Easing.quad); // at rest at each reversal
const SETTLE_EASING = Easing.inOut(Easing.cubic); // slow start off the last reversal, long tail
const LAND_JITTER = 0.35; // land within the central 70% of the winning slice
// poly(1.8): the last third of the spin covers only ~14% of the distance — a long final crawl.
const SPIN_EASING = Easing.out(Easing.poly(1.8));
const MIN_TICK_INTERVAL_MS = 45; // haptic density cap during the fast launch phase
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
  if (count <= 6) return fontSize.md;
  if (count <= 10) return fontSize.sm;
  return fontSize.xs;
}

/**
 * Picks a random winner, a target rotation for the wheel (fast, `direction` flips every spin so
 * spins alternate left/right), and four oscillation waypoints for the arrow: a big swing opposite
 * the wheel, a reverse swing past the final angle, a smaller swing back past it again, then the
 * settle onto it. The invariant is relative: at rest, (needle − wheel) mod 360 must point into the
 * winning slice, jittered within its central 70% so it never rests ON a boundary. The wheel's own
 * final angle is fully random — only the relative angle encodes the winner.
 */
function computeSpin(currentWheel: number, currentNeedle: number, sliceCount: number, direction: 1 | -1) {
  const winnerIndex = Math.floor(Math.random() * sliceCount);
  const sliceAngle = 360 / sliceCount;
  const jitter = (Math.random() - 0.5) * 2 * LAND_JITTER;
  const landAngle = winnerIndex * sliceAngle + sliceAngle * (0.5 + jitter);

  const wheelTurns = WHEEL_TURNS_MIN + Math.floor(Math.random() * WHEEL_TURNS_RANDOM);
  const wheelTarget = currentWheel + direction * (wheelTurns * 360 + Math.random() * 360);

  // Arrow oscillation: first swing goes opposite the wheel (d), later swings alternate around the
  // final angle. Signs guarantee each leg reverses direction: d, −d, d, −d.
  const d = -direction;
  const needleFinal = currentNeedle + (((wheelTarget + landAngle - currentNeedle) % 360) + 360) % 360;
  const swing1 = currentNeedle + d * (SWING1 + Math.random() * SWING1_RANDOM);
  const swing2 = needleFinal - d * (SWING2_PAST + Math.random() * SWING2_RANDOM);
  const swing3 = needleFinal + d * (SWING3_PAST + Math.random() * SWING3_RANDOM);
  const needleWaypoints = [swing1, swing2, swing3, needleFinal];

  return { winnerIndex, wheelTarget, needleWaypoints, sliceAngle };
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
  const wheelRot = useSharedValue(0);
  const needleRot = useSharedValue(0);
  const sliceAngleShared = useSharedValue(360 / Math.max(players.length, 1));
  const lastTickSlice = useSharedValue(0);
  const lastTickTime = useSharedValue(0);
  // Tagged with the spin token so a new spin invalidates the highlight without an effect reset.
  const [landed, setLanded] = useState<{ token: number; index: number } | null>(null);

  const n = Math.max(players.length, 1);
  const sliceAngle = 360 / n;
  const radius = size / 2;
  const rimWidth = size * 0.09;
  const pieRadius = radius - rimWidth;
  const pegR = Math.min(5, Math.max(3, size * 0.014));
  const edgeSpots = Array.from({ length: CHIP_EDGE_SEGMENTS }, (_, i) => i).filter((i) => i % 2 === 0);

  useEffect(() => {
    if (spinToken === 0 || players.length < 2) return;

    // The wheel alternates left/right from one spin to the next; the arrow oscillates within the
    // spin, starting opposite the wheel.
    const direction = spinToken % 2 === 1 ? 1 : -1;
    const { winnerIndex, wheelTarget, needleWaypoints, sliceAngle: sa } = computeSpin(
      wheelRot.value,
      needleRot.value,
      players.length,
      direction
    );
    const winner = players[winnerIndex];
    sliceAngleShared.value = sa;
    lastTickSlice.value = Math.floor((needleRot.value - wheelRot.value) / sa);
    triggerTick();

    wheelRot.value = withTiming(wheelTarget, { duration: SPIN_DURATION, easing: SPIN_EASING });
    const [swing1, swing2, swing3, needleFinal] = needleWaypoints;
    needleRot.value = withSequence(
      withTiming(swing1, { duration: SWING_DURATIONS[0], easing: SWING_EASING }),
      withTiming(swing2, { duration: SWING_DURATIONS[1], easing: SWING_EASING }),
      withTiming(swing3, { duration: SWING_DURATIONS[2], easing: SWING_EASING }),
      withTiming(needleFinal, { duration: SWING_DURATIONS[3], easing: SETTLE_EASING }, (finished) => {
        if (finished) {
          runOnJS(Haptics.notificationAsync)(LAND_TYPE);
          runOnJS(setLanded)({ token: spinToken, index: winnerIndex });
          runOnJS(onResult)(winner);
        }
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinToken]);

  // Ticks fire on RELATIVE slice-boundary crossings — the arrow tip passing a peg of the wheel.
  useAnimatedReaction(
    () => needleRot.value - wheelRot.value,
    (rel) => {
      const currentSlice = Math.floor(rel / sliceAngleShared.value);
      if (currentSlice !== lastTickSlice.value) {
        lastTickSlice.value = currentSlice;
        const now = Date.now();
        if (now - lastTickTime.value >= MIN_TICK_INTERVAL_MS) {
          lastTickTime.value = now;
          runOnJS(triggerTick)();
        }
      }
    }
  );

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wheelRot.value}deg` }],
  }));

  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${needleRot.value}deg` }],
  }));

  const hubGradDef = (
    <RadialGradient id="hubGrad" cx="40%" cy="40%" r="70%">
      <Stop offset="0" stopColor="#2E313A" />
      <Stop offset="1" stopColor="#1B1D22" />
    </RadialGradient>
  );

  const landedIndex = landed !== null && landed.token === spinToken && landed.index < players.length ? landed.index : null;
  const winnerPath =
    landedIndex !== null
      ? describeSlice(radius, radius, pieRadius, landedIndex * sliceAngle, (landedIndex + 1) * sliceAngle)
      : null;

  // Spinner arrow geometry — slim, reaching ~70% of the pie so labels stay readable, with a small
  // counterweight tail past center.
  const tipR = pieRadius * 0.7;
  const needlePath = [
    `M ${radius} ${radius - tipR}`,
    `L ${radius + 5.5} ${radius - tipR * 0.32}`,
    `L ${radius + 3} ${radius + tipR * 0.18}`,
    `L ${radius - 3} ${radius + tipR * 0.18}`,
    `L ${radius - 5.5} ${radius - tipR * 0.32}`,
    'Z',
  ].join(' ');

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {/* Static circular backing carries the drop shadow — shadows on a rotating view are expensive. */}
      <View style={[styles.shadowDisc, { width: size, height: size, borderRadius: radius }]} />

      <Animated.View style={[{ width: size, height: size }, wheelStyle]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="pegGrad" cx="35%" cy="35%" r="75%">
              <Stop offset="0" stopColor="#F8F9FA" />
              <Stop offset="0.6" stopColor="#C7CBD2" />
              <Stop offset="1" stopColor="#8A8F99" />
            </RadialGradient>
            <RadialGradient id="rimDepth" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#000000" stopOpacity={0} />
              <Stop offset="0.86" stopColor="#000000" stopOpacity={0} />
              <Stop offset="0.94" stopColor="#000000" stopOpacity={0.1} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0.22} />
            </RadialGradient>
            <LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.14} />
              <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>

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
          <Circle cx={radius} cy={radius} r={radius - 1} fill="url(#rimDepth)" />
          <Circle cx={radius} cy={radius} r={radius - 1} fill="url(#sheen)" />
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

          {/* Pegs at slice boundaries — what the spinning arrow tip catches on */}
          {players.map((player, i) => {
            const p = polarToCartesian(radius, radius, pieRadius, i * sliceAngle);
            return (
              <Circle
                key={`peg-${player.id}`}
                cx={p.x}
                cy={p.y}
                r={pegR}
                fill="url(#pegGrad)"
                stroke={CHIP_EDGE_DARK}
                strokeWidth={0.8}
              />
            );
          })}
        </Svg>

        {/* Winner highlight — rotates with the wheel so it stays registered to the slices */}
        {winnerPath !== null && (
          <Animated.View entering={FadeIn.duration(250)} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width={size} height={size}>
              {players.map((player, i) => {
                if (i === landedIndex) return null;
                return (
                  <Path
                    key={`dim-${player.id}`}
                    d={describeSlice(radius, radius, pieRadius, i * sliceAngle, (i + 1) * sliceAngle)}
                    fill="rgba(10,10,15,0.5)"
                  />
                );
              })}
              <Path d={winnerPath} fill="none" stroke={colors.accentBright} strokeWidth={7} opacity={0.35} />
              <Path d={winnerPath} fill="none" stroke={colors.accentBright} strokeWidth={2.5} />
            </Svg>
          </Animated.View>
        )}
      </Animated.View>

      {/* Center-mounted arrow — spins around the hub independently of the wheel; default transform
          origin is the view center, which is exactly the wheel center. Last sibling on purpose:
          it must paint above the wheel WITHOUT zIndex, which iOS turns into a window-wide
          layer.zPosition that would poke through full-screen overlays like WinCelebration. */}
      <Animated.View style={[StyleSheet.absoluteFill, needleStyle]} pointerEvents="none">
        <Svg width={size} height={size}>
          <Defs>
            {hubGradDef}
            <LinearGradient id="needleGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#3A3D47" />
              <Stop offset="1" stopColor="#1B1D22" />
            </LinearGradient>
          </Defs>
          <Path d={needlePath} fill="url(#needleGrad)" stroke={CHIP_EDGE_LIGHT} strokeWidth={1.5} />
          {/* Hub cap over the arrow base — circular, so its rotation is invisible */}
          <Circle cx={radius} cy={radius} r={size * 0.075} fill="url(#hubGrad)" />
          <Circle cx={radius} cy={radius} r={size * 0.075} fill="none" stroke={CHIP_EDGE_LIGHT} strokeWidth={2} />
          <Circle cx={radius} cy={radius} r={size * 0.028} fill={CHIP_EDGE_LIGHT} />
          <Circle cx={radius} cy={radius} r={size * 0.01} fill={CHIP_EDGE_DARK} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  shadowDisc: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: CHIP_EDGE_LIGHT,
    ...shadow.dark,
  },
});
