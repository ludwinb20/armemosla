import React from 'react';
import { Pressable, PressableProps } from 'react-native';
import { cn } from '@/lib/cn';
import { ui } from '@/styles/index';
import { Text } from './Text';

export interface ChipProps extends PressableProps {
  active?: boolean;
  label: string;
  className?: string;
}

export function Chip({ active = false, label, className, ...props }: ChipProps) {
  return (
    <Pressable
      className={cn(ui.chip.base, active ? ui.chip.active : ui.chip.default, className)}
      {...props}
    >
      <Text className={active ? ui.chip.textActive : ui.chip.text}>{label}</Text>
    </Pressable>
  );
}
