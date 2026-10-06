import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { Button, Fade, Wordmark } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/////////// @CONVEX ///////////
import { useAuthActions } from '@convex-dev/auth/react';

// A dónde vuelve el navegador después de Google: exp://<ip>:8081/--/ en Expo Go, gridd:/// en un build.
const redirectTo = Linking.createURL('/');

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuthActions();
  const [busy, setBusy] = useState(false);
  const enter = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const signInWithGoogle = async () => {
    setBusy(true);
    try {
      const { redirect } = await signIn('google', { redirectTo });
      if (Platform.OS === 'web' || !redirect) return; // en web el navegador redirige solo

      const result = await WebBrowser.openAuthSessionAsync(redirect.toString(), redirectTo);
      if (result.type !== 'success') return; // cerró el navegador

      const code = Linking.parse(result.url).queryParams?.code;
      if (typeof code !== 'string') throw new Error('Google no devolvió el código.');
      await signIn('google', { code });
      enter();
    } catch (error) {
      console.error(error);
      Alert.alert('No pudimos entrar con Google', 'Probá de nuevo en un rato.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.photo}>
        <Image source={require('@/assets/images/meets/login.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" />
        <Fade style={{ top: '30%' }} />
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Wordmark size={36} />
        <Text variant="display" style={styles.headline}>
          Todos los encuentros, en un solo lugar.
        </Text>

        <View style={styles.actions}>
          <Button label="Continuar con email" icon="mail" onPress={enter} />
          <Button label="Continuar con Google" variant="secondary" onPress={signInWithGoogle} disabled={busy} />
          <Pressable onPress={enter} style={styles.skip} hitSlop={8}>
            <Text variant="label" tone="secondary">
              Explorar sin cuenta
            </Text>
            <Icon name="arrow" size={16} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.canvas },
  photo: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  headline: { fontSize: 30, lineHeight: 34, textTransform: 'none' },
  actions: { gap: Spacing.md, marginTop: Spacing.md },
  skip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
  },
});
