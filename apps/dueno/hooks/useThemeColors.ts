import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../constants/theme';

/**
 * Hook para obtener los colores según el tema actual
 * 
 * Uso:
 * const colors = useThemeColors();
 * <View style={{ backgroundColor: colors.background }} />
 */
export function useThemeColors() {
  const { theme } = useTheme();
  return getColors(theme);
}

