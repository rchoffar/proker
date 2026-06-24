export const colors: Record<string, string> = {
  // Background layers
  bgBase: '#0A0A0F',
  bgElevated: '#111118',
  bgOverlay: '#1A1A25',

  // Glass
  glass: 'rgba(255, 255, 255, 0.06)',
  glassHover: 'rgba(255, 255, 255, 0.09)',
  glassStrong: 'rgba(255, 255, 255, 0.12)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassBorderGold: 'rgba(255, 215, 0, 0.20)',
  glassGoldFill: 'rgba(255, 215, 0, 0.06)',

  // Accent
  gold: '#FFD700',
  goldSoft: '#E6C200',
  goldGlow: 'rgba(255, 215, 0, 0.15)',

  // Semantic
  profit: '#00C878',
  profitBg: 'rgba(0, 200, 120, 0.10)',
  loss: '#FF4757',
  lossBg: 'rgba(255, 71, 87, 0.10)',
  warning: '#FF9F43',
  neutral: '#8A8A9A',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#8A8A9A',
  textTertiary: '#5A5A6E',
  textInverse: '#0A0A0F',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

export const fontSize = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 36,
  '4xl': 48,
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  gold: {
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;
