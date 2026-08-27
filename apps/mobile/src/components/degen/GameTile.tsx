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
    <GlassCard padding={18} style={{ opacity: comingSoon ? 0.6 : 1 }}>
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
  },
  description: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    // Fixed 2-line box (not minHeight): every tile is the same height whether its
    // description wraps or not — grid rows used to come out uneven.
    lineHeight: 15,
    height: 30,
  },
  pill: {
    marginTop: 4,
    alignSelf: 'center',
  },
});
