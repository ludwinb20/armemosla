import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * REVERSED_CLIENT_ID (solo cliente OAuth **iOS**). No usar el client id Web aquí.
 */
function googleIosUrlSchemeFromEnv(): string {
  const iosId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? '';
  if (!iosId) return 'com.googleusercontent.apps.dummy';
  const prefix = iosId.replace(/\.apps\.googleusercontent\.com$/i, '');
  return `com.googleusercontent.apps.${prefix}`;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = { ...config } as ExpoConfig;
  const scheme = googleIosUrlSchemeFromEnv();

  const plugins = (base.plugins ?? []).map((p: unknown) => {
    if (Array.isArray(p) && p[0] === '@react-native-google-signin/google-signin') {
      return ['@react-native-google-signin/google-signin', { iosUrlScheme: scheme }];
    }
    return p;
  });

  return {
    ...base,
    plugins,
  };
};
