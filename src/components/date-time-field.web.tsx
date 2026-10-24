import { Fonts, Radius, Spacing } from '@/constants/theme';
// Web queda fuera del tema claro: usa siempre la paleta oscura.
import { darkPalette as Colors } from '@/theme';

import type { DateTimeFieldProps } from './date-time-field';

const pad = (n: number) => String(n).padStart(2, '0');
const toDateValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** En web no hay selector de @expo/ui: se usa el `<input type="date|time">` del navegador. */
export function DateTimeField({ mode, value, onChange, initial, minimumDate, accessibilityLabel }: DateTimeFieldProps) {
  return (
    <input
      type={mode}
      aria-label={accessibilityLabel}
      value={value ? (mode === 'date' ? toDateValue(value) : toTimeValue(value)) : ''}
      min={minimumDate && mode === 'date' ? toDateValue(minimumDate) : undefined}
      onChange={(e) => {
        const raw = e.currentTarget.value;
        if (!raw) return;
        const next = new Date(value ?? initial);
        if (mode === 'date') {
          const [y, m, d] = raw.split('-').map(Number);
          next.setFullYear(y, m - 1, d);
        } else {
          const [h, min] = raw.split(':').map(Number);
          next.setHours(h, min, 0, 0);
        }
        onChange(next);
      }}
      style={{
        height: 52,
        padding: `0 ${Spacing.lg}px`,
        borderRadius: Radius.lg,
        backgroundColor: Colors.surface,
        border: `1px solid ${Colors.border}`,
        color: Colors.text,
        fontFamily: Fonts.medium,
        fontSize: 15,
        colorScheme: 'dark',
      }}
    />
  );
}
