import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react-native';
import { TABLE } from '../hand/PokerTable';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

// Card wrapping the acting player's zone (big board, placement editor, draw controls):
// gold border + name/chips header so whose board it is reads at a glance — the acting
// player's seat leaves the strip, this panel replaces it.

interface Props {
  name: string;
  chips: number;
  isButton: boolean;
  inFantasyLand?: boolean;
  children: ReactNode;
}

const DARK_CARD_BG = 'rgba(255, 255, 255, 0.05)';

export function OfcActorPanel({ name, chips, isButton, inFantasyLand = false, children }: Props) {
  const { t } = useTranslation('ofc');
  const { colors } = useTheme();

  return (
    <View style={[styles.panel, { backgroundColor: DARK_CARD_BG, borderColor: TABLE.gold }]}>
      <View style={styles.header}>
        {isButton && (
          <View style={[styles.buttonBadge, { backgroundColor: TABLE.gold }]}>
            <Text style={styles.buttonBadgeText}>{t('game.buttonBadge')}</Text>
          </View>
        )}
        <Text style={[styles.name, { color: colors.onDarkPrimary }]} numberOfLines={1}>
          {name}
        </Text>
        {inFantasyLand && <Sparkles size={14} color={TABLE.gold} strokeWidth={2} />}
        <Text style={[styles.chips, { color: colors.onDarkSecondary }]}>
          {t('game.chips', { count: chips })}
        </Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  buttonBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBadgeText: {
    color: '#0A0A0F',
    fontSize: 10,
    fontFamily: fontFamily.extrabold,
  },
  name: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    flexShrink: 1,
  },
  chips: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    marginLeft: 'auto',
  },
});
