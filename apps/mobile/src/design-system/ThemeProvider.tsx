import { createContext, useContext, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getColors, spacing, radius, fontFamily, fontSize, shadow, type ColorScheme } from './theme';

interface ThemeValue {
  scheme: ColorScheme;
  colors: ReturnType<typeof getColors>;
  spacing: typeof spacing;
  radius: typeof radius;
  fontFamily: typeof fontFamily;
  fontSize: typeof fontSize;
  shadow: typeof shadow;
  setScheme: (scheme: ColorScheme) => void;
  toggleScheme: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const settings = useAppStore((s) => s.user.settings);
  const updateUser = useAppStore((s) => s.updateUser);
  const scheme: ColorScheme = settings.theme === 'dark' ? 'dark' : 'light';

  const value = useMemo<ThemeValue>(() => ({
    scheme,
    colors: getColors(scheme),
    spacing,
    radius,
    fontFamily,
    fontSize,
    shadow,
    setScheme: (next) => updateUser({ settings: { ...settings, theme: next } }),
    toggleScheme: () => updateUser({ settings: { ...settings, theme: scheme === 'dark' ? 'light' : 'dark' } }),
  }), [scheme, settings, updateUser]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
