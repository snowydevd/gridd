import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { IconButton } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

type Props<T extends string | number> = {
  label: string;
  value: T | null;
  options: T[];
  onChange: (value: T) => void;
  placeholder?: string;
  /** Muestra un buscador arriba de la lista (útil para marcas y modelos). */
  searchable?: boolean;
  disabled?: boolean;
};

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Campo que abre una lista a pantalla completa para elegir una opción. */
export function OptionPicker<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Elegir',
  searchable,
  disabled,
}: Props<T>) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = query ? options.filter((o) => normalize(String(o)).includes(normalize(query))) : options;

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.field}>
      <Text variant="overline" tone="secondary">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ?? placeholder}`}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.input, disabled && styles.inputDisabled, pressed && styles.pressed]}>
        <Text
          variant="heading"
          numberOfLines={1}
          style={[styles.value, { color: value == null || disabled ? Colors.textDisabled : Colors.text }]}>
          {value ?? placeholder}
        </Text>
        <Icon name="chevron" size={18} color={disabled ? Colors.textDisabled : Colors.textSecondary} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <View style={[styles.sheet, { paddingTop: insets.top + Spacing.sm }]}>
          <View style={styles.sheetHeader}>
            <IconButton icon="close" label="Cerrar" onPress={close} />
            <Text variant="title">{label}</Text>
            <View style={{ width: 44 }} />
          </View>
          {searchable && (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar"
              placeholderTextColor={Colors.textDisabled}
              selectionColor={Colors.accent}
              autoCorrect={false}
              autoFocus
              style={[styles.input, styles.search]}
            />
          )}
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.lg }}
            ListEmptyComponent={
              <Text tone="secondary" style={styles.empty}>
                No hay resultados.
              </Text>
            }
            renderItem={({ item }) => {
              const selected = item === value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onChange(item);
                    close();
                  }}
                  style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
                  <Text variant="heading" style={{ flex: 1, color: selected ? Colors.accent : Colors.text }}>
                    {item}
                  </Text>
                  {selected && <Icon name="check" size={18} color={Colors.accent} />}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.sm },
  input: {
    minHeight: 56,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  inputDisabled: { backgroundColor: Colors.canvas },
  value: { flex: 1, fontSize: 17 },
  pressed: { opacity: 0.75 },
  sheet: { flex: 1, backgroundColor: Colors.canvas, paddingHorizontal: Spacing.lg },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  search: { color: Colors.text, fontFamily: Fonts.medium, fontSize: 17, marginBottom: Spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  empty: { textAlign: 'center', marginTop: Spacing.xl },
});
