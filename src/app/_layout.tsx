import { Chivo_700Bold, Chivo_800ExtraBold } from '@expo-google-fonts/chivo';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/hanken-grotesk';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { DialogProvider } from '@/components/dialog';
import { authStorage, convex } from '@/lib/convex';
import { ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Chivo_700Bold,
    Chivo_800ExtraBold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
  });

  if (!loaded && !error) return null;

  return (
    <ConvexAuthProvider client={convex} storage={authStorage}>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </ConvexAuthProvider>
  );
}

function ThemedApp() {
  const { colors, scheme, ready } = useTheme();

  // El splash se va recién con la preferencia leída: así no hay un destello del tema equivocado.
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // El fondo nativo (app.json lo deja oscuro) se ve en transiciones y al abrir el teclado.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.canvas);
  }, [colors.canvas]);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accentText,
      background: colors.canvas,
      card: colors.canvas,
      text: colors.text,
      border: colors.border,
    },
  };

  if (!ready) return null;

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="events/index" />
        <Stack.Screen name="interests" />
        <Stack.Screen name="publish" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="login" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="email" />
      </Stack>
      <DialogProvider />
    </NavigationThemeProvider>
  );
}
