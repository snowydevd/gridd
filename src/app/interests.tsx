import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { Button, Chip, IconButton } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { EVENT_KINDS, KIND_LABELS, type EventKind } from '@/services/events';
import { useCurrentUser, useInterests } from '@/services/user';

// "Otro" no dice nada de los gustos del usuario.
const KINDS = EVENT_KINDS.filter((k) => k !== 'otro');

export default function InterestsScreen() {
  const insets = useSafeAreaInsets();
  const { isLoading, isGuest } = useCurrentUser();
  const { interests, setInterests } = useInterests();
  const [selected, setSelected] = useState<EventKind[]>(interests);
  const [saving, setSaving] = useState(false);

  if (!isLoading && isGuest) return <Redirect href="/login" />;

  const toggle = (kind: EventKind) =>
    setSelected((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));

  const save = async () => {
    setSaving(true);
    try {
      await setInterests(selected);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <IconButton icon="back" label="Volver" onPress={() => router.back()} />
        <Text variant="title">Tus intereses</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text tone="secondary">Elegí qué encuentros te gustan y te los mostramos primero en Inicio.</Text>
        <View style={styles.chips}>
          {KINDS.map((k) => (
            <Chip key={k} label={KIND_LABELS[k]} selected={selected.includes(k)} onPress={() => toggle(k)} />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Button label="Guardar" onPress={() => void save()} loading={saving} />
      </View>
    </View>
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
  content: { padding: Spacing.lg, gap: Spacing.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
});
