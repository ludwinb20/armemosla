/**
 * Clases semánticas internas — solo importar desde components/ui/
 * Para cambiar el estilo visual, editar aquí (no en las vistas).
 */
export const ui = {
  screen: 'flex-1 bg-background dark:bg-background-dark',

  text: {
    h1: 'text-display font-bold text-text dark:text-text-dark-default',
    h2: 'text-xxxl font-bold text-text dark:text-text-dark-default',
    h3: 'text-xxl font-semibold text-text dark:text-text-dark-default',
    h4: 'text-xl font-semibold text-text dark:text-text-dark-default',
    body: 'text-md text-text dark:text-text-dark-default',
    bodySecondary: 'text-md text-text-secondary dark:text-text-dark-secondary',
    caption: 'text-sm text-text-secondary dark:text-text-dark-secondary',
    label: 'text-sm font-medium text-text dark:text-text-dark-default',
    inverse: 'text-md font-semibold text-text-inverse dark:text-text-dark-inverse',
  },

  surface: {
    base: 'overflow-hidden rounded-xl border border-border-glass dark:border-border-glass-dark',
    solid: 'overflow-hidden rounded-xl border border-border-subtle dark:border-border-subtle-dark bg-surface dark:bg-surface-dark',
    padding: 'p-md',
    paddingLg: 'p-lg',
  },

  button: {
    base: 'flex-row items-center justify-center rounded-lg active:opacity-80',
    size: {
      sm: 'min-h-[36px] px-md py-sm',
      md: 'min-h-[48px] px-lg py-md',
      lg: 'min-h-[52px] px-xl py-md',
    },
    primary: 'bg-primary',
    outline: 'bg-transparent border border-primary',
    ghost: 'bg-transparent',
    danger: 'bg-error',
    disabled: 'opacity-50',
    textPrimary: 'text-text-inverse font-semibold text-md',
    textOutline: 'text-primary font-semibold text-md',
    textGhost: 'text-text dark:text-text-dark-default font-semibold text-md',
    textDanger: 'text-text-inverse font-semibold text-md',
  },

  input: {
    wrapper: 'gap-xs',
    label: 'text-sm font-medium text-text dark:text-text-dark-default mb-xs',
    base: 'min-h-[48px] rounded-lg border border-border-subtle dark:border-border-subtle-dark bg-surface dark:bg-surface-dark px-md text-md text-text dark:text-text-dark-default',
    focused: 'border-primary',
    error: 'border-error',
    errorText: 'text-sm text-error mt-xs',
    helper: 'text-sm text-text-secondary dark:text-text-dark-secondary mt-xs',
  },

  card: {
    base: 'rounded-xl border border-border-glass dark:border-border-glass-dark overflow-hidden',
    default: 'p-md',
    elevated: 'p-lg',
    pressable: 'active:opacity-90',
  },

  chip: {
    base: 'px-md py-xs rounded-full border',
    default: 'bg-surface dark:bg-surface-dark border-border-subtle dark:border-border-subtle-dark',
    active: 'bg-primary/15 border-primary',
    text: 'text-sm font-medium text-text dark:text-text-dark-default',
    textActive: 'text-sm font-medium text-primary',
  },

  divider: 'h-px bg-border-subtle dark:bg-border-subtle-dark my-md',

  listRow: {
    base: 'flex-row items-center py-md px-md gap-md active:opacity-80',
    title: 'text-md font-medium text-text dark:text-text-dark-default flex-1',
    subtitle: 'text-sm text-text-secondary dark:text-text-dark-secondary',
  },

  modal: {
    center: 'flex-1 justify-center items-center px-lg',
    bottom: 'flex-1 justify-end',
    sheet: 'w-full rounded-t-xl overflow-hidden border border-border-glass dark:border-border-glass-dark',
    sheetPadding: 'p-lg',
  },

  alert: {
    card: 'w-full max-w-[400px] rounded-xl overflow-hidden border border-border-glass dark:border-border-glass-dark p-lg',
    title: 'text-lg font-semibold text-text dark:text-text-dark-default text-center mb-sm',
    message: 'text-md text-text-secondary dark:text-text-dark-secondary text-center mb-lg leading-[22px]',
    actions: 'flex-row gap-sm',
  },

  callout: {
    base: 'mb-md border',
    row: 'flex-row items-start gap-md',
    iconWrap: 'w-10 h-10 rounded-lg items-center justify-center shrink-0',
    body: 'flex-1',
    title: 'text-md font-semibold text-text dark:text-text-dark-default',
    message: 'text-sm text-text-secondary dark:text-text-dark-secondary leading-5',
    messageWithTitle: 'text-sm text-text-secondary dark:text-text-dark-secondary leading-5 mt-0.5',
  },

  tabBar: {
    container: 'border-t border-border-subtle dark:border-border-subtle-dark',
  },
} as const;

export default ui;
