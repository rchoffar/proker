import '../global.css';
import '../src/i18n';
import { View } from 'react-native';
import { Stack, ThemeProvider as NavThemeProvider, DefaultTheme, DarkTheme } from 'expo-router';
import { useEffect, useMemo } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Jost_300Light } from '@expo-google-fonts/jost';
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  Geist_800ExtraBold,
} from '@expo-google-fonts/geist';
import { EnvironmentBackground } from '../src/components/ui/EnvironmentBackground';
import { ThemeProvider, useTheme } from '../src/design-system/ThemeProvider';
import { useAuthStore } from '../src/store/useAuthStore';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { scheme, colors } = useTheme();
  const status = useAuthStore((s) => s.status);
  const hasPseudo = useAuthStore((s) => !!s.user?.pseudo);
  // The native stack paints the navigation theme's background on its own
  // container, above the sibling EnvironmentBackground — it must be
  // transparent for the gradient to show through. Import the theme pieces
  // from expo-router (not @react-navigation/native): only its forked
  // exports share the context its navigators read.
  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, background: 'transparent' } };
  }, [scheme]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.screenBg }}>
      <EnvironmentBackground />
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <NavThemeProvider value={navTheme}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
          <Stack.Protected guard={status !== 'signedIn'}>
            <Stack.Screen name="login" />
          </Stack.Protected>
          <Stack.Protected guard={status === 'signedIn' && !hasPseudo}>
            <Stack.Screen name="choose-pseudo" />
          </Stack.Protected>
          <Stack.Protected guard={status === 'signedIn' && hasPseudo}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="festival/[id]" />
            <Stack.Screen name="hand-replayer/index" />
            <Stack.Screen name="hand-replayer/view" />
            <Stack.Screen name="hand-replayer/play" />
            <Stack.Screen name="games/roulette/index" />
            <Stack.Screen name="games/roulette/play" />
            <Stack.Screen name="games/flip/index" />
            <Stack.Screen name="games/flip/play" />
            <Stack.Screen name="games/bluff/index" />
            <Stack.Screen name="games/bluff/play" />
            <Stack.Screen name="games/bluff/online" />
            <Stack.Screen name="games/ofc/index" />
            <Stack.Screen name="games/ofc/play" />
            <Stack.Screen name="games/ofc/online" />
          </Stack.Protected>
        </Stack>
      </NavThemeProvider>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Jost_300Light,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    Geist_800ExtraBold,
  });
  const authStatus = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const ready = fontsLoaded && authStatus !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
