import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventRow } from '@/components/event-card';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { Chip, IconButton } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { EVENT_KINDS, KIND_LABELS, toCardEvent, useUpcomingEvents, type EventKind } from '@/services/events';
import { useLastKnownLocation } from '@/services/location';
import { useSearchRadius, withinRadius } from '@/services/search-radius';
import { makeStyles, useTheme } from '@/theme';

const PAGE_SIZE = 10;

/** Todos los próximos encuentros por fecha, con filtro por categoría. */
export default function EventsScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<EventKind | null>(null);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <IconButton icon="back" label="Volver" onPress={() => router.back()} />
        <Text variant="title">Próximos encuentros</Text>
        <View style={{ width: 44 }} />
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Todos" selected={!kind} onPress={() => setKind(null)} />
          {EVENT_KINDS.map((k) => (
            <Chip key={k} label={KIND_LABELS[k]} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </ScrollView>
      </View>

      {/* `key` reinicia la paginación al cambiar de categoría. */}
      <EventList key={kind ?? 'all'} kind={kind ?? undefined} bottomInset={insets.bottom} />
    </View>
  );
}

function EventList({ kind, bottomInset }: { kind?: EventKind; bottomInset: number }) {
  const { colors: c } = useTheme();
  const styles = useStyles();
  const location = useLastKnownLocation();
  const { radius } = useSearchRadius();
  const { events, isLoading, canLoadMore, loadMore } = useUpcomingEvents({ kind, pageSize: PAGE_SIZE });
  // Cuántas filas se quieren mostrar; crece al llegar al final de la lista.
  const [wanted, setWanted] = useState(PAGE_SIZE);

  const cards = events
    .map((e) => toCardEvent(e, location))
    .filter((c) => !location || withinRadius(c.distanceKm ?? Infinity, radius));

  // El radio se filtra en el dispositivo: si una página deja pocas filas, se pide la siguiente
  // mientras el backend tenga más.
  useEffect(() => {
    if (canLoadMore && cards.length < wanted) loadMore();
  }, [canLoadMore, cards.length, wanted, loadMore]);

  if (isLoading) {
    return <ActivityIndicator color={c.accentText} style={styles.loading} />;
  }

  return (
    <FlatList
      data={cards}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => <EventRow event={item} />}
      onEndReached={() => setWanted(cards.length + PAGE_SIZE)}
      onEndReachedThreshold={0.5}
      contentContainerStyle={[styles.list, { paddingBottom: bottomInset + Spacing.xl }]}
      ListFooterComponent={canLoadMore ? <ActivityIndicator color={c.accentText} style={styles.more} /> : null}
      ListEmptyComponent={
        canLoadMore ? null : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="calendar" size={26} color={c.textSecondary} />
            </View>
            <Text variant="heading">No hay encuentros</Text>
            <Text tone="secondary" style={styles.emptyText}>
              {kind
                ? `No hay encuentros de ${KIND_LABELS[kind]}${location ? ' cerca' : ''} por ahora.`
                : `No hay encuentros${location ? ' cerca' : ''} por ahora.`}
            </Text>
          </View>
        )
      }
    />
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.canvas },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chips: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.sm },
  list: { paddingHorizontal: Spacing.lg },
  loading: { paddingTop: 80 },
  more: { paddingVertical: Spacing.lg },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyText: { textAlign: 'center' },
}));
