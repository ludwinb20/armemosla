import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cn } from '@/lib/cn';
import { ui } from '@/styles/index';
import { Text } from './Text';
import { useGlassTheme } from '@/hooks/useGlassTheme';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  showChevron?: boolean;
  onPress?: () => void;
  className?: string;
  rightElement?: React.ReactNode;
}

export function ListRow({
  title,
  subtitle,
  icon,
  showChevron = true,
  onPress,
  className,
  rightElement,
}: ListRowProps) {
  const { colors } = useGlassTheme();

  const content = (
    <>
      {icon ? (
        <View className="w-10 h-10 rounded-lg bg-primary/15 items-center justify-center">
          <Ionicons name={icon} size={22} color={colors.primary} />
        </View>
      ) : null}
      <View className="flex-1">
        <Text className={ui.listRow.title}>{title}</Text>
        {subtitle ? <Text className={ui.listRow.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightElement}
      {showChevron && onPress ? (
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable className={cn(ui.listRow.base, className)} onPress={onPress}>
        {content}
      </Pressable>
    );
  }

  return <View className={cn(ui.listRow.base, className)}>{content}</View>;
}
