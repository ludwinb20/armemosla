// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.alias = {
  ...config.resolver.alias,
  '@': projectRoot,
  '@armemosla/shared': path.resolve(workspaceRoot, 'packages/shared/src'),
};

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-css-interop': path.resolve(projectRoot, 'node_modules/react-native-css-interop'),
  'expo-camera': path.resolve(projectRoot, 'node_modules/expo-camera'),
};

module.exports = withNativeWind(config, { input: './global.css' });
