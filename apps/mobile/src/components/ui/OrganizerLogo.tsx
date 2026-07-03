import { View, Image, Text, StyleSheet } from 'react-native';
import { initials } from '../../lib/format';
import { fontFamily, fontSize } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Organizer } from '../../types';

const LOGO_MAP: Record<string, ReturnType<typeof require>> = {
  winamax: require('../../../assets/organizers/winamax.png'),
  pokerstars: require('../../../assets/organizers/pokerstars.png'),
  wpt: require('../../../assets/organizers/wpt.png'),
  barriere: require('../../../assets/organizers/barriere.png'),
  wsop: require('../../../assets/organizers/wsop.png'),
  ggpoker: require('../../../assets/organizers/ggpoker.png'),
  bsop: require('../../../assets/organizers/bsop.png'),
  sbm: require('../../../assets/organizers/sbm.png'),
};

interface Props {
  organizer?: Organizer;
  size?: number;
  tone?: 'light' | 'dark';
}

export function OrganizerLogo({ organizer, size = 24, tone = 'light' }: Props) {
  const { colors } = useTheme();
  const source = organizer?.logo ? LOGO_MAP[organizer.logo] : undefined;

  const wrapStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderColor: tone === 'dark' ? colors.onDarkHairline : colors.hairline,
  };

  if (source) {
    return (
      <View style={[styles.wrap, wrapStyle]}>
        <Image source={source} style={styles.image} resizeMode="cover" />
      </View>
    );
  }

  const fallbackBg = tone === 'dark' ? colors.onDarkHairline : colors.neutralTileBg;
  const fallbackTextColor = tone === 'dark' ? colors.onDarkPrimary : colors.textSecondary;

  return (
    <View style={[styles.wrap, styles.fallback, wrapStyle, { backgroundColor: fallbackBg }]}>
      <Text style={[styles.fallbackText, { color: fallbackTextColor, fontSize: size * 0.4 }]} numberOfLines={1}>
        {organizer ? initials(organizer.name) : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontFamily: fontFamily.bold,
  },
});
