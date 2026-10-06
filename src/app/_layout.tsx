import { Chivo_700Bold, Chivo_800ExtraBold } from '@expo-google-fonts/chivo';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/hanken-grotesk';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors } from '@/constants/theme';
import { authStorage, convex } from '@/lib/convex';
import { SavedProvider } from '@/state/saved';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.accent,
    background: Colors.canvas,
    card: Colors.canvas,
    text: Colors.text,
    border: Colors.border,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Chivo_700Bold,
    Chivo_800ExtraBold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <ConvexAuthProvider client={convex} storage={authStorage}>
      <ThemeProvider value={theme}>
        <SavedProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.canvas } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="event/[id]" />
            <Stack.Screen name="publish" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="login" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          </Stack>
        </SavedProvider>
      </ThemeProvider>
    </ConvexAuthProvider>
  );
}
