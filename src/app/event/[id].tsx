import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatKm } from '@/components/event-card';
import { Icon, type IconName } from '@/components/icon';
import { StylizedMap } from '@/components/stylized-map';
import { Text } from '@/components/text';
import { Button, Fade, IconButton, Tag } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getEvent } from '@/data/events';
import { useSaved } from '@/state/saved';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = getEvent(id);
  const insets = useSafeAreaInsets();
  const { isSaved, toggle } = useSaved();

  if (!event) {
    return (
      <View style={[styles.screen, styles.missing]}>
        <Text tone="secondary">Este encuentro ya no existe.</Text>
        <Button label="Volver" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const saved = isSaved(event.id);
  const hours = event.endTime ? `${event.time} – ${event.endTime} hs` : `${event.time} hs`;

  const openDirections = () => {
    const q = encodeURIComponent(`${event.place}, ${event.area}`);
    const url = Platform.OS === 'ios' ? `maps://?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
    Linking.openURL(url);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={event.image} style={StyleSheet.absoluteFill} contentFit="cover" />
          <Fade style={{ top: '45%' }} />
        </View>

        <View style={styles.body}>
          <View style={styles.tags}>
            {event.isToday && <Tag label="Hoy" tone="accent" />}
            <Tag label={event.category} />
          </View>
          <Text variant="display">{event.title}</Text>
          <View style={styles.going}>
            <Icon name="group" size={16} color={Colors.textSecondary} />
            <Text variant="label" tone="secondary">
              {event.going} van
            </Text>
          </View>

          <View style={styles.facts}>
            <Fact icon="calendar" title={event.date} subtitle={hours} />
            <View style={styles.factDivider} />
            <Fact icon="pin" title={event.place} subtitle={`${event.area} · a ${formatKm(event.distanceKm)}`} />
          </View>

          <StylizedMap style={styles.map} pins={[{ id: event.id, x: 0.5, y: 0.5 }]} selectedId={event.id} />

          <Text tone="secondary" style={styles.description}>
            {event.description}
          </Text>

          <View style={styles.organizer}>
            <View style={styles.orgBadge}>
              <Text variant="overline" tone="accent">
                {event.organizer.initials}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" tone="secondary">
                Organiza
              </Text>
              <View style={styles.orgName}>
                <Text variant="heading" numberOfLines={1}>
                  {event.organizer.name}
                </Text>
                {event.organizer.verified && <Icon name="verified" size={16} color={Colors.success} />}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.topBar, { top: insets.top + Spacing.sm }]}>
        <IconButton icon="back" label="Volver" overlay onPress={() => router.back()} />
        <IconButton
          icon="share"
          label="Compartir"
          overlay
          onPress={() => Share.share({ message: `${event.title} · ${event.date} ${event.time} hs en ${event.place}` })}
        />
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + Spacing.md }]}>
        <IconButton
          icon={saved ? 'bookmarkFill' : 'bookmark'}
          label={saved ? 'Quitar de guardados' : 'Guardar'}
          active={saved}
          size={52}
          onPress={() => toggle(event.id)}
        />
        <Button label="Cómo llegar" icon="navigate" onPress={openDirections} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function Fact({ icon, title, subtitle }: { icon: IconName; title: string; subtitle: string }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={20} color={Colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text variant="heading">{title}</Text>
        <Text variant="label" tone="secondary">
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.canvas },
  missing: { alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  hero: { height: 340, backgroundColor: Colors.surface },
  body: { paddingHorizontal: Spacing.lg, marginTop: -Spacing.xxl, gap: Spacing.md },
  tags: { flexDirection: 'row', gap: Spacing.sm },
  going: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  facts: {
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
  },
  fact: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg },
  factDivider: { height: 1, backgroundColor: Colors.border },
  map: {
    height: 140,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  description: { marginTop: Spacing.sm },
  organizer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.md,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  orgBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topBar: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.canvas,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
