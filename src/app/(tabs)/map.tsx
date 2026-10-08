import * as Location from 'expo-location';
import { useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventRow } from '@/components/event-card';
import { EventMap, type EventMapHandle } from '@/components/event-map';
import { Chip, IconButton } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { categories, events, type Category } from '@/data/events';

// Montevideo + Costa de Oro: entran todos los encuentros de ejemplo.
const INITIAL_REGION = { latitude: -34.86, longitude: -56.04, latitudeDelta: 0.2, longitudeDelta: 0.24 };
// Lo que tapan los chips (arriba) y la tarjeta + botón de ubicación (abajo).
const MAP_PADDING_TOP = 56;
const MAP_PADDING_BOTTOM = 150;

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const map = useRef<EventMapHandle>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [showsUser, setShowsUser] = useState(false);

  const visible = events.filter((e) => !e.past && (!category || e.category === category));
  const [selectedId, setSelectedId] = useState(visible.find((e) => e.isToday)?.id ?? visible[0]?.id);
  const selected = visible.find((e) => e.id === selectedId) ?? visible[0];

  const select = (id: string) => {
    setSelectedId(id);
    const event = visible.find((e) => e.id === id);
    if (event) map.current?.focus(event.coords);
  };

  const locate = async () => {
    const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Sin acceso a tu ubicación',
        'Activalo para ver los encuentros cerca tuyo.',
        canAskAgain ? undefined : [{ text: 'Cancelar', style: 'cancel' }, { text: 'Abrir ajustes', onPress: () => Linking.openSettings() }],
      );
      return;
    }
    setShowsUser(true);
    try {
      // La última conocida es instantánea; si no hay, se pide una nueva.
      const position =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      map.current?.focus(position.coords, 0.06);
    } catch {
      Alert.alert('No pudimos ubicarte', 'Revisá que el GPS esté activado.');
    }
  };

  return (
    <View style={styles.screen}>
      <EventMap
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={INITIAL_REGION}
        padding={{ top: insets.top + MAP_PADDING_TOP, right: 0, bottom: MAP_PADDING_BOTTOM, left: 0 }}
        showsUserLocation={showsUser}
        pins={visible.map((e) => ({ id: e.id, label: e.title, coordinate: e.coords, x: e.map.x, y: e.map.y }))}
        selectedId={selected?.id}
        onSelect={select}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.chipsScroll, { top: insets.top + Spacing.md }]}
        contentContainerStyle={styles.chips}>
        <Chip label="Todos" selected={!category} onPress={() => setCategory(null)} />
        {categories.map((c) => (
          <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </ScrollView>

      <View style={styles.bottom}>
        <View style={styles.locate}>
          <IconButton icon="locate" label="Centrar en mi ubicación" onPress={locate} />
        </View>
        {selected && (
          <View style={styles.sheet}>
            <EventRow event={selected} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.canvas },
  chipsScroll: { position: 'absolute', left: 0, right: 0, flexGrow: 0 },
  chips: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  bottom: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.lg,
    gap: Spacing.md,
  },
  locate: { alignSelf: 'flex-end' },
  sheet: {
    backgroundColor: Colors.raised,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
});
