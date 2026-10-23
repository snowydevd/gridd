import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

/** "GR▮DD" wordmark: the accent bar stands in for the I. */
export function Wordmark({ size = 24 }: { size?: number }) {
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
  const fg = variant === 'primary' || variant === 'danger' ? Colors.onAccent : Colors.text;
  // Mientras carga mantiene el color normal: el spinner ya dice que no se puede tocar.
  const dimmed = disabled && !loading;
  const iconEl = loading ? (
    <ActivityIndicator size="small" color={fg} />
  ) : icon ? (
    <Icon name={icon} size={18} color={dimmed ? Colors.textDisabled : fg} />
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
        style={{ color: dimmed ? Colors.textDisabled : fg, fontSize: 16 }}>
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
      <Icon name={icon} size={20} color={active ? Colors.accent : Colors.text} />
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
      {icon && <Icon name={icon} size={16} color={selected ? Colors.onAccent : Colors.textSecondary} />}
      <Text variant="label" style={{ color: selected ? Colors.onAccent : Colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      hitSlop={8}
      style={({ pressed }) => [styles.checkbox, pressed && styles.pressed]}>
      <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
        {checked && <Icon name="check" size={14} color={Colors.onAccent} />}
      </View>
      <Text variant="label">{label}</Text>
    </Pressable>
  );
}

/** Small outlined tag, e.g. the event category. */
export function Tag({ label, tone = 'default' }: { label: string; tone?: 'default' | 'accent' }) {
  return (
    <View style={[styles.tag, tone === 'accent' && styles.tagAccent]}>
      <Text variant="overline" style={{ color: tone === 'accent' ? Colors.onAccent : Colors.text }}>
        {label}
      </Text>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
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
  return <View style={[styles.card, style]}>{children}</View>;
}

// [position %, alpha] of an ease-in-out curve. A plain two-stop gradient ends with a sudden change of
// slope that the eye reads as a hard line where the photo stops; easing both ends hides it.
const FADE_CURVE = [
  [0, 0], [8.1, 0.013], [15.5, 0.049], [22.5, 0.104], [29, 0.175], [35.2, 0.259], [41.1, 0.352],
  [47.1, 0.45], [52.9, 0.55], [58.8, 0.648], [64.8, 0.741], [71, 0.825], [77.5, 0.896], [84.5, 0.951],
  [91.9, 0.987], [100, 1],
];
const CANVAS_RGB = [1, 3, 5].map((i) => parseInt(Colors.canvas.slice(i, i + 2), 16)).join(',');

/** Vertical fade from transparent to the canvas color — used over photos. `opacity` caps the bottom. */
export function Fade({ style, opacity = 1 }: { style?: StyleProp<ViewStyle>; opacity?: number }) {
  const stops = FADE_CURVE.map(([at, alpha]) => `rgba(${CANVAS_RGB},${(alpha * opacity).toFixed(3)}) ${at}%`);
  const gradient = `linear-gradient(180deg, ${stops.join(', ')})`;
  const fill = Platform.OS === 'web'
    ? ({ backgroundImage: gradient } as ViewStyle)
    : { experimental_backgroundImage: gradient };
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, fill, style]} />;
}

const styles = StyleSheet.create({
  wordmark: { flexDirection: 'row', alignItems: 'center' },
  wordmarkBar: { backgroundColor: Colors.accent, borderRadius: 1 },
  button: {
    minHeight: 52,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  buttonPrimary: { backgroundColor: Colors.accent },
  buttonSecondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonDanger: { backgroundColor: Colors.error },
  buttonDisabled: { backgroundColor: Colors.raised },
  pressed: { opacity: 0.75 },
  iconButton: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
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
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipSelected: { backgroundColor: Colors.text, borderColor: Colors.text },
  checkbox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, alignSelf: 'flex-start' },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(11,11,12,0.7)',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagAccent: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
