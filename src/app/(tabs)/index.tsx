import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountCards } from '@/components/account-cards';
import { EventGrid, EventRow, formatKm, openEvent, WhenLine } from '@/components/event-card';
import { Icon } from '@/components/icon';
import { RadiusOptions } from '@/components/radius-options';
import { Text } from '@/components/text';
import { Button, Fade, SectionHeader, Tag, Wordmark } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useMyUpcomingEvents } from '@/services/attendance';
import { toCardEvent, useUpcomingEvents } from '@/services/events';
import { useLastKnownLocation } from '@/services/location';
import { searchRadiusLabel, useSearchRadius, withinRadius } from '@/services/search-radius';
import { useCurrentUser, useInterests } from '@/services/user';

/** Cuántos eventos trae Inicio de una vez: el destacado y la base de "Para vos". */
const HOME_EVENTS = 20;
const FOR_YOU_SIZE = 5;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const location = useLastKnownLocation();
  const { isPublisher } = useCurrentUser();
  // Radio de "Cerca tuyo" cuando se conoce la ubicación; se elige acá arriba o en el perfil.
  const { radius } = useSearchRadius();
  const { interests } = useInterests();
  const { events, isLoading } = useUpcomingEvents({ pageSize: HOME_EVENTS });
  const { events: going } = useMyUpcomingEvents();

  // `startsAt` y `kind` van al lado de la tarjeta para ordenar con los valores del backend.
  const cards = events.map((e) => ({ kind: e.kind, startsAt: e.startsAt, card: toCardEvent(e, location) }));
  const [featured, ...rest] = cards;

  // "Para vos": dentro del radio (si se conoce la ubicación), primero las categorías que le interesan
  // y, dentro de cada grupo, por fecha.
  const liked = (kind: (typeof cards)[number]['kind']) => (interests.includes(kind) ? 0 : 1);
  const forYou = rest
    .filter((c) => !location || withinRadius(c.card.distanceKm ?? Infinity, radius))
    .sort((a, b) => liked(a.kind) - liked(b.kind) || a.startsAt - b.startsAt)
    .slice(0, FOR_YOU_SIZE);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Wordmark />
        <View style={styles.headerActions}>
          <RadiusPill />
          <ProfilePill />
        </View>
      </View>

      {isLoading ? (
        <View style={[styles.hero, styles.centered]}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : !featured ? (
        <View style={[styles.hero, styles.centered, styles.emptyHero]}>
          <Icon name="calendar" size={28} color={Colors.textSecondary} />
          <Text variant="heading">No hay encuentros próximos</Text>
          <Text tone="secondary" style={styles.emptyText}>
            {isPublisher ? 'Sé el primero en publicar uno.' : 'Volvé en un rato, se publican seguido.'}
          </Text>
          {isPublisher && (
            <Button label="Publicar evento" icon="plus" onPress={() => router.push('/publish')} style={styles.emptyCta} />
          )}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => openEvent(featured.card.id)}
          style={({ pressed }) => [styles.hero, pressed && { opacity: 0.85 }]}>
          <Image source={featured.card.image} style={StyleSheet.absoluteFill} contentFit="cover" />
          <Fade style={{ top: '35%' }} opacity={0.95} />
          <View style={styles.heroTop}>
            <Tag label={featured.card.isToday ? 'Hoy' : 'Próximo'} tone="accent" />
          </View>
          <View style={styles.heroBody}>
            <WhenLine event={featured.card} />
            <Text variant="display" numberOfLines={2}>
              {featured.card.title}
            </Text>
            <Text variant="label" tone="secondary" numberOfLines={1}>
              {featured.card.distanceKm === undefined
                ? featured.card.place
                : `${featured.card.place} · ${formatKm(featured.card.distanceKm)}`}
            </Text>
          </View>
        </Pressable>
      )}

      {/* Escalón intermedio entre el destacado y las filas: la grilla le da foto a "Para vos". */}
      {forYou.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Para vos" action="Ver todo" onAction={() => router.push('/events')} />
          <EventGrid events={forYou.map((c) => c.card)} />
        </View>
      )}

      {going.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Vas a ir" />
          {going.map((e) => (
            // Un cancelado queda atenuado: sigue en la lista para que el usuario se entere.
            <EventRow key={e._id} event={toCardEvent(e, location)} dimmed={e.status === 'cancelled'} />
          ))}
        </View>
      )}

      <AccountCards />
    </ScrollView>
  );
}

/** Cápsula con el rango de "Cerca tuyo"; al tocarla despliega las opciones debajo. */
function RadiusPill() {
  const { isSignedIn } = useCurrentUser();
  const { radius, setRadius } = useSearchRadius();
  const pill = useRef<View>(null);
  // Posición del menú en pantalla (null = cerrado). Se mide al abrir para seguir a la cápsula aunque haya scroll.
  const [menu, setMenu] = useState<{ top: number; right: number } | null>(null);

  const open = () => {
    if (!isSignedIn) {
      router.push('/login');
      return;
    }
    pill.current?.measureInWindow((x, y, width, height) => {
      setMenu({ top: y + height + Spacing.sm, right: Spacing.lg });
    });
  };

  return (
    <>
      <Pressable
        ref={pill}
        onPress={open}
        style={({ pressed }) => [styles.location, pressed && { opacity: 0.75 }]}
        accessibilityRole="button"
        accessibilityLabel={`Rango de búsqueda: ${searchRadiusLabel(radius)}. Cambiar rango`}>
        <Icon name="navigate" size={14} color={Colors.textSecondary} />
        <Text variant="label">{searchRadiusLabel(radius)}</Text>
      </Pressable>

      <Modal visible={menu !== null} transparent animationType="fade" onRequestClose={() => setMenu(null)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(null)} accessibilityLabel="Cerrar" />
        {menu && (
          <View style={[styles.radiusMenu, menu]}>
            <Text variant="overline" tone="secondary" style={styles.radiusMenuTitle}>
              Encuentros a menos de
            </Text>
            <RadiusOptions
              value={radius}
              onSelect={(option) => {
                setRadius(option);
                setMenu(null);
              }}
            />
          </View>
        )}
      </Modal>
    </>
  );
}

/** Foto del usuario; sin foto, sus iniciales con borde punteado para invitar a subirla. */
function ProfilePill() {
  const { user, isSignedIn } = useCurrentUser();
  const name = user?.name?.trim();
  const initials = name
    ? name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : null;

  return (
    <Pressable
      onPress={() => router.push(isSignedIn ? '/profile' : '/login')}
      style={({ pressed }) => [styles.avatar, !user?.image && styles.avatarEmpty, pressed && { opacity: 0.75 }]}
      accessibilityRole="button"
      accessibilityLabel={isSignedIn ? 'Ir a tu perfil' : 'Iniciar sesión'}>
      {user?.image ? (
        <Image source={{ uri: user.image }} style={styles.avatarImage} contentFit="cover" />
      ) : initials ? (
        <Text variant="label">{initials}</Text>
      ) : (
        <Icon name="person" size={18} color={Colors.textSecondary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.canvas },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  // Radio exacto (la mitad) y sin `overflow: 'hidden'`: en Android un radio mayor que la vista con
  // recorte de hijos deja la foto invisible. La imagen se redondea sola, como en el perfil.
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  avatarImage: { width: 36, height: 36, borderRadius: 18 },
  avatarEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.accent },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  radiusMenu: {
    position: 'absolute',
    width: 240,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  radiusMenuTitle: { marginBottom: Spacing.xs },
  hero: {
    height: 380,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    justifyContent: 'space-between',
  },
  centered: { alignItems: 'center', justifyContent: 'center' },
  emptyHero: { gap: Spacing.sm, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border },
  emptyText: { textAlign: 'center' },
  emptyCta: { alignSelf: 'stretch', marginTop: Spacing.md },
  heroTop: { padding: Spacing.lg },
  heroBody: { padding: Spacing.lg, gap: Spacing.xs },
  section: { marginTop: Spacing.xxl },
});
