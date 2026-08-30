import type { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';
import { fontFamily, fontSize, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { DARK_TILE } from './gameSurface';

// The bar every play screen puts above the felt: close on the left, title centred, an
// optional badge on the right. It was copy-pasted into eight files, which is how the same
// three style objects drifted apart — bluff had already fixed the centring bug the others
// still have, and its stylesheet says so in a comment pointing back at play.tsx.
//
// `onDark` picks the surface: the bluff/OFC screens paint their own dark background and use
// the theme-invariant onDark* tokens, while flip, roulette and the replayer view sit on the
// themed EnvironmentBackground.

interface IconButtonProps {
  onPress: () => void;
  disabled?: boolean;
  onDark?: boolean;
  /** Only needed where the icon alone doesn't name the action (the replayer's export). */
  accessibilityLabel?: string;
  children: ReactNode;
}

/** The 32x32 circular tile used by every play-screen header button. */
export function GameIconButton({
  onPress,
  disabled = false,
  onDark = false,
  accessibilityLabel,
  children,
}: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.iconBtn,
        { backgroundColor: onDark ? DARK_TILE : colors.neutralTileBg },
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </TouchableOpacity>
  );
}

interface Props {
  title: string;
  onClose: () => void;
  /** Right slot — a round/hand badge, say. The empty slot still reserves 32pt so the
   *  title stays centred on the row rather than shifting between screens. */
  right?: ReactNode;
  onDark?: boolean;
}

export function GamePlayHeader({ title, onClose, right, onDark = false }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <GameIconButton onPress={onClose} onDark={onDark}>
        <X size={18} color={onDark ? colors.onDarkSecondary : colors.textSecondary} strokeWidth={2} />
      </GameIconButton>
      <Text
        style={[styles.headerTitle, { color: onDark ? colors.onDarkPrimary : colors.textPrimary }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
    // Constrained + centered: the title used to be free-width in a space-between row and
    // collided with the round badge (whose 32px icon slot couldn't hold its text either).
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    minWidth: 32,
    alignItems: 'flex-end',
  },
});
