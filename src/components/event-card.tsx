import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Tag } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { MeetEvent } from '@/services/events';

/** When line: accent only when the meet is today (the 10% accent rule). */
export function WhenLine({ event }: { event: MeetEvent }) {
  return (
    <View style={styles.when}>
      {event.isToday && <View style={styles.liveDot} />}
      <Text variant="overline" tone={event.isToday ? 'accent' : 'secondary'}>
        {event.day} · {event.time}
      </Text>
    </View>
  );
}

/** Compact list row: thumbnail, when, title, place. Nothing else. */
export function EventRow({ event, dimmed }: { event: MeetEvent; dimmed?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => openEvent(event.id)}
      style={({ pressed }) => [styles.row, dimmed && styles.dimmed, pressed && styles.pressed]}>
      <Image source={event.image} style={styles.thumb} contentFit="cover" transition={150} />
      <View style={styles.rowBody}>
        <WhenLine event={event} />
        <Text variant="heading" numberOfLines={1}>
          {event.title}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {placeLine(event)}
        </Text>
      </View>
    </Pressable>
  );
}

/** Tall photo tile for horizontal carousels. */
export function EventTile({ event, width = 240 }: { event: MeetEvent; width?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => openEvent(event.id)}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}>
      <View>
        <Image
          source={event.image}
          style={[styles.tileImage, { width }]}
          contentFit="cover"
          transition={150}
        />
        <View style={styles.tileTag}>
          <Tag label={event.day} />
        </View>
      </View>
      <Text variant="heading" numberOfLines={1} style={styles.tileTitle}>
        {event.title}
      </Text>
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {event.place}
      </Text>
    </Pressable>
  );
}

/**
 * Two-column photo grid, the middle step between the featured hero and list rows.
 * With an odd count the first tile spans the full width, so there is never a gap.
 */
export function EventGrid({ events }: { events: MeetEvent[] }) {
  const wide = events.length % 2 === 1 ? events[0] : undefined;
  const pairs: MeetEvent[][] = [];
  for (let i = wide ? 1 : 0; i < events.length; i += 2) pairs.push(events.slice(i, i + 2));

  return (
    <View style={styles.grid}>
      {wide && <GridTile event={wide} wide />}
      {pairs.map((pair) => (
        <View key={pair[0].id} style={styles.gridRow}>
          {pair.map((e) => (
            <GridTile key={e.id} event={e} />
          ))}
        </View>
      ))}
    </View>
  );
}

function GridTile({ event, wide }: { event: MeetEvent; wide?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => openEvent(event.id)}
      style={({ pressed }) => [styles.gridTile, pressed && styles.pressed]}>
      <View>
        <Image
          source={event.image}
          style={[styles.gridImage, { aspectRatio: wide ? 16 / 9 : 4 / 3 }]}
          contentFit="cover"
          transition={150}
        />
        <View style={styles.tileTag}>
          <Tag label={event.day} tone={event.isToday ? 'accent' : 'default'} />
        </View>
      </View>
      <Text variant="heading" numberOfLines={1} style={styles.gridTitle}>
        {event.title}
      </Text>
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {placeLine(event)}
      </Text>
    </Pressable>
  );
}

export function openEvent(id: string) {
  router.push({ pathname: '/event/[id]', params: { id } });
}

export function formatKm(km: number) {
  return km < 10 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km)} km`;
}

/** "Pocitos · 1,4 km", o sólo el lugar si no se sabe la distancia. */
export function placeLine(event: MeetEvent) {
  return event.distanceKm === undefined ? event.area : `${event.area} · ${formatKm(event.distanceKm)}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  dimmed: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: Radius.lg,
    backgroundColor: Colors.raised,
  },
  rowBody: { flex: 1, gap: 2 },
  when: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent },
  tileImage: {
    height: 150,
    borderRadius: Radius.xl,
    backgroundColor: Colors.raised,
  },
  tileTag: { position: 'absolute', top: Spacing.md, left: Spacing.md },
  tileTitle: { marginTop: Spacing.md },
  grid: { gap: Spacing.lg },
  gridRow: { flexDirection: 'row', gap: Spacing.md },
  gridTile: { flex: 1 },
  gridImage: {
    width: '100%',
    borderRadius: Radius.xl,
    backgroundColor: Colors.raised,
  },
  gridTitle: { marginTop: Spacing.sm },
});
