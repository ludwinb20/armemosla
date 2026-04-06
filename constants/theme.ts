/**
 * Sistema de diseño y estilos basado en el logo de Armemosla
 * 
 * Este archivo contiene todos los colores, tipografías, espaciados
 * y otros valores de diseño que se usarán consistentemente en la app.
 */

export type ThemeMode = 'dark' | 'light';

// Paleta de colores para modo oscuro (default)
export const darkColors = {
  // Colores principales - Verde logo (#00C56E)
  primary: '#00C56E', // Verde logo principal
  primaryDark: '#00A05A', // Verde más oscuro
  primaryLight: '#00E07D', // Verde más claro
  
  // Colores secundarios - Variante del verde
  secondary: '#00A05A',      // Verde secundario
  secondaryDark: '#008045',   // Verde más oscuro
  secondaryLight: '#00C56E',  // Verde logo (mismo que primary)
  
  // Colores de acento - Variante del verde
  accent: '#00E07D', // Verde acento
  accentDark: '#00C56E',
  accentLight: '#1AE88F',
  
  // Colores neutros - Fondo negro (#000000)
  background: '#000000', // Negro puro principal para fondos
  surface: '#121212',       // Gris muy oscuro para cards y elementos
  surfaceDark: '#0A0A0A',   // Gris más oscuro para contraste
  surfaceLight: '#1A1A1A',  // Gris más claro
  
  // Colores de texto - Blanco (#FFFFFF)
  text: '#FFFFFF', // Blanco para texto principal
  textSecondary: '#CCCCCC', // Gris claro para texto secundario
  textTertiary: '#999999', // Gris medio para texto terciario
  textInverse: '#000000', // Negro para texto sobre fondos claros
  
  // Colores de estado
  success: '#00C56E', // Verde logo para éxito
  warning: '#F59E0B', // Naranja/ámbar para advertencias
  error: '#EF4444', // Rojo para errores
  info: '#00C56E', // Verde logo para información
  
  // Colores de borde - Gris grafito (#2A2A2A)
  border: '#2A2A2A', // Gris grafito para bordes
  borderLight: '#3A3A3A', // Gris claro para bordes sutiles
  borderDark: '#1A1A1A', // Gris oscuro para bordes destacados
  
  // Colores de sombra
  shadow: 'rgba(0, 0, 0, 0.3)', // Sombra negra
  shadowDark: 'rgba(0, 0, 0, 0.5)',
  
  // Colores de overlay
  overlay: 'rgba(0, 0, 0, 0.8)', // Overlay negro
  overlayLight: 'rgba(0, 0, 0, 0.5)',
};

// Paleta de colores para modo claro
export const lightColors = {
  // Colores principales - Verde logo (#00C56E) - igual en ambos modos
  primary: '#00C56E',
  primaryDark: '#00A05A',
  primaryLight: '#00E07D',
  
  // Colores secundarios - igual en ambos modos
  secondary: '#00A05A',
  secondaryDark: '#008045',
  secondaryLight: '#00C56E',
  
  // Colores de acento - igual en ambos modos
  accent: '#00E07D',
  accentDark: '#00C56E',
  accentLight: '#1AE88F',
  
  // Colores neutros - Fondo claro
  background: '#FFFFFF', // Blanco para fondos
  surface: '#F5F5F5',       // Gris muy claro para cards
  surfaceDark: '#E5E5E5',   // Gris claro para contraste
  surfaceLight: '#FAFAFA',  // Casi blanco
  
  // Colores de texto - Negro sobre fondo claro
  text: '#000000', // Negro para texto principal
  textSecondary: '#666666', // Gris oscuro para texto secundario
  textTertiary: '#999999', // Gris medio para texto terciario
  textInverse: '#FFFFFF', // Blanco para texto sobre fondos oscuros
  
  // Colores de estado - igual en ambos modos
  success: '#00C56E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#00C56E',
  
  // Colores de borde - Gris claro
  border: '#E0E0E0', // Gris claro para bordes
  borderLight: '#F0F0F0', // Gris muy claro para bordes sutiles
  borderDark: '#CCCCCC', // Gris medio para bordes destacados
  
  // Colores de sombra
  shadow: 'rgba(0, 0, 0, 0.1)', // Sombra negra suave
  shadowDark: 'rgba(0, 0, 0, 0.2)',
  
  // Colores de overlay
  overlay: 'rgba(0, 0, 0, 0.5)', // Overlay negro
  overlayLight: 'rgba(0, 0, 0, 0.3)',
};

// Exportar Colors como dark por defecto (para compatibilidad con código existente)
export const Colors = darkColors;

// Función para obtener colores según el tema
export function getColors(theme: ThemeMode = 'dark') {
  return theme === 'light' ? lightColors : darkColors;
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const Typography = {
  // Tamaños de fuente
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    display: 40,
  },
  
  // Pesos de fuente
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  
  // Alturas de línea
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  
  // Familias de fuente (ajustar según el logo)
  fontFamily: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
  },
};

export const BorderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  md: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.20,
    shadowRadius: 3.84,
    elevation: 5,
  },
  lg: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.23,
    shadowRadius: 6.27,
    elevation: 8,
  },
  xl: {
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 10.32,
    elevation: 12,
  },
};

export const Layout = {
  // Breakpoints (para web)
  breakpoints: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
  },
  
  // Anchos comunes
  containerMaxWidth: 1200,
  cardMaxWidth: 400,
  
  // Alturas comunes
  headerHeight: 50,
  tabBarHeight: 60,
  buttonHeight: 40,
  inputHeight: 40,
};

// Estilos de componentes comunes
export const ComponentStyles = {
  button: {
    primary: {
      backgroundColor: Colors.primary,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      ...Shadows.sm,
    },
    secondary: {
      backgroundColor: Colors.secondary,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      ...Shadows.sm,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: Colors.primary,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
  },
  
  card: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.md,
  },
  
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: Layout.inputHeight,
  },
};

export default {
  Colors,
  Spacing,
  Typography,
  BorderRadius,
  Shadows,
  Layout,
  ComponentStyles,
};

