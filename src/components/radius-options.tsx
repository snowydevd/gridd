import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { Colors, Spacing } from '@/constants/theme';
import { SEARCH_RADII, searchRadiusLabel, type SearchRadius } from '@/services/search-radius';

type Props = {
  value: SearchRadius;
  onSelect: (radius: SearchRadius) => void;
  /** Estilo extra de cada opción (p. ej. sangría en el perfil). */
  optionStyle?: StyleProp<ViewStyle>;
};

/** Lista de rangos de "Cerca tuyo", con el elegido marcado. La usan el perfil e Inicio. */
export function RadiusOptions({ value, onSelect, optionStyle }: Props) {
  return SEARCH_RADII.map((option, i) => {
    const selected = option === value;
    const last = i === SEARCH_RADII.length - 1;
    return (
      <Pressable
        key={option}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => onSelect(option)}
        style={({ pressed }) => [styles.option, !last && styles.border, optionStyle, pressed && { opacity: 0.7 }]}>
        <Text variant="label" style={{ flex: 1, color: selected ? Colors.accent : Colors.text }}>
          {searchRadiusLabel(option)}
        </Text>
        {option === 'all' && (
          <Text variant="caption" tone="secondary">
            Todo el país
          </Text>
        )}
        {selected && <Icon name="check" size={18} color={Colors.accent} />}
      </Pressable>
    );
  });
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 48 },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.border },
});
