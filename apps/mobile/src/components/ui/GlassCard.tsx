import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { radius, shadow } from '../../design-system/theme';

type Variant = 'default' | 'gold' | 'dark';

interface GlassCardProps {
  children: React.ReactNode;
  variant?: Variant;
  style?: ViewStyle;
  padding?: number;
}

export function GlassCard({ children, variant = 'default', style, padding = 16 }: GlassCardProps) {
  const containerStyle = [
    styles.base,
    variant === 'gold' && styles.gold,
    variant === 'dark' && styles.dark,
    { padding },
    style,
  ];

  const blurIntensity = variant === 'gold' ? 55 : variant === 'dark' ? 65 : 40;

  if (Platform.OS === 'ios') {
    return (
      <View style={[containerStyle, styles.overflow]}>
        <BlurView intensity={blurIntensity} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[styles.innerBorder, variant === 'gold' && styles.innerBorderGold]} />
        <View style={styles.inner}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[containerStyle, styles.androidFallback]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(10, 10, 15, 0.65)',
    ...shadow.card,
  },
  overflow: {
    overflow: 'hidden',
  },
  inner: {
    flex: 1,
  },
  innerBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  innerBorderGold: {
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  gold: {
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'rgba(10, 10, 15, 0.82)',
  },
  dark: {
    backgroundColor: 'rgba(10, 10, 15, 0.92)',
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  androidFallback: {
    backgroundColor: 'rgba(12, 12, 18, 0.93)',
  },
});
