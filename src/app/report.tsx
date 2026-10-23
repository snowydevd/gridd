import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showDialog } from '@/components/dialog';
import { Text } from '@/components/text';
import { Button, Chip, IconButton } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { carErrorMessage } from '@/services/cars';
import type { EventView } from '@/services/events';
import type { Id } from '../../convex/_generated/dataModel';
import { REPORT_REASONS, useReportEvent, useReportUser, type ReportReason } from '@/services/reports';
import { useCurrentUser } from '@/services/user';

const MAX_NOTE = 500;

type Target = { kind: 'event'; eventId: EventView['_id'] } | { kind: 'user'; userId: Id<'users'> };

// Reporta un evento (`eventId`) o a un usuario (`userId`); `title` es lo que se muestra de él.
export default function ReportScreen() {
  const { eventId, userId, title } = useLocalSearchParams<{ eventId?: string; userId?: string; title?: string }>();
  const { isGuest } = useCurrentUser();
  if (isGuest) return <Redirect href="/login" />;
  const target: Target = userId
    ? { kind: 'user', userId: userId as Id<'users'> }
    : { kind: 'event', eventId: eventId as EventView['_id'] };
  return <ReportForm target={target} title={title} />;
}

function ReportForm({ target, title }: { target: Target; title?: string }) {
  const insets = useSafeAreaInsets();
  const reportEvent = useReportEvent();
  const reportUser = useReportUser();
  const { kind } = target;
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!reason) return;
    setSending(true);
    try {
      const fields = { reason, note: note.trim() || undefined };
      if (target.kind === 'user') await reportUser({ userId: target.userId, ...fields });
      else await reportEvent({ eventId: target.eventId, ...fields });
      router.back();
      showDialog(
        'Gracias por avisar',
        kind === 'user'
          ? 'Vamos a revisar a este usuario. Si no cumple las reglas, tomamos medidas.'
          : 'Vamos a revisar el evento. Si no cumple las reglas, lo sacamos.',
      );
    } catch (error) {
      if (__DEV__) console.log('[report] falló:', error);
      showDialog('No pudimos enviar el reporte', carErrorMessage(error, 'Revisá tu conexión y probá de nuevo.'));
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <IconButton icon="close" label="Cerrar" onPress={() => router.back()} />
        <Text variant="title">Reportar</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text tone="secondary">
          {title ? `¿Qué pasa con "${title}"?` : kind === 'user' ? '¿Qué pasa con este usuario?' : '¿Qué pasa con este evento?'}{' '}
          {kind === 'user' ? 'No le avisamos que lo reportaste.' : 'El reporte es anónimo para el organizador.'}
        </Text>
        <View style={styles.chips}>
          {REPORT_REASONS[kind].map((r) => (
            <Chip key={r.value} label={r.label} selected={reason === r.value} onPress={() => setReason(r.value)} />
          ))}
        </View>
        <View style={{ gap: Spacing.md }}>
          <Text variant="overline" tone="secondary">
            Contanos más (opcional)
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Lo que nos ayude a revisarlo"
            placeholderTextColor={Colors.textDisabled}
            style={styles.textarea}
            multiline
            maxLength={MAX_NOTE}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Button label="Enviar reporte" disabled={!reason} loading={sending} onPress={() => void send()} />
      </View>
    </KeyboardAvoidingView>
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
  textarea: {
    minHeight: 110,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontFamily: Fonts.body,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
});
