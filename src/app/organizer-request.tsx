import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showDialog } from '@/components/dialog';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { Button, Card, IconButton } from '@/components/ui';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { carErrorMessage } from '@/services/cars';
import { REQUEST_MAX, REQUEST_MIN, usePublisherRequest } from '@/services/publisher-requests';
import { useCurrentUser } from '@/services/user';
import { makeStyles, useTheme } from '@/theme';

// Un usuario común pide permiso para publicar eventos; un admin lo aprueba desde el dashboard.
export default function OrganizerRequestScreen() {
  const { colors: c } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { isLoading, isGuest, isPublisher } = useCurrentUser();
  const { request, status, submit } = usePublisherRequest();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (isGuest) return <Redirect href="/login" />;
  // Ya puede publicar (por ejemplo, lo aprobaron mientras tenía la pantalla abierta).
  if (isPublisher) return <Redirect href="/" />;

  const length = message.trim().length;
  const send = async () => {
    setSending(true);
    try {
      await submit({ message });
      setMessage('');
      showDialog('¡Solicitud enviada!', 'La vamos a revisar y te avisamos. Cuando la aprobemos vas a poder publicar.');
    } catch (error) {
      if (__DEV__) console.log('[organizer-request] falló:', error);
      showDialog('No pudimos enviar la solicitud', carErrorMessage(error, 'Revisá tu conexión y probá de nuevo.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <IconButton icon="back" label="Volver" onPress={() => router.back()} />
        <Text variant="title">Organizar encuentros</Text>
        <View style={{ width: 44 }} />
      </View>

      {isLoading || request === undefined ? (
        <View style={[styles.screen, styles.centered]}>
          <ActivityIndicator color={c.accentText} />
        </View>
      ) : status === 'pending' ? (
        <View style={styles.content}>
          <Card style={styles.status}>
            <Icon name="clock" size={24} color={c.accentText} />
            <View style={{ flex: 1, gap: Spacing.xs }}>
              <Text variant="heading">Tu solicitud está en revisión</Text>
              <Text variant="label" tone="secondary">
                Cuando la aprobemos vas a ver el botón para publicar eventos.
              </Text>
            </View>
          </Card>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {status === 'rejected' && (
              <Card style={styles.status}>
                <Icon name="close" size={24} color={c.error} />
                <View style={{ flex: 1, gap: Spacing.xs }}>
                  <Text variant="heading">No aprobamos tu última solicitud</Text>
                  <Text variant="label" tone="secondary">
                    Podés mandar otra con más detalles sobre los encuentros que organizás.
                  </Text>
                </View>
              </Card>
            )}
            <Text tone="secondary">
              Para publicar eventos en Gridd necesitamos saber quién sos. Contanos qué encuentros organizás, dónde, y
              dejanos un Instagram o grupo donde podamos verlos.
            </Text>
            <View style={{ gap: Spacing.sm }}>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Ej: Organizo la junada de los jueves en Pocitos, @juntadapocitos"
                placeholderTextColor={c.textDisabled}
                style={styles.textarea}
                multiline
                maxLength={REQUEST_MAX}
              />
              <Text variant="caption" tone="secondary" style={styles.counter}>
                {length}/{REQUEST_MAX}
              </Text>
            </View>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <Button
              label="Enviar solicitud"
              disabled={length < REQUEST_MIN}
              loading={sending}
              onPress={() => void send()}
            />
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.canvas },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: { padding: Spacing.lg, gap: Spacing.xl },
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  textarea: {
    minHeight: 140,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    color: c.text,
    fontFamily: Fonts.body,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end' },
  footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
}));
