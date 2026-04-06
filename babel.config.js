module.exports = function(api) {
  api.cache(true);
  return {
    presets: [
      'babel-preset-expo',
      'nativewind/babel',
    ],
    plugins: [
      'react-native-reanimated/plugin', // Debe ser el último plugin
    ],
  };
};

