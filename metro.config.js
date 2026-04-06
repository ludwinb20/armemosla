// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Configurar alias @/* para que funcione en tiempo de ejecución
config.resolver.alias = {
  '@': path.resolve(__dirname),
};

// Asegurar que react-native-css-interop se resuelva correctamente
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-css-interop': path.resolve(__dirname, 'node_modules/react-native-css-interop'),
};

module.exports = withNativeWind(config, { input: './global.css' });

