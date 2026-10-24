import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showDialog } from '@/components/dialog';
import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { ThemeOptions } from '@/components/theme-options';
import { Button, Card, IconButton } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { carErrorMessage } from '@/services/cars';
import { useSearchRadius } from '@/services/search-radius';
import { useCurrentUser, useDeleteAccount, useInterests } from '@/services/user';
import { makeStyles, themePreferenceLabel, useTheme, type Palette } from '@/theme';

const SITE = 'https://gridd.app';
const SUPPORT_EMAIL = 'hola@gridd.app';

const versionLabel = Constants.expoConfig?.version ?? '';

/** El navegador interno toma los colores del tema activo. */
function openPage(path: string, c: Palette) {
  void WebBrowser.openBrowserAsync(`${SITE}${path}`, {
    toolbarColor: c.canvas,
    controlsColor: c.accentText,
  });
}

function sendMail(subject: string, body = '') {
  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  Linking.openURL(url).catch(() =>
    showDialog('No pudimos abrir el mail', `Escribinos a ${SUPPORT_EMAIL}.`),
  );
}

/** Datos del teléfono para que soporte no tenga que preguntarlos. */
function deviceInfo() {
  return [
    '',
    '',
    '---',
    `Gridd ${versionLabel}`,
    `${Device.modelName ?? 'Dispositivo'} · ${Platform.OS} ${Device.osVersion ?? ''}`.trim(),
  ].join('\n');
}

export default function AccountDetailsScreen() {
  const { colors: c, preference, setPreference } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [themeOpen, setThemeOpen] = useState(false);
  const { user, isLoading, isGuest, isPublisher, signOut } = useCurrentUser();
  const { interests } = useInterests();
  const { radius, setRadius } = useSearchRadius();
  const [radiusOpen, setRadiusOpen] = useState(false);
  const deleteAccount = useDeleteAccount();
  const [deleting, setDeleting] = useState(false);

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

  const confirmDeletion = () =>
    showDialog(
      'Eliminar cuenta',
      'Se borran tu perfil, tus autos, tus anotaciones, tus guardados y los eventos que organizaste. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              router.replace('/');
              showDialog('Cuenta eliminada', 'Borramos tu cuenta y todos tus datos.');
            } catch (error) {
              if (__DEV__) console.log('[account] eliminar falló:', error);
              showDialog('No pudimos eliminar tu cuenta', carErrorMessage(error, 'Revisá tu conexión y probá de nuevo.'));
              setDeleting(false);
            }
          },
        },
      ],
    );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}>
      <View style={styles.header}>
        <IconButton icon="back" label="Volver" onPress={() => router.back()} />
        <Text variant="title">Cuenta</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Text variant="title">{user.name ?? 'Sin nombre'}</Text>
          {isPublisher && <Icon name="verified" size={18} color={c.accentText} />}
        </View>
        <Text variant="label" tone="secondary">
          {user.email}
        </Text>
      </View>

      {/* <Section title="Preferencias">
        <Row
          icon="check"
          label="Intereses"
          value={interests.length > 0 ? `${interests.length}` : undefined}
          onPress={() => router.push('/interests')}
        />
        <Row
          icon="pin"
          label="Ubicación"
          value={searchRadiusLabel(radius)}
          expanded={radiusOpen}
          onPress={() => setRadiusOpen((open) => !open)}
          last={!radiusOpen}
        />
        {radiusOpen && (
          <RadiusOptions
            value={radius}
            onSelect={(option) => {
              setRadius(option);
              setRadiusOpen(false);
            }}
            optionStyle={styles.radiusOption}
          />r
        )}
      </Section> */}

      <Section title="Preferencias">
        <Row
          icon="appearance"
          label="Apariencia"
          value={themePreferenceLabel(preference)}
          expanded={themeOpen}
          onPress={() => setThemeOpen((open) => !open)}
          last={!themeOpen}
        />
        {themeOpen && (
          <ThemeOptions
            value={preference}
            onSelect={(option) => {
              setPreference(option);
              setThemeOpen(false);
            }}
            optionStyle={styles.radiusOption}
          />
        )}
      </Section>

      {user.hasPassword && user.email && (
        <Section title="Seguridad">
          <Row
            icon="lock"
            label="Cambiar contraseña"
            onPress={() => router.push({ pathname: '/email', params: { mode: 'change', email: user.email! } })}
            last
          />
        </Section>
      )}

      <Section title="Ayuda">
        <Row icon="help" label="Contacto" external onPress={() => openPage('/contacto', c)} />
        <Row icon="mail" label="Reportar un problema" onPress={() => sendMail('Problema en la app', deviceInfo())} last />
      </Section>

      <Section title="Legal">
        <Row icon="document" label="Términos y condiciones" external onPress={() => openPage('/terminos', c)} />
        <Row icon="lock" label="Privacidad" external onPress={() => openPage('/privacidad', c)} />
        <Row icon="rules" label="Normas de la comunidad" external onPress={() => openPage('/normas', c)} last />
      </Section>

      {/* flexGrow + marginTop auto: con poco contenido queda al fondo de la pantalla. */}
      <View style={styles.footer}>
        <Row
          icon="trash"
          label={deleting ? 'Eliminando…' : 'Eliminar cuenta'}
          destructive
          onPress={deleting ? undefined : confirmDeletion}
          last
        />
        <Text variant="caption" tone="secondary" style={styles.version}>
          Gridd {versionLabel}
        </Text>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text variant="overline" tone="secondary">
        {title}
      </Text>
      <Card style={styles.list}>{children}</Card>
    </View>
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
  /** Abre una página fuera de la app: muestra la flecha de link en lugar del chevron. */
  external?: boolean;
  onPress?: () => void;
};

function Row({ icon, label, value, destructive, last, expanded, external, onPress }: RowProps) {
  const { colors: c } = useTheme();
  const styles = useStyles();
  const color = destructive ? c.error : c.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={external ? 'link' : 'button'}
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={20} color={destructive ? c.error : c.textSecondary} />
      <Text variant="heading" style={[styles.rowLabel, { color, fontSize: 16 }]}>
        {label}
      </Text>
      {value && (
        <Text variant="label" tone="secondary">
          {value}
        </Text>
      )}
      {!destructive && (
        <View style={expanded && { transform: [{ rotate: '90deg' }] }}>
          <Icon name={external ? 'external' : 'chevron'} size={18} color={c.textSecondary} />
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.canvas },
  content: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.xl },
  centered: { alignItems: 'center', justifyContent: 'center' },
  guest: { gap: Spacing.md, paddingHorizontal: Spacing.lg },
  guestText: { textAlign: 'center' },
  guestButton: { alignSelf: 'stretch', marginTop: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  identity: { alignItems: 'center', gap: Spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  section: { gap: Spacing.sm },
  list: { paddingHorizontal: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 56 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
  rowLabel: { flex: 1 },
  // Sangría alineada con el texto de las filas. Los bordes entre opciones los pone RadiusOptions.
  radiusOption: { paddingLeft: Spacing.xl + Spacing.md },
  footer: { marginTop: 'auto', paddingHorizontal: Spacing.lg },
  version: { textAlign: 'center', marginTop: Spacing.sm },
}));
