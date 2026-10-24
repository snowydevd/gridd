import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { Spacing } from '@/constants/theme';
import { makeStyles, THEME_PREFERENCES, themePreferenceLabel, useTheme, type ThemePreference } from '@/theme';

type Props = {
  value: ThemePreference;
  onSelect: (preference: ThemePreference) => void;
  /** Estilo extra de cada opción (p. ej. sangría en Cuenta). */
  optionStyle?: StyleProp<ViewStyle>;
};

/** Sistema, Claro u Oscuro, con el elegido marcado. Mismo patrón que `RadiusOptions`. */
export function ThemeOptions({ value, onSelect, optionStyle }: Props) {
  const { colors: c } = useTheme();
  const styles = useStyles();
  return THEME_PREFERENCES.map((option, i) => {
    const selected = option === value;
    const last = i === THEME_PREFERENCES.length - 1;
    return (
      <Pressable
        key={option}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => onSelect(option)}
        style={({ pressed }) => [styles.option, !last && styles.border, optionStyle, pressed && { opacity: 0.7 }]}>
        <Text variant="label" style={{ flex: 1, color: selected ? c.accentText : c.text }}>
          {themePreferenceLabel(option)}
        </Text>
        {option === 'system' && (
          <Text variant="caption" tone="secondary">
            Como tu teléfono
          </Text>
        )}
        {selected && <Icon name="check" size={18} color={c.accentText} />}
      </Pressable>
    );
  });
}

const useStyles = makeStyles((c) => ({
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 48 },
  border: { borderBottomWidth: 1, borderBottomColor: c.border },
}));
