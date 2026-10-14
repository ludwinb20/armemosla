import React from 'react';
import { Pressable, PressableProps, ActivityIndicator, View } from 'react-native';
import { cn } from '@/lib/cn';
import { ui } from '@/styles/index';
import { Text } from './Text';
import { getBrandColors } from '@/constants/uiTokens';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
  textClassName?: string;
  children: React.ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: ui.button.primary,
  outline: ui.button.outline,
  ghost: ui.button.ghost,
  danger: ui.button.danger,
};

const textClass: Record<ButtonVariant, string> = {
  primary: ui.button.textPrimary,
  outline: ui.button.textOutline,
  ghost: ui.button.textGhost,
  danger: ui.button.textDanger,
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  textClassName,
  children,
  ...props
}: ButtonProps) {
  const brand = getBrandColors();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      className={cn(
        ui.button.base,
        ui.button.size[size],
        variantClass[variant],
        isDisabled && ui.button.disabled,
        className
      )}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? brand.primary : '#FFFFFF'}
          size="small"
        />
      ) : typeof children === 'string' ? (
        <Text className={cn(textClass[variant], textClassName)}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
