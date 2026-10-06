import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { Button, Fade, Wordmark } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  // Auth isn't wired yet — every option drops you into the app.
  const enter = () => (router.canGoBack() ? router.back() : router.replace('/'));

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
          <Button label="Continuar con Google" variant="secondary" onPress={enter} />
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
