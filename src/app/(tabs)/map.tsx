import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventRow } from '@/components/event-card';
import { StylizedMap } from '@/components/stylized-map';
import { Chip, IconButton } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { categories, events, type Category } from '@/data/events';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<Category | null>(null);

  const visible = events.filter((e) => !e.past && (!category || e.category === category));
  const [selectedId, setSelectedId] = useState(visible.find((e) => e.isToday)?.id ?? visible[0]?.id);
  const selected = visible.find((e) => e.id === selectedId) ?? visible[0];

  return (
    <View style={styles.screen}>
      <StylizedMap
        style={StyleSheet.absoluteFill}
        pins={visible.map((e) => ({ id: e.id, x: e.map.x, y: e.map.y, label: e.title }))}
        selectedId={selected?.id}
        onSelect={setSelectedId}
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
          <IconButton icon="locate" label="Centrar en mi ubicación" />
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
