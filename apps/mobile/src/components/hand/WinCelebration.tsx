import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  Keyframe,
  ZoomIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { TABLE } from './PokerTable';
import { fontFamily, fontSize, radius, shadow } from '../../design-system/theme';

const CONFETTI_COLORS = [TABLE.gold, '#F2EFE8', '#38D39F', '#E4574F'];
const CONFETTI_COUNT = 22;
const DISPLAY_MS = 2600;

interface Props {
  // Size of the table the overlay covers — drives ray length and confetti spread.
  width: number;
  height: number;
  title: string;
  subtitle?: string;
  detail?: string;
  // Clip radius of the overlay — defaults to the PokerTable racetrack shape; pass 0 (or a
  // small radius) when covering a rectangular area.
  borderRadius?: number;
  // Fired once the overlay has faded itself out — unmount it here.
  onDone: () => void;
}

// Deterministic pseudo-random spread (golden angle) — no Math.random, so every burst looks
// intentional and re-renders don't reshuffle particles mid-flight.
function confettiFor(i: number, width: number, height: number) {
  const angle = i * 2.399963 + 0.7;
  const speed = 0.28 + (((i * 37) % 23) / 23) * 0.5;
  return {
    dx: Math.cos(angle) * width * speed,
    dy: Math.sin(angle) * height * 0.4 * speed,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: (i % 7) * 40,
  };
}

function Confetto({ i, width, height }: { i: number; width: number; height: number }) {
  const { dx, dy, color, delay } = confettiFor(i, width, height);
  const burst = new Keyframe({
    0: { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 0.4 }] },
    12: {
      opacity: 1,
      transform: [{ translateX: dx * 0.35 }, { translateY: dy * 0.35 }, { rotate: '140deg' }, { scale: 1 }],
    },
    100: {
      opacity: 0,
      transform: [{ translateX: dx }, { translateY: dy + height * 0.35 }, { rotate: '560deg' }, { scale: 0.9 }],
    },
  })
    .duration(1600)
    .delay(delay);
  return <Animated.View entering={burst} style={[styles.confetto, { backgroundColor: color }]} />;
}

// Slowly rotating sunburst of tapered gold beams behind the badge.
function Rays({ size }: { size: number }) {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 9000, easing: Easing.linear }), -1);
  }, [rotation]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return (
    <Animated.View
      entering={ZoomIn.duration(350)}
      style={[styles.raysWrap, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, spin]}>
        {[0, 30, 60, 90, 120, 150].map((deg) => (
          <View key={deg} style={[styles.ray, { height: size, left: size / 2 - 14, transform: [{ rotate: `${deg}deg` }] }]}>
            <LinearGradient colors={['transparent', 'rgba(231, 195, 111, 0.26)', 'transparent']} style={styles.rayFill} />
          </View>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

// Casino-style "big win" burst over a PokerTable: the felt dims, gold rays sweep, confetti
// pops, and the title badge punches in. Purely decorative — pointer events pass through —
// and it fades itself out after a beat, then calls onDone.
export function WinCelebration({ width, height, title, subtitle, detail, borderRadius, onDone }: Props) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: 220 }),
      withDelay(
        DISPLAY_MS,
        withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) }, (finished) => {
          if (finished) runOnJS(onDone)();
        })
      )
    );
  }, [opacity, onDone]);
  const rootStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.root, { borderRadius: borderRadius ?? width / 2 }, rootStyle]}
    >
      <View style={styles.dim} />
      <Rays size={Math.max(width, height) * 1.15} />
      {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
        <Confetto key={i} i={i} width={width} height={height} />
      ))}
      <Animated.View entering={ZoomIn.springify().damping(9).stiffness(160).delay(60)} style={styles.badge}>
        <LinearGradient
          colors={['#20222A', '#101116']}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={styles.badgeCard}
        >
          <Text style={styles.badgeTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.badgeSubtitle}>{subtitle}</Text> : null}
          {detail ? <Text style={styles.badgeDetail}>{detail}</Text> : null}
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4, 8, 6, 0.72)',
  },
  raysWrap: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  ray: {
    position: 'absolute',
    top: 0,
    width: 28,
  },
  rayFill: {
    flex: 1,
  },
  confetto: {
    position: 'absolute',
    left: '50%',
    top: '45%',
    width: 9,
    height: 6,
    borderRadius: 2,
    marginLeft: -4,
  },
  badge: {
    maxWidth: '92%',
    paddingHorizontal: 12,
  },
  badgeCard: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...shadow.dark,
  },
  badgeTitle: {
    fontSize: 34,
    fontFamily: fontFamily.display,
    letterSpacing: 5,
    color: TABLE.gold,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  badgeSubtitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
    color: TABLE.plateText,
    textAlign: 'center',
  },
  badgeDetail: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
    color: 'rgba(231, 195, 111, 0.85)',
  },
});
