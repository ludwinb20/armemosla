import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';
import { getUiColors } from '@/constants/uiTokens';
import { getBlurViewProps } from './Surface';

/** Fondo glass para tab bar — contenido difuminado y semitransparente detrás. */
export function TabBarBackground() {
  const { theme } = useTheme();
  const colors = getUiColors(theme);
  const tint = theme === 'dark' ? 'dark' : 'light';

  if (Platform.OS === 'web') {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBar }]} />;
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView {...getBlurViewProps(tint, 80)} style={StyleSheet.absoluteFill} />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBar }]}
      />
    </View>
  );
}
