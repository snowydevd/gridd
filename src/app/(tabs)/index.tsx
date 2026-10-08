import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventRow, EventTile, openEvent, WhenLine } from '@/components/event-card';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { Chip, Fade, SectionHeader, Tag, Wordmark } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { categories, featuredEvent, upcomingEvents, type Category } from '@/data/events';
import { useUpcomingEvents } from '@/services/events';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<Category | null>(null);

  const {events} = useUpcomingEvents() 

  const nearby = events
    .filter((e) => !e.past && e.id !== featuredEvent.id && e.distanceKm < 30)
    .filter((e) => !category || e.category === category)
    .slice(0, 3);

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

      <Pressable
        accessibilityRole="button"
        onPress={() => openEvent(featuredEvent.id)}
        style={({ pressed }) => [styles.hero, pressed && { opacity: 0.85 }]}>
        <Image source={featuredEvent.image} style={StyleSheet.absoluteFill} contentFit="cover" />
        <Fade style={{ top: '35%' }} to="rgba(11,11,12,0.95)" />
        <View style={styles.heroTop}>
          <Tag label="Este finde" tone="accent" />
        </View>
        <View style={styles.heroBody}>
          <WhenLine event={featuredEvent} />
          <Text variant="display" numberOfLines={2}>
            {featuredEvent.title}
          </Text>
          <Text variant="label" tone="secondary">
            {featuredEvent.place} · {featuredEvent.area}
          </Text>
        </View>
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}>
        <Chip label="Todos" selected={!category} onPress={() => setCategory(null)} />
        {categories.map((c) => (
          <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </ScrollView>

      <View style={styles.section}>
        <SectionHeader title="Cerca tuyo" />
        {nearby.length > 0 ? (
          nearby.map((e) => <EventRow key={e.id} event={e} />)
        ) : (
          <Text tone="secondary" style={styles.empty}>
            No hay encuentros de {category} cerca por ahora.
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Más adelante" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.bleed}
          contentContainerStyle={styles.carousel}>
          {upcomingEvents.map((e) => (
            <EventTile key={e.id} event={e} />
          ))}
        </ScrollView>
      </View>
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
  heroTop: { padding: Spacing.lg },
  heroBody: { padding: Spacing.lg, gap: Spacing.xs },
  chipsScroll: { marginHorizontal: -Spacing.lg, marginTop: Spacing.xl },
  chips: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  section: { marginTop: Spacing.xxl },
  empty: { paddingVertical: Spacing.lg },
  bleed: { marginHorizontal: -Spacing.lg },
  carousel: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
});
