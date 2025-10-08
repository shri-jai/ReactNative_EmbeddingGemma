const { mergeConfig, getDefaultConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);
const config = {
  resolver: {
    assetExts: [...defaultConfig.resolver.assetExts, 'onnx', 'json'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
// console.log(getDefaultConfig(__dirname));
console.log('New updated config', config);
