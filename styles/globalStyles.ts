import { StyleSheet } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';

/**
 * Estilos globales reutilizables para toda la aplicación
 */

export const globalStyles = StyleSheet.create({
  // Contenedores
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  
  contentCentered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  
  // Tipografía
  heading1: {
    fontSize: Typography.fontSize.display,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
    lineHeight: Typography.fontSize.display * Typography.lineHeight.tight,
  },
  
  heading2: {
    fontSize: Typography.fontSize.xxxl,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
    lineHeight: Typography.fontSize.xxxl * Typography.lineHeight.tight,
  },
  
  heading3: {
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    lineHeight: Typography.fontSize.xxl * Typography.lineHeight.normal,
  },
  
  heading4: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text,
    lineHeight: Typography.fontSize.xl * Typography.lineHeight.normal,
  },
  
  body: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text,
    lineHeight: Typography.fontSize.md * Typography.lineHeight.normal,
  },
  
  bodySmall: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.textSecondary,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.normal,
  },
  
  caption: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.textTertiary,
    lineHeight: Typography.fontSize.xs * Typography.lineHeight.normal,
  },
  
  // Botones
  button: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  
  buttonPrimary: {
    backgroundColor: Colors.primary,
    ...Shadows.sm,
  },
  
  buttonSecondary: {
    backgroundColor: Colors.secondary,
    ...Shadows.sm,
  },
  
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  
  buttonText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textInverse,
  },
  
  buttonTextOutline: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.primary,
  },
  
  // Cards
  card: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.md,
  },
  
  cardElevated: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.lg,
  },
  
  // Inputs
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 48,
    fontSize: Typography.fontSize.md,
    color: Colors.text,
  },
  
  inputFocused: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  
  inputError: {
    borderColor: Colors.error,
  },
  
  // Utilidades
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  rowCenter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  spaceBetween: {
    justifyContent: 'space-between',
  },
  
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Espaciado
  marginTop: {
    marginTop: Spacing.md,
  },
  
  marginBottom: {
    marginBottom: Spacing.md,
  },
  
  marginVertical: {
    marginVertical: Spacing.md,
  },
  
  marginHorizontal: {
    marginHorizontal: Spacing.md,
  },
  
  padding: {
    padding: Spacing.md,
  },
  
  paddingHorizontal: {
    paddingHorizontal: Spacing.md,
  },
  
  paddingVertical: {
    paddingVertical: Spacing.md,
  },
  
  // Separadores
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.md,
  },
  
  dividerVertical: {
    width: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: Spacing.md,
  },
  
  // Badges
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  
  badgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textInverse,
  },
});

