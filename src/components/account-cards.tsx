import { Image, type ImageSource } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, View, type ImageStyle, type StyleProp } from 'react-native';

import { Text } from '@/components/text';
import { SectionHeader } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useMyCars } from '@/services/cars';
import { useAvatarUpload, useCurrentUser, useInterests, useUserMeets } from '@/services/user';
import { makeStyles, useTheme } from '@/theme';

type Step = {
  key: string;
  art: ImageSource;
  /** Posición propia del dibujo cuando la genérica no le queda bien. */
  artStyle?: StyleProp<ImageStyle>;
  title: string;
  text: string;
  action: string;
  done: boolean;
  busy?: boolean;
  onPress: () => void;
};

/**
 * "Completá tu cuenta": tarjetas deslizables con lo que le falta al usuario. Las completas no se
 * muestran y, con todo completo, la sección desaparece. Mientras cargan los datos no se muestra nada.
 */
export function AccountCards() {
  const styles = useStyles();
  const { user, isLoading, isGuest } = useCurrentUser();
  const { cars, isLoading: carsLoading } = useMyCars();
  const { hasJoinedAny, isLoading: meetsLoading } = useUserMeets();
  const { interests } = useInterests();
  const { pickAndUpload, isUploading } = useAvatarUpload();

  if (isLoading) return null;

  if (isGuest || !user) {
    return (
      <Section title="Completá tu cuenta">
        <StepCard
          step={{
            key: 'signup',
            art: require('@/assets/images/account/signup.svg'),
            title: 'Creá tu cuenta',
            text: 'Anotate a meets y armá tu garage',
            action: 'Crear',
            done: false,
            onPress: () => router.push('/login'),
          }}
        />
      </Section>
    );
  }

  if (carsLoading || meetsLoading) return null;

  const steps: Step[] = [
    {
      key: 'photo',
      art: require('@/assets/images/account/photo.svg'),
      title: 'Foto de perfil',
      text: 'Que te reconozcan en los meets',
      action: 'Subir',
      done: !!user.image,
      busy: isUploading,
      onPress: () => void pickAndUpload(),
    },
    {
      key: 'interests',
      art: require('@/assets/images/account/interests.svg'),
      title: 'Tus intereses',
      text: 'Te mostramos primero lo que te gusta',
      action: 'Elegir',
      done: interests.length > 0,
      onPress: () => router.push('/interests'),
    },
    {
      key: 'car',
      art: require('@/assets/images/account/car.svg'),
      artStyle: styles.carArt,
      title: 'Tu primer auto',
      text: 'Armá tu garage',
      action: 'Agregar',
      done: cars.length > 0,
      onPress: () => router.push({ pathname: '/garage/[id]', params: { id: 'new' } }),
    },
    {
      key: 'meet',
      art: require('@/assets/images/account/meet.svg'),
      title: 'Tu primer meet',
      text: 'Anotate a un encuentro',
      action: 'Ver meets',
      done: hasJoinedAny,
      onPress: () => router.push('/events'),
    },
  ];

  const pending = steps.filter((s) => !s.done);
  if (pending.length === 0) return null;

  return (
    <Section title={`Completá tu cuenta · ${steps.length - pending.length}/${steps.length}`}>
      {pending.map((step) => (
        <StepCard key={step.key} step={step} />
      ))}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.carousel}>
        {children}
      </ScrollView>
    </View>
  );
}

function StepCard({ step }: { step: Step }) {
  const { colors: c } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.card}>
      {/* Primero el dibujo: si se toca con el texto, el botón queda encima. */}
      <Image source={step.art} style={[styles.art, step.artStyle]} contentFit="contain" contentPosition="right bottom" accessible={false} />
      <View style={styles.body}>
        <Text variant="heading" tone="onAccent" numberOfLines={1}>
          {step.title}
        </Text>
        <Text variant="caption" numberOfLines={2} style={styles.text}>
          {step.text}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${step.action}: ${step.title}`}
          accessibilityState={{ busy: step.busy }}
          disabled={step.busy}
          onPress={step.onPress}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.8 }]}>
          {step.busy ? (
            <ActivityIndicator size="small" color={c.text} />
          ) : (
            <Text variant="label">{step.action}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  section: { marginTop: Spacing.xxl },
  bleed: { marginHorizontal: -Spacing.lg },
  carousel: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  card: {
    width: 288,
    minHeight: 132,
    justifyContent: 'center',
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: c.accent,
    // El dibujo sale del borde y la tarjeta lo recorta.
    overflow: 'hidden',
  },
  body: { width: '56%', gap: Spacing.xs },
  // Texto secundario oscuro y algo transparente: el gris de la paleta no se lee sobre el fluor.
  text: { color: 'rgba(11,11,12,0.7)', minHeight: 32 },
  action: {
    alignSelf: 'flex-start',
    height: 34,
    minWidth: 88,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: { position: 'absolute', right: -36, bottom: -12, width: 176, height: 116 },
  // El auto mira a la izquierda: se ve el frente entero y la tarjeta corta la cola y el piso.
  carArt: { right: -40, bottom: -6, width: 176, height: 99 },
}));
