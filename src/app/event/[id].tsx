import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Linking, Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatKm } from '@/components/event-card';
import { EventMap } from '@/components/event-map';
import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { Button, Fade, IconButton, Tag } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getEvent } from '@/data/events';
import { useAttendanceToggle } from '@/services/attendance';
import { toCardEvent, useEventBySlug } from '@/services/events';
import { useLastKnownLocation } from '@/services/location';
import { useSaveToggle } from '@/services/saved';
import { useCurrentUser } from '@/services/user';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Los eventos de Convex llegan por slug; los de ejemplo (mapa, Guardados) siguen en src/data/events.ts.
  const remote = useEventBySlug(id);
  const location = useLastKnownLocation();
  const event = remote ? toCardEvent(remote, location) : getEvent(id);
  const insets = useSafeAreaInsets();
  // Sólo los eventos de Convex se pueden guardar; los de ejemplo no tienen _id.
  const { saved, toggle } = useSaveToggle(remote?._id);
  const attendance = useAttendanceToggle(remote?._id);
  const { isSignedIn } = useCurrentUser();

  if (remote === undefined && !event) {
    return (
      <View style={[styles.screen, styles.missing]}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.screen, styles.missing]}>
        <Text tone="secondary">Este encuentro ya no existe.</Text>
        <Button label="Volver" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const hours = event.endTime ? `${event.time} – ${event.endTime} hs` : `${event.time} hs`;

  const openDirections = () => {
    // Con las coordenadas el destino es exacto; el nombre del lugar queda como etiqueta del pin en iOS.
    const { latitude, longitude } = event.coords;
    const url =
      Platform.OS === 'ios'
        ? `maps://?ll=${latitude},${longitude}&q=${encodeURIComponent(event.place)}`
        : `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
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
            <Fact icon="pin" title={event.place} subtitle={event.distanceKm === undefined ? event.area : `${event.area} · a ${formatKm(event.distanceKm)}`} />
          </View>

          <View style={styles.map}>
            <EventMap
              // initialRegion sólo se lee al montar: si cambia el evento hay que remontar el mapa.
              key={event.id}
              style={StyleSheet.absoluteFill}
              interactive={false}
              initialRegion={{ ...event.coords, latitudeDelta: MAP_DELTA, longitudeDelta: MAP_DELTA }}
              pins={[{ id: event.id, label: event.place, coordinate: event.coords, x: event.map.x, y: event.map.y }]}
              selectedId={event.id}
              onSelect={openDirections}
              onPress={openDirections}
            />
          </View>

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
        {remote && (
          <IconButton
            icon={saved ? 'bookmarkFill' : 'bookmark'}
            label={saved ? 'Quitar de guardados' : 'Guardar'}
            active={saved}
            size={52}
            onPress={toggle}
          />
        )}
        <Button label="Cómo llegar" icon="navigate" onPress={openDirections} style={{ flex: 1 }} />
        {remote && (
          <Button
            label={attendance.attending ? 'Cancelar' : 'Voy!'}
            icon={attendance.attending ? 'close' : 'flag'}
            variant={attendance.attending ? 'secondary' : 'primary'}
            loading={attendance.loading}
            // Un invitado no puede anotarse: primero tiene que iniciar sesión.
            onPress={isSignedIn ? attendance.toggle : () => router.push('/login')}
            style={{ flex: 1 }}
          />
        )}
      </View>
    </View>
  );
}

// Zoom de barrio: se ve la calle y un par de cuadras alrededor.
const MAP_DELTA = 0.012;

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
    height: 180,
    overflow: 'hidden',
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
