import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radius, shadow } from '../../design-system/theme';

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

  if (Platform.OS === 'ios') {
    return (
      <View style={[containerStyle, styles.overflow]}>
        <BlurView
          intensity={20}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.inner}>{children}</View>
      </View>
    );
  }

  // Android fallback: solid semi-transparent background
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
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    ...shadow.card,
  },
  overflow: {
    overflow: 'hidden',
  },
  inner: {
    flex: 1,
  },
  gold: {
    borderColor: colors.glassBorderGold,
    backgroundColor: colors.glassGoldFill,
  },
  dark: {
    backgroundColor: colors.bgElevated,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  androidFallback: {
    backgroundColor: 'rgba(17, 17, 24, 0.92)',
  },
});
