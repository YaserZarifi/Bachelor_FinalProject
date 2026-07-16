// Expo default Metro config. Having this file here also stops Metro from
// walking up the tree to the monorepo root looking for configuration.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
