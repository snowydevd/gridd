import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { Button, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/services/user';

// TODO: todavía de prueba; "Encuentros" puede salir de attendance.myEvents y "Organizados" de events.listMine.
const stats = [
  { value: 28, label: 'Encuentros' },
  { value: 4, label: 'Organizados' },
  { value: 12, label: 'Guardados' },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [alerts, setAlerts] = useState(true);
  const { user, isLoading, isGuest, isPublisher, signOut } = useCurrentUser();

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (isGuest || !user) {
    return (
      <View style={[styles.screen, styles.centered, styles.guest, { paddingTop: insets.top }]}>
        <Text variant="title">Estás como invitado</Text>
        <Text tone="secondary" style={styles.guestText}>
          Creá una cuenta para anotarte a encuentros y publicar los tuyos.
        </Text>
        <Button label="Iniciar sesión o registrarme" onPress={() => router.push('/login')} style={styles.guestButton} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.xl }]}>
      <View style={styles.identity}>
        <Image
          source={user.image ? { uri: user.image } : require('@/assets/images/meets/avatar.jpg')}
          style={styles.avatar}
          contentFit="cover"
        />
        <View style={styles.nameRow}>
          <Text variant="title">{user.name ?? 'Sin nombre'}</Text>
          {isPublisher && <Icon name="verified" size={18} color={Colors.accent} />}
        </View>
        <Text variant="label" tone="secondary">
          {user.email}
        </Text>
      </View>

      <View style={styles.stats}>
        {stats.map((s, i) => (
          <View key={s.label} style={[styles.stat, i > 0 && styles.statDivider]}>
            <Text variant="title">{s.value}</Text>
            <Text variant="caption" tone="secondary">
              {s.label}
            </Text>
          </View>
        ))}
      </View>

      <Card style={styles.car}>
        <View style={styles.rowIcon}>
          <Icon name="car" size={20} color={Colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="heading">Saveiro G5 1.6</Text>
          <Text variant="caption" tone="secondary">
            Mi garage
          </Text>
        </View>
        <Icon name="chevron" size={18} color={Colors.textSecondary} />
      </Card>

      <Card style={styles.list}>
        <Row icon="bell" label="Alertas de encuentros">
          <Switch
            value={alerts}
            onValueChange={setAlerts}
            trackColor={{ true: Colors.accent, false: Colors.raised }}
            thumbColor={alerts ? Colors.onAccent : Colors.textSecondary}
          />
        </Row>
        <Row icon="pin" label="Ubicación" value="25 km" />
        <Row icon="logout" label="Cerrar sesión" destructive onPress={() => void signOut()} last />
      </Card>
    </ScrollView>
  );
}

type RowProps = {
  icon: IconName;
  label: string;
  value?: string;
  destructive?: boolean;
  last?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
};

function Row({ icon, label, value, destructive, last, onPress, children }: RowProps) {
  const color = destructive ? Colors.error : Colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress && !!children}
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={20} color={destructive ? Colors.error : Colors.textSecondary} />
      <Text variant="heading" style={[styles.rowLabel, { color, fontSize: 16 }]}>
        {label}
      </Text>
      {children ??
        (value ? (
          <Text variant="label" tone="secondary">
            {value}
          </Text>
        ) : null)}
      {!children && !destructive && <Icon name="chevron" size={18} color={Colors.textSecondary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.canvas },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.xl },
  centered: { alignItems: 'center', justifyContent: 'center' },
  guest: { gap: Spacing.md, paddingHorizontal: Spacing.lg },
  guestText: { textAlign: 'center' },
  guestButton: { alignSelf: 'stretch', marginTop: Spacing.md },
  identity: { alignItems: 'center', gap: Spacing.xs },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: Colors.border },
  car: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 60 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowLabel: { flex: 1 },
});
