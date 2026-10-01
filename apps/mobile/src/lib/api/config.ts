// Inlined at bundle time by Expo (dot-notation access is required for inlining).
// Auth and both turn-based games share the HTTP API on Vercel.
export const API_URL = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_BLUFF_SERVER_URL || (__DEV__ ? 'http://localhost:3001' : 'https://proker-api.vercel.app');

// Client ID iOS Google (Google Cloud Console → OAuth client iOS, bundle fr.upk.app).
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

// Client ID Web Google (Google Cloud Console → OAuth client "Web application") :
// requis par Credential Manager pour le sign-in Android. Voir docs/store/android-build.md.
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
