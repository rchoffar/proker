// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const i18next = require('eslint-plugin-i18next');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      // i18next default export pattern is intentional — i18n.use() is the correct API
      'import/no-named-as-default-member': 'off',
    },
  },
  {
    // Every user-facing string must go through t() with keys in BOTH src/i18n/en/ and
    // src/i18n/fr/ (enforced by src/i18n/__tests__/parity.test.ts). Pure logic in
    // src/lib and mock data are exempt: libs return codes/ids translated at render.
    files: ['app/**/*.tsx', 'src/components/**/*.tsx', 'src/hooks/**/*.ts', 'src/hooks/**/*.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': {
            include: ['label', 'title', 'placeholder', 'text', 'description', 'hint', 'subtitle', 'value'],
          },
          words: {
            exclude: [
              // Poker jargon and proper names that stay identical in every language.
              'BTN', 'SB', 'BB', 'UTG', 'CO', 'HJ', 'LJ', 'MP',
              'ITM', 'ROI', 'Ante', 'UPK', 'Ultimate', 'Poker Kit', 'Ultimate Poker Kit', 'EUR', 'Main Event',
              'Flip', 'Roulette', 'Bluff', '^D$',
              // Strings with no letters at all: numbers, symbols, arrows, punctuation.
              '^[^a-zA-Z]+$',
              // Single lowercase-led identifier-like tokens: enum values, i18n keys,
              // event names ('itm', 'flop', 'detail.buyIn', 'tabPress'). Real UI copy
              // starts with an uppercase letter or contains spaces.
              '^[a-z][a-zA-Z0-9_.-]*$',
              // Color literals.
              '^#[0-9A-Fa-f]{3,8}$',
              '^rgba?\\(.*\\)$',
            ],
          },
        },
      ],
    },
  },
]);
