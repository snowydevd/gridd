import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventRow } from '@/components/event-card';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { events } from '@/data/events';
import { useCurrentUser } from '@/services/user';
import { useSaved } from '@/state/saved';

type Segment = 'saved' | 'mine';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { saved } = useSaved();
  const [segment, setSegment] = useState<Segment>('saved');

  const list = segment === 'saved' ? events.filter((e) => saved.has(e.id)) : [];
  const upcoming = list.filter((e) => !e.past);
  const past = list.filter((e) => e.past);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}>
      <Text variant="display" style={styles.title}>
        Guardados
      </Text>

      <View style={styles.segmented}>
        <SegmentButton label="Guardados" active={segment === 'saved'} onPress={() => setSegment('saved')} />
        <SegmentButton label="Mis eventos" active={segment === 'mine'} onPress={() => setSegment('mine')} />
      </View>

      {list.length === 0 ? (
        <EmptyState segment={segment} />
      ) : (
        <>
          {upcoming.length > 0 && (
            <View style={styles.section}>
              <Text variant="overline" tone="secondary" style={styles.sectionLabel}>
                Próximos
              </Text>
              {upcoming.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </View>
          )}
          {past.length > 0 && (
            <View style={styles.section}>
              <Text variant="overline" tone="secondary" style={styles.sectionLabel}>
                Pasados
              </Text>
              {past.map((e) => (
                <EventRow key={e.id} event={e} dimmed />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
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
  const { isPublisher } = useCurrentUser();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={mine ? 'calendar' : 'bookmark'} size={26} color={Colors.textSecondary} />
      </View>
      <Text variant="heading">{mine ? 'Todavía no publicaste nada' : 'Nada guardado'}</Text>
      <Text tone="secondary" style={styles.emptyText}>
        {mine ? 'Armá tu primer encuentro en menos de un minuto.' : 'Guardá encuentros para tenerlos a mano.'}
      </Text>
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
