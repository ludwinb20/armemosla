import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ViewProps } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getUiColors, getBrandColors } from '@/constants/uiTokens';
import { cn } from '@/lib/cn';
import { ui } from '@/styles/index';

export interface ScreenProps extends ViewProps {
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  /** Orbes decorativos detrás del contenido (desactivar en pantallas que deben verse sólidas). */
  ambient?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** Orbes suaves detrás del contenido — el blur de las cards se aprecia mejor. */
function ScreenAmbientBackdrop() {
  const { theme } = useTheme();
  const brand = getBrandColors();
  const primaryGlow = theme === 'dark' ? '22' : '14';
  const secondaryGlow = theme === 'dark' ? '12' : '0A';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={{
          position: 'absolute',
          top: -72,
          right: -48,
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: `${brand.primary}${primaryGlow}`,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 220,
          left: -96,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: `${brand.primary}${secondaryGlow}`,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 100,
          right: -40,
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
        }}
      />
    </View>
  );
}

export function Screen({
  edges = ['top', 'bottom'],
  ambient = false,
  className,
  children,
  style,
  ...props
}: ScreenProps) {
  const { theme } = useTheme();
  const colors = getUiColors(theme);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView
        className={cn(ui.screen, className)}
        style={[{ backgroundColor: colors.background }, style]}
        edges={edges}
        {...props}
      >
        {ambient ? <ScreenAmbientBackdrop /> : null}
        {children}
      </SafeAreaView>
    </View>
  );
}

export function ScreenContent({ className, children, style, ...props }: ViewProps) {
  return (
    <View className={cn('flex-1 px-md', className)} style={style} {...props}>
      {children}
    </View>
  );
}
