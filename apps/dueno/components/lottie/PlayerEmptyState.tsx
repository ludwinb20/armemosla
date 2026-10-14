import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { Text, Button } from '@/components/ui';
import { LottieVariant } from '../../constants/lottieAssets';
import { cn } from '@/lib/cn';
import SoccerLottie from './SoccerLottie';

type Props = {
  variant: LottieVariant;
  title: string;
  text: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  actionLabel?: string;
  onAction?: () => void;
};

const EMPTY_SIZES: Partial<Record<LottieVariant, number>> = {
  loading: 104,
  emptyField: 96,
  waitingPlayers: 96,
  trophy: 72,
  team: 88,
};

export default function PlayerEmptyState({
  variant,
  title,
  text,
  style,
  compact = false,
  actionLabel,
  onAction,
}: Props) {
  const lottieSize = EMPTY_SIZES[variant] ?? 96;

  return (
    <View
      className={cn(
        'justify-center items-center px-lg',
        compact ? 'flex-none py-xl' : 'flex-1 py-xxl'
      )}
      style={style}
    >
      <SoccerLottie variant={variant} size={lottieSize} />
      <Text variant="h4" className="mt-md text-center">
        {title}
      </Text>
      <Text variant="caption" className="mt-sm text-center leading-5">
        {text}
      </Text>
      {actionLabel && onAction ? (
        <Button size="sm" onPress={onAction} className="mt-lg">
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}
