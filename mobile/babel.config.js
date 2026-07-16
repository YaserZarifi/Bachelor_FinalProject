module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 52) automatically includes the
    // react-native-reanimated plugin when the library is installed.
    presets: ['babel-preset-expo'],
  };
};
