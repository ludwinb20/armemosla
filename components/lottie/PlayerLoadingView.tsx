import React from 'react';
import { StyleSheet, Text, View, ViewStyle, StyleProp, TextStyle } from 'react-native';
import { Typography, Spacing } from '../../constants/theme';
import { useThemeColors } from '../../hooks/useThemeColors';
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
  const colors = useThemeColors();

  return (
    <View style={[styles.container, compact && styles.containerCompact, style]}>
      <BouncingSoccerBallLoader size={compact ? 48 : 56} />
      <Text style={[styles.message, { color: colors.textSecondary }, messageStyle]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  containerCompact: {
    flex: 0,
    paddingVertical: Spacing.xl,
  },
  message: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
  },
});
