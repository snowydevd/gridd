import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventRow, EventTile, formatKm, openEvent, WhenLine } from '@/components/event-card';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { Button, Chip, Fade, SectionHeader, Tag, Wordmark } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { KIND_LABELS, toCardEvent, useUpcomingEvents, type EventKind } from '@/services/events';
import { useLastKnownLocation } from '@/services/location';
import { useCurrentUser } from '@/services/user';

/** Cuántos eventos trae Inicio de una vez: destacado + lista + carrusel. */
const HOME_EVENTS = 20;
/** Radio de "Cerca tuyo" cuando se conoce la ubicación del usuario. */
const NEARBY_KM = 30;
const LIST_SIZE = 3;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<EventKind | null>(null);
  const location = useLastKnownLocation();
  const { isPublisher } = useCurrentUser();
  const { events, isLoading } = useUpcomingEvents({ pageSize: HOME_EVENTS });

  // `kind` va al lado de la tarjeta para filtrar con el valor del backend y no con la etiqueta.
  const cards = events.map((e) => ({ kind: e.kind, card: toCardEvent(e, location) }));
  const [featured, ...rest] = cards;

  // Chips sólo de las categorías que tienen eventos, para no mostrar filtros vacíos.
  const kinds = [...new Set(rest.map((c) => c.kind))];

  // Con ubicación: los cercanos, del más cerca al más lejos. Sin ubicación: los próximos por fecha.
  const listed = rest
    .filter((c) => !kind || c.kind === kind)
    .filter((c) => !location || (c.card.distanceKm ?? Infinity) < NEARBY_KM)
    .sort((a, b) => (location ? (a.card.distanceKm ?? 0) - (b.card.distanceKm ?? 0) : 0))
    .slice(0, LIST_SIZE);
  const listedIds = new Set(listed.map((c) => c.card.id));
  const later = rest.filter((c) => !listedIds.has(c.card.id));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Wordmark />
        <Pressable style={styles.location} accessibilityRole="button" accessibilityLabel="Cambiar ciudad">
          <Icon name="navigate" size={14} color={Colors.textSecondary} />
          <Text variant="label">Montevideo</Text>
        </Pressable>
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
          <Fade style={{ top: '35%' }} to="rgba(11,11,12,0.95)" />
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

      {kinds.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}>
          <Chip label="Todos" selected={!kind} onPress={() => setKind(null)} />
          {kinds.map((k) => (
            <Chip key={k} label={KIND_LABELS[k]} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </ScrollView>
      )}

      {featured && (
        <View style={styles.section}>
          <SectionHeader title={location ? 'Cerca tuyo' : 'Próximos'} />
          {listed.length > 0 ? (
            listed.map((c) => <EventRow key={c.card.id} event={c.card} />)
          ) : (
            <Text tone="secondary" style={styles.empty}>
              {kind
                ? `No hay encuentros de ${KIND_LABELS[kind]}${location ? ' cerca' : ''} por ahora.`
                : 'No hay más encuentros cerca por ahora.'}
            </Text>
          )}
        </View>
      )}

      {later.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Más adelante" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bleed}
            contentContainerStyle={styles.carousel}>
            {later.map((c) => (
              <EventTile key={c.card.id} event={c.card} />
            ))}
          </ScrollView>
        </View>
      )}
    </ScrollView>
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
  chipsScroll: { marginHorizontal: -Spacing.lg, marginTop: Spacing.xl },
  chips: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  section: { marginTop: Spacing.xxl },
  empty: { paddingVertical: Spacing.lg },
  bleed: { marginHorizontal: -Spacing.lg },
  carousel: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
});
