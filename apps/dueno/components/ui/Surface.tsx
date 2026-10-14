import React from 'react';
import { View, ViewProps, Platform, StyleSheet } from 'react-native';
import { BlurView, BlurViewProps } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';
import { getUiColors, uiTokens } from '@/constants/uiTokens';
import { cn } from '@/lib/cn';
import { ui } from '@/styles/index';

export type SurfaceVariant = 'glass' | 'solid' | 'overlay';

export interface SurfaceProps extends ViewProps {
  variant?: SurfaceVariant;
  intensity?: number;
  className?: string;
  children?: React.ReactNode;
}

export function getBlurViewProps(
  tint: 'light' | 'dark',
  intensity: number
): Pick<BlurViewProps, 'intensity' | 'tint' | 'experimentalBlurMethod'> {
  return {
    intensity,
    tint,
    ...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {}),
  };
}

export function Surface({
  variant = 'glass',
  intensity,
  className,
  children,
  style,
  ...props
}: SurfaceProps) {
  const { theme } = useTheme();
  const colors = getUiColors(theme);
  const tint = theme === 'dark' ? 'dark' : 'light';
  const baseClass = variant === 'solid' ? ui.surface.solid : ui.surface.base;

  const blurIntensity =
    intensity ??
    (variant === 'overlay' ? uiTokens.blur.intensityStrong : uiTokens.blur.intensity);

  const overlayColor =
    variant === 'overlay'
      ? colors.surfaceDialog
      : variant === 'glass'
        ? colors.surfaceGlassTint
        : colors.surfaceGlassSolid;

  if (Platform.OS === 'web') {
    const webBg = variant === 'glass' ? colors.surfaceGlass : overlayColor;
    return (
      <View
        className={cn(baseClass, className)}
        style={[{ backgroundColor: webBg }, style]}
        {...props}
      >
        {children}
      </View>
    );
  }

  if (variant === 'solid') {
    return (
      <View className={cn(baseClass, className)} style={style} {...props}>
        {children}
      </View>
    );
  }

  return (
    <View className={cn('relative overflow-hidden', baseClass, className)} style={style} {...props}>
      <BlurView
        {...getBlurViewProps(tint, blurIntensity)}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]}
      />
      <View className="relative z-10">{children}</View>
    </View>
  );
}
