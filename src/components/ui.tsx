import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { darkPalette, makeStyles, useTheme, withAlpha } from '@/theme';

/** "GR▮DD" wordmark: the accent bar stands in for the I. */
export function Wordmark({ size = 24 }: { size?: number }) {
  const styles = useStyles();
  const letter = { fontFamily: Fonts.display, fontSize: size, lineHeight: size * 1.1, letterSpacing: 1 };
  return (
    <View style={styles.wordmark} accessibilityLabel="Gridd" accessibilityRole="header">
      <Text style={letter}>GR</Text>
      <View style={[styles.wordmarkBar, { width: size * 0.16, height: size * 0.74, marginHorizontal: size * 0.08 }]} />
      <Text style={letter}>DD</Text>
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  iconPosition?: 'start' | 'end';
  disabled?: boolean;
  /** Muestra un spinner en lugar del ícono y bloquea el botón. */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconPosition = 'start',
  disabled,
  loading,
  style,
}: ButtonProps) {
  const { colors: c } = useTheme();
  const styles = useStyles();
  const fg = variant === 'primary' ? c.onAccent : variant === 'danger' ? c.onError : c.text;
  // Mientras carga mantiene el color normal: el spinner ya dice que no se puede tocar.
  const dimmed = disabled && !loading;
  const iconEl = loading ? (
    <ActivityIndicator size="small" color={fg} />
  ) : icon ? (
    <Icon name={icon} size={18} color={dimmed ? c.textDisabled : fg} />
  ) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        dimmed && styles.buttonDisabled,
        pressed && styles.pressed,
        style,
      ]}>
      {(iconPosition === 'start' || loading) && iconEl}
      <Text
        variant="heading"
        style={{ color: dimmed ? c.textDisabled : fg, fontSize: 16 }}>
        {label}
      </Text>
      {iconPosition === 'end' && !loading && iconEl}
    </Pressable>
  );
}

type IconButtonProps = {
  icon: IconName;
  onPress?: () => void;
  label: string;
  active?: boolean;
  /** Translucent dark background, for buttons that sit over photos. */
  overlay?: boolean;
  size?: number;
};

export function IconButton({ icon, onPress, label, active, overlay, size = 44 }: IconButtonProps) {
  const { colors: c } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size },
        overlay && styles.iconButtonOverlay,
        pressed && styles.pressed,
      ]}>
      {/* Sobre una foto el botón es oscuro en los dos temas. */}
      <Icon
        name={icon}
        size={20}
        color={overlay ? (active ? darkPalette.accentText : darkPalette.text) : active ? c.accentText : c.text}
      />
    </Pressable>
  );
}

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
};

export function Chip({ label, selected, onPress, icon }: ChipProps) {
  const { colors: c } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
      {/* Seleccionado se invierte: fondo del color del texto y texto del color del fondo. */}
      {icon && <Icon name={icon} size={16} color={selected ? c.canvas : c.textSecondary} />}
      <Text variant="label" style={{ color: selected ? c.canvas : c.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const { colors: c } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      hitSlop={8}
      style={({ pressed }) => [styles.checkbox, pressed && styles.pressed]}>
      <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
        {checked && <Icon name="check" size={14} color={c.onAccent} />}
      </View>
      <Text variant="label">{label}</Text>
    </Pressable>
  );
}

/** Small outlined tag, e.g. the event category. `overlay` keeps it dark for use on top of photos. */
export function Tag({ label, tone = 'default', overlay }: { label: string; tone?: 'default' | 'accent'; overlay?: boolean }) {
  const { colors: c } = useTheme();
  const styles = useStyles();
  const fg = tone === 'accent' ? c.onAccent : overlay ? darkPalette.text : c.text;
  return (
    <View style={[styles.tag, overlay && styles.tagOverlay, tone === 'accent' && styles.tagAccent]}>
      <Text variant="overline" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionHeader}>
      <Text variant="title">{title}</Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text variant="label" tone="secondary">
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

// [position %, alpha] of an ease-in-out curve. A plain two-stop gradient ends with a sudden change of
// slope that the eye reads as a hard line where the photo stops; easing both ends hides it.
const FADE_CURVE = [
  [0, 0], [8.1, 0.013], [15.5, 0.049], [22.5, 0.104], [29, 0.175], [35.2, 0.259], [41.1, 0.352],
  [47.1, 0.45], [52.9, 0.55], [58.8, 0.648], [64.8, 0.741], [71, 0.825], [77.5, 0.896], [84.5, 0.951],
  [91.9, 0.987], [100, 1],
];

/**
 * Vertical fade from transparent to the canvas color — used over photos. `opacity` caps the bottom.
 * Inside a `DarkScope` it fades to the dark canvas in both themes.
 */
export function Fade({ style, opacity = 1 }: { style?: StyleProp<ViewStyle>; opacity?: number }) {
  const { colors } = useTheme();
  const stops = FADE_CURVE.map(([at, alpha]) => `${withAlpha(colors.canvas, +(alpha * opacity).toFixed(3))} ${at}%`);
  const gradient = `linear-gradient(180deg, ${stops.join(', ')})`;
  const fill = Platform.OS === 'web'
    ? ({ backgroundImage: gradient } as ViewStyle)
    : { experimental_backgroundImage: gradient };
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, fill, style]} />;
}

const useStyles = makeStyles((c) => ({
  wordmark: { flexDirection: 'row', alignItems: 'center' },
  wordmarkBar: { backgroundColor: c.accentText, borderRadius: 1 },
  button: {
    minHeight: 52,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  buttonPrimary: { backgroundColor: c.accent },
  buttonSecondary: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  buttonDanger: { backgroundColor: c.error },
  buttonDisabled: { backgroundColor: c.raised },
  pressed: { opacity: 0.75 },
  iconButton: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  iconButtonOverlay: {
    backgroundColor: 'rgba(11,11,12,0.6)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chip: {
    height: 38,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipSelected: { backgroundColor: c.text, borderColor: c.text },
  checkbox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, alignSelf: 'flex-start' },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: { backgroundColor: c.accent, borderColor: c.accent },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    // Translúcida sobre el fondo: en oscuro es el mismo rgba(11,11,12,0.7) de siempre.
    backgroundColor: withAlpha(c.canvas, 0.7),
    borderWidth: 1,
    borderColor: c.border,
  },
  tagOverlay: { backgroundColor: 'rgba(11,11,12,0.7)', borderColor: darkPalette.border },
  tagAccent: { backgroundColor: c.accent, borderColor: c.accent },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: c.border,
  },
}));
