/**
 * Archivo central de estilos usando Tailwind CSS
 * 
 * Este archivo exporta clases de Tailwind predefinidas que mapean
 * los valores del sistema de diseño de la app.
 * 
 * Uso:
 * import { styles } from '../styles';
 * 
 * <View className={styles.container}>
 *   <Text className={styles.text.primary}>Hola</Text>
 * </View>
 */

// Colores
export const colors = {
  // Backgrounds
  bg: {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    background: 'bg-background',
    surface: 'bg-surface',
    surfaceDark: 'bg-surface-dark',
    success: 'bg-success',
    warning: 'bg-warning',
    error: 'bg-error',
    info: 'bg-info',
  },
  // Text colors
  text: {
    primary: 'text-text',
    secondary: 'text-text-secondary',
    tertiary: 'text-text-tertiary',
    inverse: 'text-text-inverse',
    white: 'text-white',
    black: 'text-black',
  },
  // Border colors
  border: {
    default: 'border-border',
    light: 'border-border-light',
    dark: 'border-border-dark',
    primary: 'border-primary',
    secondary: 'border-secondary',
  },
} as const;

// Spacing
export const spacing = {
  xs: 'p-xs',
  sm: 'p-sm',
  md: 'p-md',
  lg: 'p-lg',
  xl: 'p-xl',
  xxl: 'p-xxl',
  xxxl: 'p-xxxl',
  // Padding horizontal
  px: {
    xs: 'px-xs',
    sm: 'px-sm',
    md: 'px-md',
    lg: 'px-lg',
    xl: 'px-xl',
  },
  // Padding vertical
  py: {
    xs: 'py-xs',
    sm: 'py-sm',
    md: 'py-md',
    lg: 'py-lg',
  },
  // Margin
  m: {
    xs: 'm-xs',
    sm: 'm-sm',
    md: 'm-md',
    lg: 'm-lg',
    xl: 'm-xl',
  },
  // Margin horizontal
  mx: {
    xs: 'mx-xs',
    sm: 'mx-sm',
    md: 'mx-md',
    lg: 'mx-lg',
  },
  // Margin vertical
  my: {
    xs: 'my-xs',
    sm: 'my-sm',
    md: 'my-md',
    lg: 'my-lg',
  },
} as const;

// Typography
export const typography = {
  // Font sizes
  size: {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-md',
    lg: 'text-lg',
    xl: 'text-xl',
    xxl: 'text-xxl',
    xxxl: 'text-xxxl',
    display: 'text-display',
  },
  // Font weights
  weight: {
    regular: 'font-regular',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  },
} as const;

// Border radius
export const borderRadius = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  xxl: 'rounded-xxl',
  full: 'rounded-full',
} as const;

// Layout
export const layout = {
  flex: {
    row: 'flex-row',
    col: 'flex-col',
    wrap: 'flex-wrap',
    nowrap: 'flex-nowrap',
    '1': 'flex-1',
    none: 'flex-none',
  },
  justify: {
    start: 'justify-start',
    end: 'justify-end',
    center: 'justify-center',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly',
  },
  items: {
    start: 'items-start',
    end: 'items-end',
    center: 'items-center',
    stretch: 'items-stretch',
    baseline: 'items-baseline',
  },
  position: {
    relative: 'relative',
    absolute: 'absolute',
    fixed: 'fixed',
  },
  overflow: {
    hidden: 'overflow-hidden',
    visible: 'overflow-visible',
    scroll: 'overflow-scroll',
  },
} as const;

// Common component styles
export const components = {
  // Buttons
  button: {
    primary: 'bg-primary rounded-md py-md px-lg shadow-sm',
    secondary: 'bg-secondary rounded-md py-md px-lg shadow-sm',
    secondaryLight: 'bg-secondary-light rounded-md py-md px-lg shadow-sm',
    secondaryOutline: 'bg-transparent border-2 border-secondary rounded-md py-md px-lg',
    outline: 'bg-transparent border-2 border-primary rounded-md py-md px-lg',
    danger: 'bg-error rounded-md py-md px-lg shadow-sm',
    success: 'bg-success rounded-md py-md px-lg shadow-sm',
  },
  // Cards
  card: 'bg-background rounded-lg p-md shadow-md',
  cardSecondary: 'bg-secondary/10 border border-secondary/20 rounded-lg p-md shadow-sm',
  // Inputs
  input: 'bg-surface rounded-md border border-border px-md h-10',
  inputSecondary: 'bg-surface rounded-md border-2 border-secondary/30 px-md h-10',
  // Container
  container: 'flex-1 bg-background',
  containerSecondary: 'flex-1 bg-secondary/5',
  // Safe area
  safeArea: 'flex-1 bg-background',
  // Badges
  badge: {
    primary: 'bg-primary/20 text-primary px-sm py-xs rounded-full text-xs font-semibold',
    secondary: 'bg-secondary/20 text-secondary px-sm py-xs rounded-full text-xs font-semibold',
    success: 'bg-success/20 text-success px-sm py-xs rounded-full text-xs font-semibold',
    warning: 'bg-warning/20 text-warning px-sm py-xs rounded-full text-xs font-semibold',
    error: 'bg-error/20 text-error px-sm py-xs rounded-full text-xs font-semibold',
  },
  // Icon containers
  iconContainer: {
    primary: 'bg-primary/20 p-md rounded-lg',
    secondary: 'bg-secondary/20 p-md rounded-lg',
    success: 'bg-success/20 p-md rounded-lg',
    warning: 'bg-warning/20 p-md rounded-lg',
    error: 'bg-error/20 p-md rounded-lg',
  },
} as const;

// Utility classes
export const utils = {
  // Shadows
  shadow: {
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    none: 'shadow-none',
  },
  // Opacity
  opacity: {
    '0': 'opacity-0',
    '25': 'opacity-25',
    '50': 'opacity-50',
    '75': 'opacity-75',
    '100': 'opacity-100',
  },
  // Width
  width: {
    full: 'w-full',
    auto: 'w-auto',
    screen: 'w-screen',
  },
  // Height
  height: {
    full: 'h-full',
    auto: 'h-auto',
    screen: 'h-screen',
  },
} as const;

// Combined styles object for easy access
export const styles = {
  colors,
  spacing,
  typography,
  borderRadius,
  layout,
  components,
  utils,
} as const;

export default styles;

