import React from 'react';
import { View, ViewProps } from 'react-native';
import { cn } from '@/lib/cn';
import { ui } from '@/styles/index';

export function Divider({ className, ...props }: ViewProps) {
  return <View className={cn(ui.divider, className)} {...props} />;
}
