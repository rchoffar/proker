import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Heart } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useEffect, useRef } from 'react';
import { useTheme } from '../../design-system/ThemeProvider';

interface LikeButtonProps {
  liked: boolean;
  onToggle: () => void;
  size?: number;
  tone?: 'light' | 'dark';
  style?: ViewStyle;
}

export function LikeButton({ liked, onToggle, size = 18, tone = 'light', style }: LikeButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    scale.value = withSpring(1.2, { damping: 8, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 10, stiffness: 260 });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only bounce on `liked` transitions, not on mount
  }, [liked]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const activeColor = tone === 'dark' ? colors.accentBright : colors.accent;
  const inactiveColor = tone === 'dark' ? colors.onDarkTertiary : colors.textTertiary;

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[styles.button, style]}
    >
      <Animated.View style={animatedStyle}>
        <Heart
          size={size}
          color={liked ? activeColor : inactiveColor}
          fill={liked ? activeColor : 'transparent'}
          strokeWidth={1.8}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
