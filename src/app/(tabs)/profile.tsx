import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showDialog } from '@/components/dialog';
import { Icon, type IconName } from '@/components/icon';
import { RadiusOptions } from '@/components/radius-options';
import { Text } from '@/components/text';
import { Button, Card } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { carTitle, useMyCars } from '@/services/cars';
import { REQUEST_STATUS_LABELS, usePublisherRequest } from '@/services/publisher-requests';
import { useSavedEvents } from '@/services/saved';
import { searchRadiusLabel, useSearchRadius } from '@/services/search-radius';
import { useAvatarUpload, useCurrentUser, useInterests, useUserMeets } from '@/services/user';
import { darkPalette, makeStyles, useTheme } from '@/theme';

export default function ProfileScreen() {
  const { colors: c } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [alerts, setAlerts] = useState(true);
  const { user, isLoading, isGuest, isPublisher, signOut } = useCurrentUser();
  const {attended, organized} = useUserMeets()
  const { events: savedEvents } = useSavedEvents();
  const { status: requestStatus } = usePublisherRequest();

  const { cars } = useMyCars();
  const { interests } = useInterests();
  const { radius, setRadius } = useSearchRadius();
  const { pickAndUpload, removeAvatar, isUploading } = useAvatarUpload();
  const [radiusOpen, setRadiusOpen] = useState(false);

  const stats = [
    { value: attended, label: 'Encuentros' },
    { value: organized, label: 'Organizados' },
    { value: savedEvents.length, label: 'Guardados' },
  ];

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={c.accentText} />
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cambiar foto de perfil"
          disabled={isUploading}
          onPress={() => {
            // Sin foto propia (aunque tenga la del login social) no hay nada que quitar.
            if (!user.hasAvatar) return void pickAndUpload();
            showDialog('Foto de perfil', undefined, [
              { text: 'Cambiar foto', onPress: () => void pickAndUpload() },
              { text: 'Quitar foto', style: 'destructive', onPress: () => void removeAvatar() },
              { text: 'Cancelar', style: 'cancel' },
            ]);
          }}
          style={styles.avatarWrap}>
          <Image
            source={user.image ? { uri: user.image } : require('@/assets/images/meets/avatar.jpg')}
            style={styles.avatar}
            contentFit="cover"
          />
          {isUploading && (
            <View style={[styles.avatar, styles.avatarBusy]}>
              {/* Va sobre una capa oscura en los dos temas. */}
              <ActivityIndicator color={darkPalette.accentText} />
            </View>
          )}
          <View style={styles.avatarBadge}>
            <Icon name="camera" size={16} color={c.onAccent} />
          </View>
        </Pressable>
        <View style={styles.nameRow}>
          <Text variant="title">{user.name ?? 'Sin nombre'}</Text>
          {isPublisher && <Icon name="verified" size={18} color={c.accentText} />}
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

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/garage')}
        style={({ pressed }) => pressed && { opacity: 0.75 }}>
        <Card style={styles.car}>
          <View style={styles.rowIcon}>
            <Icon name="car" size={20} color={c.accentText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="heading" numberOfLines={1}>
              {cars[0] ? carTitle(cars[0]) : 'Agregá tu auto'}
            </Text>
            <Text variant="caption" tone="secondary">
              {cars.length > 1 ? `Mi garage · ${cars.length} autos` : 'Mi garage'}
            </Text>
          </View>
          <Icon name="chevron" size={18} color={c.textSecondary} />
        </Card>
      </Pressable>

      <Card style={styles.list}>
        {/* <Row icon="bell" label="Alertas de encuentros">
          <Switch
            value={alerts}
            onValueChange={setAlerts}
            trackColor={{ true: c.accentText, false: c.raised }}
            thumbColor={alerts ? c.onAccent : c.textSecondary}
          />
        </Row> */}
        <Row
          icon="check"
          label="Intereses"
          value={interests.length > 0 ? `${interests.length}` : undefined}
          onPress={() => router.push('/interests')}
        />
        {!isPublisher && (
          <Row
            icon="verified"
            label="Quiero organizar encuentros"
            value={requestStatus && requestStatus !== 'approved' ? REQUEST_STATUS_LABELS[requestStatus] : undefined}
            onPress={() => router.push('/organizer-request')}
          />
        )}
        <Row 
          icon='settings'
          label='Cuenta'
          onPress={() => router.push('/account-details')}
        />
        <Row
          icon="pin"
          label="Ubicación"
          value={searchRadiusLabel(radius)}
          expanded={radiusOpen}
          onPress={() => setRadiusOpen((open) => !open)}
        />
        {radiusOpen && (
          <RadiusOptions
            value={radius}
            onSelect={(option) => {
              setRadius(option);
              setRadiusOpen(false);
            }}
            optionStyle={styles.radiusOption}
          />
        )}
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
  /** Para filas que despliegan opciones: gira el chevron hacia abajo. */
  expanded?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
};

function Row({ icon, label, value, destructive, last, expanded, onPress, children }: RowProps) {
  const { colors: c } = useTheme();
  const styles = useStyles();
  const color = destructive ? c.error : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress && !!children}
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={20} color={destructive ? c.error : c.textSecondary} />
      <Text variant="heading" style={[styles.rowLabel, { color, fontSize: 16 }]}>
        {label}
      </Text>
      {children ??
        (value ? (
          <Text variant="label" tone="secondary">
            {value}
          </Text>
        ) : null)}
      {!children && !destructive && (
        <View style={expanded && { transform: [{ rotate: '90deg' }] }}>
          <Icon name="chevron" size={18} color={c.textSecondary} />
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.canvas },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.xl },
  centered: { alignItems: 'center', justifyContent: 'center' },
  guest: { gap: Spacing.md, paddingHorizontal: Spacing.lg },
  guestText: { textAlign: 'center' },
  guestButton: { alignSelf: 'stretch', marginTop: Spacing.md },
  identity: { alignItems: 'center', gap: Spacing.xs },
  avatarWrap: { marginBottom: Spacing.md },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: c.border,
  },
  avatarBusy: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accent,
    borderWidth: 2,
    borderColor: c.canvas,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: c.border },
  car: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: c.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 60 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
  rowLabel: { flex: 1 },
  // Sangría alineada con el texto de las filas; el borde inferior cierra la última opción antes de "Cerrar sesión".
  radiusOption: { paddingLeft: Spacing.xl + Spacing.md, borderBottomWidth: 1, borderBottomColor: c.border },
}));
