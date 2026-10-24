/**
 * Gridd color tokens for both themes. Pure module (no React Native) so it runs in tests.
 *
 * `accent` is only a fill with `onAccent` on top: lime on white is ~1.1:1 and disappears.
 * Wherever the accent is text, an icon, a dot or a thin line, use `accentText`, which in the
 * dark theme is the same lime and in the light theme a dark olive.
 */

export type Palette = {
  canvas: string;
  surface: string;
  raised: string;
  border: string;
  text: string;
  textSecondary: string;
  textDisabled: string;
  accent: string;
  onAccent: string;
  accentText: string;
  success: string;
  warning: string;
  error: string;
  onError: string;
};

/** "Night-time starting grid": asphalt surfaces and a single kinetic accent. */
export const darkPalette: Palette = {
  canvas: '#0B0B0C',
  surface: '#17181B',
  raised: '#1F2024',
  border: '#2A2C30',
  text: '#F2F3F5',
  textSecondary: '#8A8F98',
  textDisabled: '#4A4E55',
  accent: '#E2FF3B',
  onAccent: '#0B0B0C',
  accentText: '#E2FF3B',
  success: '#3DDC84',
  warning: '#FFB020',
  error: '#FF4D4F',
  onError: '#0B0B0C',
};

/** "Papel": warm off-white canvas, white cards, near-black ink. */
export const lightPalette: Palette = {
  canvas: '#F6F5F0',
  surface: '#FFFFFF',
  raised: '#EEEDE7',
  border: '#E1DFD7',
  text: '#121212',
  textSecondary: '#5E6168',
  textDisabled: '#A3A6AC',
  accent: '#E2FF3B',
  onAccent: '#0B0B0C',
  accentText: '#4F5E00',
  success: '#16794A',
  warning: '#9A5B00',
  error: '#C8282B',
  onError: '#FFFFFF',
};

export type Scheme = 'light' | 'dark';
export type ThemePreference = 'system' | Scheme;

export const THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];

const LABELS: Record<ThemePreference, string> = { system: 'Sistema', light: 'Claro', dark: 'Oscuro' };

export function themePreferenceLabel(preference: ThemePreference) {
  return LABELS[preference];
}

/** Without a known system scheme the app stays dark, as it always was. */
export function resolveScheme(preference: ThemePreference, system: Scheme | null | undefined): Scheme {
  return preference === 'system' ? (system ?? 'dark') : preference;
}

export function parsePreference(raw: string | null | undefined): ThemePreference {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

/** `#RRGGBB` with alpha, as `rgba(r,g,b,a)`. */
export function withAlpha(hex: string, alpha: number) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

/** WCAG contrast ratio between two `#RRGGBB` colors. */
export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
