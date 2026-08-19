import { BLUFF_SERVER_URL } from '../bluff/config';

// Inlined at bundle time by Expo (dot-notation access is required for inlining).
// L'API auth vit sur le même serveur Fly que le relais Bluff.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? BLUFF_SERVER_URL;

// Client ID iOS Google (Google Cloud Console → OAuth client iOS, bundle fr.upk.app).
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
