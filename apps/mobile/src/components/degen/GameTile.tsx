import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
}

export function GameTile({ name, description, icon, comingSoon = true, onPress }: Props) {
  const { colors } = useTheme();

  const content = (
    <GlassCard padding={18} style={{ opacity: comingSoon ? 0.6 : 1 }}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: colors.neutralTileBg }]}>{icon}</View>
        <Text style={[styles.name, { color: colors.textPrimary }]}>{name}</Text>
        <Text style={[styles.description, { color: colors.textTertiary }]} numberOfLines={2}>{description}</Text>
        {comingSoon ? (
          <Pill label="Bientôt disponible" style={styles.pill} />
        ) : (
          <Pill label="Découvrir" tone="accent" style={styles.pill} />
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
    minHeight: 28,
  },
  pill: {
    marginTop: 4,
    alignSelf: 'center',
  },
});
