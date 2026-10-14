import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cn } from '@/lib/cn';
import { useGlassTheme } from '@/hooks/useGlassTheme';
import { Card } from './Card';
import { Text } from './Text';

export interface MenuRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  hint?: string;
  hintColor?: string;
  iconColor?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  className?: string;
}

/** Fila de menú con superficie glass (blur + semitransparencia). */
export function MenuRow({
  icon,
  title,
  subtitle,
  hint,
  hintColor,
  iconColor,
  onPress,
  rightElement,
  className,
}: MenuRowProps) {
  const { colors } = useGlassTheme();

  const content = (
    <View className="flex-row items-center">
      <Ionicons name={icon} size={24} color={iconColor ?? colors.text} />
      <View className="flex-1 ml-sm">
        <Text className="text-md font-medium">{title}</Text>
        {subtitle ? (
          <Text variant="caption" className="mt-0.5">
            {subtitle}
          </Text>
        ) : null}
        {hint ? (
          <Text variant="caption" className="mt-0.5" style={{ color: hintColor ?? colors.warning }}>
            {hint}
          </Text>
        ) : null}
      </View>
      {rightElement}
      {onPress && !rightElement ? (
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Card onPress={onPress} className={cn('mb-sm', className)}>
        {content}
      </Card>
    );
  }

  return <Card className={cn('mb-sm', className)}>{content}</Card>;
}
