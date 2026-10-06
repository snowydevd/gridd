import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'overline';
type Tone = 'primary' | 'secondary' | 'disabled' | 'accent' | 'onAccent' | 'error';

export type TextProps = RNTextProps & {
  variant?: Variant;
  tone?: Tone;
};

const toneColor: Record<Tone, string> = {
  primary: Colors.text,
  secondary: Colors.textSecondary,
  disabled: Colors.textDisabled,
  accent: Colors.accent,
  onAccent: Colors.onAccent,
  error: Colors.error,
};

export function Text({ variant = 'body', tone = 'primary', style, ...rest }: TextProps) {
  return <RNText style={[styles[variant], { color: toneColor[tone] }, style]} {...rest} />;
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
