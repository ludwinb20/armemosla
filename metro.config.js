// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Configurar alias @/* — hay que fusionar con los alias de Expo (p. ej. módulos virtuales ./_expo/*).
// Si se reemplaza `alias` por completo, Metro falla con "Unable to resolve ./_expo/loading".
config.resolver.alias = {
  ...config.resolver.alias,
  '@': path.resolve(__dirname),
};

// pnpm: ayudar a Metro a resolver módulos hoisted/symlinked
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-css-interop': path.resolve(__dirname, 'node_modules/react-native-css-interop'),
  'expo-camera': path.resolve(__dirname, 'node_modules/expo-camera'),
};

module.exports = withNativeWind(config, { input: './global.css' });

