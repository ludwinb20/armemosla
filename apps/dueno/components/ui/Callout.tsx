import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cn } from '@/lib/cn';
import { ui } from '@/styles/index';
import { useGlassTheme } from '@/hooks/useGlassTheme';
import { Card } from './Card';
import { Text } from './Text';

export type CalloutVariant = 'primary' | 'warning' | 'error' | 'info';

export interface CalloutProps {
  variant?: CalloutVariant;
  icon: keyof typeof Ionicons.glyphMap;
  title?: string;
  message?: string;
  subtitle?: string;
  onPress?: () => void;
  className?: string;
}

const variantBorderClass: Record<CalloutVariant, string> = {
  primary: 'border-primary/35',
  info: 'border-primary/35',
  warning: 'border-warning/35',
  error: 'border-error/35',
};

const variantIconBgClass: Record<CalloutVariant, string> = {
  primary: 'bg-primary/15',
  info: 'bg-primary/15',
  warning: 'bg-warning/15',
  error: 'bg-error/15',
};

export function Callout({
  variant = 'primary',
  icon,
  title,
  message,
  subtitle,
  onPress,
  className,
}: CalloutProps) {
  const { colors } = useGlassTheme();
  const accentColor =
    variant === 'warning'
      ? colors.warning
      : variant === 'error'
        ? colors.error
        : colors.primary;
  const bodyText = message ?? subtitle;

  const content = (
    <View className={ui.callout.row}>
      <View className={cn(ui.callout.iconWrap, variantIconBgClass[variant])}>
        <Ionicons name={icon} size={22} color={accentColor} />
      </View>
      <View className={ui.callout.body}>
        {title ? <Text className={ui.callout.title}>{title}</Text> : null}
        {bodyText ? (
          <Text className={title ? ui.callout.messageWithTitle : ui.callout.message}>
            {bodyText}
          </Text>
        ) : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={20} color={accentColor} /> : null}
    </View>
  );

  return (
    <Card
      onPress={onPress}
      className={cn(ui.callout.base, variantBorderClass[variant], className)}
    >
      {content}
    </Card>
  );
}
