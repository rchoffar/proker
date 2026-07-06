import '../global.css';
import '../src/i18n';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
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

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { scheme } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <EnvironmentBackground />
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="tracker" />
        <Stack.Screen name="festival/[id]" />
        <Stack.Screen name="hand-replayer/index" />
        <Stack.Screen name="hand-replayer/play" options={{ presentation: 'modal' }} />
        <Stack.Screen name="games/roulette/index" />
        <Stack.Screen name="games/roulette/play" options={{ presentation: 'modal' }} />
        <Stack.Screen name="games/flip/index" />
        <Stack.Screen name="games/flip/play" options={{ presentation: 'modal' }} />
      </Stack>
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

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

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
