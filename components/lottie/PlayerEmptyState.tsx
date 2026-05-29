import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';
import { LottieVariant } from '../../constants/lottieAssets';
import { useThemeColors } from '../../hooks/useThemeColors';
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
  const colors = useThemeColors();
  const lottieSize = EMPTY_SIZES[variant] ?? 96;

  return (
    <View style={[styles.container, compact && styles.containerCompact, style]}>
      <SoccerLottie variant={variant} size={lottieSize} />
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.text, { color: colors.textSecondary }]}>{text}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={[styles.action, { backgroundColor: Colors.primary }]}
          onPress={onAction}
          activeOpacity={0.85}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  containerCompact: {
    flex: 0,
    paddingVertical: Spacing.xl,
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  text: {
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  action: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  actionText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
});
