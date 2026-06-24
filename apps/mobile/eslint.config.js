// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      // i18next default export pattern is intentional — i18n.use() is the correct API
      'import/no-named-as-default-member': 'off',
    },
  },
]);
