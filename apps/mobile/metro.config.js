const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// This repo has independent npm projects, so watch the shared engine explicitly.
const config = getDefaultConfig(__dirname);
const sharedRoot = path.resolve(__dirname, '../../packages');
config.watchFolders = [...config.watchFolders, sharedRoot];
// NodeNext uses .js specifiers; Metro reads the same sources directly as TypeScript.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const absolute = path.resolve(path.dirname(context.originModulePath), moduleName);
  if (moduleName.startsWith('.') && absolute.startsWith(sharedRoot + path.sep)) {
    return context.resolveRequest(context, absolute.replace(/\.js$/, '') + '.ts', platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
