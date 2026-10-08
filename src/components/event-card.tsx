import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Tag } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { MeetEvent } from '@/data/events';

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
});
