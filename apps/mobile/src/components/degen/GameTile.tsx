import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '../ui/GlassCard';
import { Pill } from '../ui/Pill';
import { fontFamily, fontSize } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

interface Props {
  name: string;
  description: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
  onPress?: () => void;
  // Remplace le libellé du pill par défaut (Découvrir / Bientôt) — ex. tuiles tracker du dashboard.
  pillLabel?: string;
}

export function GameTile({ name, description, icon, comingSoon = true, onPress, pillLabel }: Props) {
  const { t } = useTranslation('degen');
  const { colors } = useTheme();

  const content = (
    <GlassCard padding={14} style={{ opacity: comingSoon ? 0.6 : 1 }}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: colors.neutralTileBg }]}>{icon}</View>
        <Text
          style={[styles.name, { color: colors.textPrimary }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {name}
        </Text>
        <Text style={[styles.description, { color: colors.textTertiary }]} numberOfLines={2}>{description}</Text>
        {pillLabel ? (
          <Pill label={pillLabel} tone="accent" style={styles.pill} />
        ) : comingSoon ? (
          <Pill label={t('tile.comingSoon')} style={styles.pill} />
        ) : (
          <Pill label={t('tile.discover')} tone="accent" style={styles.pill} />
        )}
      </View>
    </GlassCard>
  );

  return (
    <View style={styles.wrap}>
      {onPress ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.85}>{content}</TouchableOpacity>
      ) : (
        content
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '48%',
  },
  content: {
    alignItems: 'center',
    gap: 6,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  name: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
  },
  description: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    // Fixed two-line box (not minHeight): every tile matches whether its description wraps
    // or not, so the grid rows stay even. One line truncated most of them; dropping the tab
    // bar gave back the height that cost.
    lineHeight: 15,
    height: 30,
  },
  pill: {
    marginTop: 2,
    alignSelf: 'center',
  },
});
