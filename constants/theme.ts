/**
 * Sistema de diseño y estilos basado en el logo de Armemosla
 * 
 * Este archivo contiene todos los colores, tipografías, espaciados
 * y otros valores de diseño que se usarán consistentemente en la app.
 */

export const Colors = {
  // Colores principales - Verde basado en el logo
  primary: '#34C759', // Verde principal del logo
  primaryDark: '#28A745', // Verde oscuro
  primaryLight: '#5AD27D', // Verde claro
  
  // Colores secundarios - Azul
  secondary: '#1E3A8A',      // Azul profundo
  secondaryDark: '#162A63',   // Azul más oscuro
  secondaryLight: '#3B5BAF',  // Azul claro
  
  // Colores de acento - Verde complementario
  accent: '#2ECC71', // Verde acento
  accentDark: '#27AE60',
  accentLight: '#58D68D',
  
  // Colores neutros - Fondos
  background: '#FFFFFF',
  surface: '#FFFFFF',       // Blanco puro para cards y elementos
  surfaceDark: '#F8F8F8',   // Blanco con tinte muy sutil para contraste
  
  // Colores de texto - Grises oscuros
  text: '#1D1D1F',
  textSecondary: '#6E6E73',
  textTertiary: '#86868B',
  textInverse: '#FFFFFF',
  
  // Colores de estado
  success: '#34C759', // Verde para éxito
  warning: '#FF9500', // Naranja para advertencias
  error: '#FF3B30', // Rojo para errores
  info: '#34C759', // Verde para información
  
  // Colores de borde
  border: '#D1D1D6',
  borderLight: '#E5E5EA',
  borderDark: '#C7C7CC',
  
  // Colores de sombra
  shadow: 'rgba(0, 0, 0, 0.1)',
  shadowDark: 'rgba(0, 0, 0, 0.2)',
  
  // Colores de overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
};

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

