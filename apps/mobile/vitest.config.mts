import { defineConfig } from 'vitest/config';

// Only the pure-TS game logic runs under vitest (node env) — React Native screens and
// components stay outside its scope (no metro/babel here).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
