import React from 'react';
import { View, ViewStyle, StyleProp, TextStyle } from 'react-native';
import { Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import BouncingSoccerBallLoader from './BouncingSoccerBallLoader';

type Props = {
  message?: string;
  messageStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  /** Sin flex:1 — modales, overlays y bloques inline */
  compact?: boolean;
};

export default function PlayerLoadingView({
  message = 'Cargando...',
  messageStyle,
  style,
  compact = false,
}: Props) {
  return (
    <View
      className={cn('justify-center items-center p-lg', compact ? 'flex-none py-xl' : 'flex-1')}
      style={style}
    >
      <BouncingSoccerBallLoader size={compact ? 48 : 56} />
      <Text variant="bodySecondary" className="mt-md text-center" style={messageStyle}>
        {message}
      </Text>
    </View>
  );
}
