const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// SDK 52+ auto-detects monorepo structure — no manual watchFolders or nodeModulesPaths needed
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
