import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventRow } from '@/components/event-card';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { toCardEvent, useMyEvents, type MeetEvent } from '@/services/events';
import { useLastKnownLocation } from '@/services/location';
import { useSavedEvents } from '@/services/saved';
import { useCurrentUser } from '@/services/user';

type Segment = 'saved' | 'mine';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const saved = useSavedEvents();
  const mine = useMyEvents();
  const location = useLastKnownLocation();
  const { isPublisher } = useCurrentUser();
  const [picked, setSegment] = useState<Segment>('saved');
  // "Mis eventos" es sólo para quien puede publicar: un usuario común ve siempre sus guardados.
  const segment = isPublisher ? picked : 'saved';

  const { events, isLoading } = segment === 'saved' ? saved : mine;
  const sections: Section[] =
    segment === 'saved'
      ? splitByDate(events.map((e) => toCardEvent(e, location)))
      : [
          // Los cancelados (u ocultos por un admin) van aparte para no confundirlos con los próximos.
          ...splitByDate(events.filter((e) => e.status === 'published').map((e) => toCardEvent(e, location))),
          {
            label: 'Cancelados',
            events: events.filter((e) => e.status !== 'published').map((e) => toCardEvent(e, location)),
            dimmed: true,
          },
        ];
  const isEmpty = sections.every((s) => s.events.length === 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}>
      <Text variant="display" style={styles.title}>
        Guardados
      </Text>

      {isPublisher && (
        <View style={styles.segmented}>
          <SegmentButton label="Guardados" active={segment === 'saved'} onPress={() => setSegment('saved')} />
          <SegmentButton label="Mis eventos" active={segment === 'mine'} onPress={() => setSegment('mine')} />
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color={Colors.accent} style={styles.loading} />
      ) : isEmpty ? (
        <EmptyState segment={segment} />
      ) : (
        sections.map(
          (section) =>
            section.events.length > 0 && (
              <View key={section.label} style={styles.section}>
                <Text variant="overline" tone="secondary" style={styles.sectionLabel}>
                  {section.label}
                </Text>
                {section.events.map((e) => (
                  <EventRow key={e.id} event={e} dimmed={section.dimmed} />
                ))}
              </View>
            ),
        )
      )}
    </ScrollView>
  );
}

type Section = { label: string; events: MeetEvent[]; dimmed?: boolean };

/** Próximos del más cercano al más lejano; pasados del más reciente al más viejo. */
function splitByDate(list: MeetEvent[]): Section[] {
  const byStart = (a: MeetEvent, b: MeetEvent) => a.startsAt - b.startsAt;
  return [
    { label: 'Próximos', events: list.filter((e) => !e.past).sort(byStart) },
    { label: 'Pasados', events: list.filter((e) => e.past).sort((a, b) => byStart(b, a)), dimmed: true },
  ];
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.segment, active && styles.segmentActive]}>
      <Text variant="label" tone={active ? 'primary' : 'secondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

function EmptyState({ segment }: { segment: Segment }) {
  const mine = segment === 'mine';
  const { isPublisher, isGuest } = useCurrentUser();
  const guest = !mine && isGuest;
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={mine ? 'calendar' : 'bookmark'} size={26} color={Colors.textSecondary} />
      </View>
      <Text variant="heading">{mine ? 'Todavía no publicaste nada' : 'Nada guardado'}</Text>
      <Text tone="secondary" style={styles.emptyText}>
        {mine
          ? 'Armá tu primer encuentro en menos de un minuto.'
          : guest
            ? 'Entrá a tu cuenta para guardar encuentros.'
            : 'Guardá encuentros para tenerlos a mano.'}
      </Text>
      {guest && (
        <Button label="Iniciar sesión" onPress={() => router.push('/login')} style={styles.emptyCta} />
      )}
      {mine && isPublisher && (
        <Button label="Publicar evento" icon="plus" onPress={() => router.push('/publish')} style={styles.emptyCta} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.canvas },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  title: { marginBottom: Spacing.xl },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segment: {
    flex: 1,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: Colors.raised },
  section: { marginTop: Spacing.xl },
  sectionLabel: { marginBottom: Spacing.xs },
  loading: { paddingTop: 80 },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyText: { textAlign: 'center' },
  emptyCta: { marginTop: Spacing.lg, alignSelf: 'stretch' },
});
