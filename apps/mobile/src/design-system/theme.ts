export const colors: Record<string, string> = {
  // Backgrounds (light)
  bgBase: '#FFFFFF',
  bgElevated: '#F5F5F7',
  bgOverlay: '#EBEBEE',

  // Dark glass (cards on white background)
  glass: 'rgba(10, 10, 15, 0.72)',
  glassHover: 'rgba(10, 10, 15, 0.80)',
  glassStrong: 'rgba(10, 10, 15, 0.90)',
  glassBorder: 'rgba(255, 255, 255, 0.14)',
  glassBorderStrong: 'rgba(255, 255, 255, 0.22)',

  // Semantic
  profit: '#00C878',
  profitBg: 'rgba(0, 200, 120, 0.15)',
  loss: '#FF4757',
  lossBg: 'rgba(255, 71, 87, 0.15)',
  warning: '#FF9F43',
  neutral: '#8A8A9A',

  // Text — inside dark cards
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.58)',
  textTertiary: 'rgba(255, 255, 255, 0.32)',

  // Text — on white background
  textOnLight: '#0A0A0F',
  textOnLightSecondary: '#6B6B7E',
  textOnLightTertiary: '#9A9AAC',

  // Actions
  textInverse: '#FFFFFF',
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
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;
