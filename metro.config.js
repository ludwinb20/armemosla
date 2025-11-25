// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Configurar alias @/* para que funcione en tiempo de ejecución
config.resolver.alias = {
  '@': path.resolve(__dirname),
};

module.exports = config;

