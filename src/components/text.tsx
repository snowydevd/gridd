import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme, type Palette } from '@/theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'overline';
type Tone = 'primary' | 'secondary' | 'disabled' | 'accent' | 'onAccent' | 'error';

export type TextProps = RNTextProps & {
  variant?: Variant;
  tone?: Tone;
};

// `accent` como texto es `accentText`: el lima sólo se lee sobre fondo oscuro.
const toneToken: Record<Tone, keyof Palette> = {
  primary: 'text',
  secondary: 'textSecondary',
  disabled: 'textDisabled',
  accent: 'accentText',
  onAccent: 'onAccent',
  error: 'error',
};

export function Text({ variant = 'body', tone = 'primary', style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return <RNText style={[styles[variant], { color: colors[toneToken[tone]] }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  display: {
    fontFamily: Fonts.display,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.4,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 22,
    lineHeight: 26,
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: Fonts.semibold,
    fontSize: 17,
    lineHeight: 22,
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  label: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  caption: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 16,
  },
  overline: {
    fontFamily: Fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
