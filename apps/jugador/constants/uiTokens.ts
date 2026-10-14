import tokens from './uiTokens.json';

export type ThemeMode = 'light' | 'dark';

export const uiTokens = tokens;

export function getUiColors(theme: ThemeMode) {
  return theme === 'dark' ? uiTokens.dark : uiTokens.light;
}

export function getBrandColors() {
  return uiTokens.brand;
}
