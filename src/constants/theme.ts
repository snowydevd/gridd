/**
 * Gridd design tokens — "night-time starting grid".
 * Asphalt surfaces, 1px structural borders and a single kinetic accent
 * reserved for the primary action, active states and "hoy" badges.
 */

export const Colors = {
  canvas: '#0B0B0C',
  surface: '#17181B',
  raised: '#1F2024',
  border: '#2A2C30',
  text: '#F2F3F5',
  textSecondary: '#8A8F98',
  textDisabled: '#4A4E55',
  accent: '#E2FF3B',
  onAccent: '#0B0B0C',
  success: '#3DDC84',
  warning: '#FFB020',
  error: '#FF4D4F',
} as const;

export const Fonts = {
  display: 'Chivo_800ExtraBold',
  displayBold: 'Chivo_700Bold',
  body: 'HankenGrotesk_400Regular',
  medium: 'HankenGrotesk_500Medium',
  semibold: 'HankenGrotesk_600SemiBold',
  bold: 'HankenGrotesk_700Bold',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
} as const;

/** Height of the custom bottom tab bar (excluding the safe-area inset). */
export const TabBarHeight = 64;
