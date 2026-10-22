import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { Colors, Radius, Spacing } from '@/constants/theme';

export type DateTimeFieldProps = {
  mode: 'date' | 'time';
  value: Date | null;
  onChange: (value: Date) => void;
  placeholder: string;
  /** Texto del valor elegido, ej. "Sáb 25 oct" o "21:00". */
  format: (value: Date) => string;
  /** Desde dónde abre el selector si todavía no hay valor. */
  initial: Date;
  minimumDate?: Date;
  accessibilityLabel: string;
};

/**
 * Campo que abre el selector nativo de fecha u hora: diálogo de Material en Android, calendario o rueda
 * debajo del campo en iOS. En web está `date-time-field.web.tsx`.
 */
export function DateTimeField({
  mode,
  value,
  onChange,
  placeholder,
  format,
  initial,
  minimumDate,
  accessibilityLabel,
}: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={({ pressed }) => [styles.field, open && styles.fieldOpen, pressed && styles.pressed]}>
        <Icon name={mode === 'date' ? 'calendar' : 'clock'} size={18} color={Colors.textSecondary} />
        <Text variant="label" style={[styles.value, !value && { color: Colors.textDisabled }]}>
          {value ? format(value) : placeholder}
        </Text>
      </Pressable>
      {open && (
        <DateTimePicker
          value={value ?? initial}
          mode={mode}
          // En Android el diálogo se abre al montarlo y hay que desmontarlo al cerrarlo.
          presentation="dialog"
          display={Platform.OS === 'ios' ? (mode === 'date' ? 'inline' : 'spinner') : 'default'}
          is24Hour
          locale="es_UY"
          themeVariant="dark"
          accentColor={Colors.accent}
          minimumDate={minimumDate}
          onValueChange={(_, date) => {
            onChange(date);
            // En iOS la rueda avisa en cada giro; el selector queda abierto hasta tocar el campo otra vez.
            if (Platform.OS === 'android' || mode === 'date') setOpen(false);
          }}
          onDismiss={() => setOpen(false)}
          style={Platform.OS === 'ios' && styles.inline}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 52,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fieldOpen: { borderColor: Colors.accent },
  pressed: { opacity: 0.7 },
  value: { flex: 1, color: Colors.text },
  inline: { marginTop: Spacing.sm },
});
