import { Redirect, router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { Button, Card, IconButton, Tag } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { carTitle, useMyCars, type Car } from '@/services/cars';
import { useCurrentUser } from '@/services/user';

/** Tope del backend (convex/cars.ts MAX_CARS). */
const MAX_CARS = 10;

export default function GarageScreen() {
  const insets = useSafeAreaInsets();
  const { isLoading: userLoading, isGuest } = useCurrentUser();
  const { cars, isLoading } = useMyCars();

  if (!userLoading && isGuest) return <Redirect href="/login" />;

  const full = cars.length >= MAX_CARS;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <IconButton icon="back" label="Volver" onPress={() => router.back()} />
        <Text variant="title">Mi garage</Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading || userLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : cars.length === 0 ? (
        <View style={[styles.centered, styles.empty]}>
          <View style={styles.emptyIcon}>
            <Icon name="car" size={28} color={Colors.textSecondary} />
          </View>
          <Text variant="heading">Tu garage está vacío</Text>
          <Text tone="secondary" style={styles.emptyText}>
            Sumá tus autos para mostrarlos en tu perfil y en los encuentros.
          </Text>
          <Button label="Agregar auto" icon="plus" onPress={() => router.push('/garage/new')} style={styles.emptyCta} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.xl }]}>
          {cars.map((car) => (
            <CarRow key={car._id} car={car} />
          ))}
          <Button
            label={full ? `Llegaste al máximo de ${MAX_CARS} autos` : 'Agregar auto'}
            icon={full ? undefined : 'plus'}
            variant="secondary"
            disabled={full}
            onPress={() => router.push('/garage/new')}
          />
        </ScrollView>
      )}
    </View>
  );
}

function CarRow({ car }: { car: Car }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Editar auto"
      onPress={() => router.push({ pathname: '/garage/[id]', params: { id: car._id } })}
      style={({ pressed }) => pressed && styles.pressed}>
      <Card style={styles.row}>
        <View style={styles.rowIcon}>
          <Icon name="car" size={20} color={Colors.accent} />
        </View>
        <View style={styles.rowBody}>
          <Text variant="heading" numberOfLines={1}>
            {carTitle(car)}
          </Text>
          <Text variant="caption" tone="secondary">
            {car.year}
          </Text>
        </View>
        {car.isModified && <Tag label="Modificado" tone="accent" />}
        <Icon name="edit" size={18} color={Colors.textSecondary} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.canvas },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyText: { textAlign: 'center' },
  emptyCta: { alignSelf: 'stretch', marginTop: Spacing.lg },
  list: { padding: Spacing.lg, gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  pressed: { opacity: 0.75 },
});
