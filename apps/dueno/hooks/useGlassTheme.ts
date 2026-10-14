import { useTheme } from '@/contexts/ThemeContext';
import { getBrandColors, getUiColors } from '@/constants/uiTokens';

/** Colores imperativos para APIs nativas que no aceptan className (tab bar, StatusBar, mapas). */
export function useGlassTheme() {
  const { theme } = useTheme();
  const colors = getUiColors(theme);
  const brand = getBrandColors();

  return {
    theme,
    colors: {
      ...colors,
      primary: brand.primary,
      success: brand.success,
      warning: brand.warning,
      error: brand.error,
      info: brand.info,
      /** Superficies semitransparentes (filas, chips). Inputs/modales usan surfaceGlassSolid. */
      surface: colors.surfaceGlass,
      border: colors.borderSubtle,
      borderLight: colors.borderSubtle,
      surfaceDark: colors.surfaceGlassSolid,
    },
    statusBarStyle: theme === 'dark' ? ('light-content' as const) : ('dark-content' as const),
    tabBar: {
      backgroundColor: colors.tabBar,
      borderTopColor: colors.borderSubtle,
      activeTintColor: brand.primary,
      inactiveTintColor: colors.textSecondary,
    },
  };
}
