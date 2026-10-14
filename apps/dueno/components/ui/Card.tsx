import React from 'react';
import { Pressable, View, ViewProps } from 'react-native';
import { cn } from '@/lib/cn';
import { ui } from '@/styles/index';
import { Surface } from './Surface';

export type CardVariant = 'default' | 'elevated';

export interface CardProps extends ViewProps {
  variant?: CardVariant;
  onPress?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function Card({ variant = 'default', onPress, className, children, ...props }: CardProps) {
  const paddingClass = variant === 'elevated' ? ui.card.elevated : ui.card.default;
  const content = (
    <Surface
      variant="glass"
      className={cn(ui.card.base, paddingClass, onPress && ui.card.pressable, className)}
      {...props}
    >
      {children}
    </Surface>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} className="active:opacity-95">
        {content}
      </Pressable>
    );
  }

  return content;
}
