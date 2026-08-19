// Inlined at bundle time by Expo (dot-notation access is required for inlining).
// Dev: EXPO_PUBLIC_BLUFF_SERVER_URL=http://<ip-locale>:3001 npx expo start
// Prod: set it in .env / EAS build env — see apps/api/README.md for deployment.
// The localhost fallback is dev-only; a release bundle missing the env var
// must not silently point at localhost.
export const BLUFF_SERVER_URL =
  process.env.EXPO_PUBLIC_BLUFF_SERVER_URL ?? (__DEV__ ? 'http://localhost:3001' : 'https://upk-api.fly.dev');
