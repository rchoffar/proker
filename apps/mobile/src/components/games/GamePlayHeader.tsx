import type { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Home, X } from 'lucide-react-native';
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
  /** Up one level — the game's own setup screen. */
  onClose: () => void;
  /**
   * Straight to the home screen. Two clicks to get home was the complaint; ❌ alone could
   * only ever mean one of the two, and going up a level is the more useful one because the
   * roster is still there.
   */
  onHome?: () => void;
  /** Right slot — a round/hand badge, say. The empty slot still reserves as much as the
   *  left side holds, so the title stays centred on the row rather than shifting between
   *  screens. */
  right?: ReactNode;
  onDark?: boolean;
}

export function GamePlayHeader({ title, onClose, onHome, right, onDark = false }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation('games');
  const iconColor = onDark ? colors.onDarkSecondary : colors.textSecondary;
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        <GameIconButton onPress={onClose} onDark={onDark}>
          <X size={18} color={iconColor} strokeWidth={2} />
        </GameIconButton>
        {onHome && (
          <GameIconButton onPress={onHome} onDark={onDark} accessibilityLabel={t('play.goHome')}>
            <Home size={17} color={iconColor} strokeWidth={2} />
          </GameIconButton>
        )}
      </View>
      <Text
        style={[styles.headerTitle, { color: onDark ? colors.onDarkPrimary : colors.textPrimary }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <View style={[styles.headerSide, styles.headerRight, onHome && styles.headerRightWide]}>{right}</View>
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
  headerSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Mirrors whatever the left side holds, or the title stops being centred: one button is
  // 32pt, two are 32 + gap + 32.
  headerRight: {
    minWidth: 32,
    justifyContent: 'flex-end',
  },
  headerRightWide: {
    minWidth: 32 + spacing.sm + 32,
  },
});
