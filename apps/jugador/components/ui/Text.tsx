import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getUiColors } from '@/constants/uiTokens';
import { cn } from '@/lib/cn';
import { ui } from '@/styles/index';

export type TextVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'bodySecondary' | 'caption' | 'label' | 'inverse';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  className?: string;
  children?: React.ReactNode;
}

const variantClass: Record<TextVariant, string> = {
  h1: ui.text.h1,
  h2: ui.text.h2,
  h3: ui.text.h3,
  h4: ui.text.h4,
  body: ui.text.body,
  bodySecondary: ui.text.bodySecondary,
  caption: ui.text.caption,
  label: ui.text.label,
  inverse: ui.text.inverse,
};

function getVariantColor(variant: TextVariant, theme: 'light' | 'dark') {
  const colors = getUiColors(theme);
  if (variant === 'bodySecondary' || variant === 'caption') return colors.textSecondary;
  if (variant === 'inverse') return colors.textInverse;
  return colors.text;
}

export function Text({ variant = 'body', className, style, children, ...props }: TextProps) {
  const { theme } = useTheme();

  return (
    <RNText
      className={cn(variantClass[variant], className)}
      style={[{ color: getVariantColor(variant, theme) }, style]}
      {...props}
    >
      {children}
    </RNText>
  );
}
