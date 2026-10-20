import { useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';

export type DialogButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type Dialog = { title: string; message?: string; buttons: DialogButton[] };

// Cola de diálogos fuera de React: así `showDialog` se puede llamar desde cualquier lado (pantallas,
// hooks de services/) igual que `Alert.alert`. Si llega uno mientras hay otro abierto, espera su turno.
let queue: Dialog[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reemplazo de `Alert.alert` con el estilo de Gridd. Sin botones muestra uno solo, "Entendido". */
export function showDialog(title: string, message?: string, buttons?: DialogButton[]) {
  queue = [...queue, { title, message, buttons: buttons?.length ? buttons : [{ text: 'Entendido' }] }];
  emit();
}

function close(button?: DialogButton) {
  queue = queue.slice(1);
  emit();
  button?.onPress?.();
}

/** Dibuja el diálogo de turno. Va una sola vez, en el layout raíz. */
export function DialogProvider() {
  const dialog = useSyncExternalStore(subscribe, () => queue[0]);
  if (!dialog) return null;

  const cancel = dialog.buttons.find((b) => b.style === 'cancel');
  // Las acciones arriba y "Cancelar" siempre al final, como en una hoja nativa.
  const actions = dialog.buttons.filter((b) => b !== cancel);
  const primary = actions.findLast((b) => b.style !== 'destructive');
  // Tocar afuera o "atrás" en Android equivale a cancelar; si no hay "Cancelar", cierra sin más
  // sólo cuando es un aviso de un botón (no hay decisión que se pierda).
  const dismissible = cancel !== undefined || actions.length === 1;
  const dismiss = () => {
    if (dismissible) close(cancel);
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Cerrar" />
        <View style={styles.card} accessibilityRole="alert">
          <Text variant="title">{dialog.title}</Text>
          {dialog.message && <Text tone="secondary">{dialog.message}</Text>}
          <View style={styles.buttons}>
            {actions.map((button) => (
              <Button
                key={button.text}
                label={button.text}
                variant={
                  button.style === 'destructive' ? 'danger' : button === primary ? 'primary' : 'secondary'
                }
                onPress={() => close(button)}
              />
            ))}
            {cancel && <Button label={cancel.text} variant="ghost" onPress={() => close(cancel)} />}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttons: { gap: Spacing.sm, marginTop: Spacing.md },
});
