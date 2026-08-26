import * as SecureStore from 'expo-secure-store';

// Le jeton de session ne passe JAMAIS par MMKV (non chiffré) : SecureStore uniquement.
// Extrait dans son propre module pour que d'autres stores (historique de mains) puissent
// lire le jeton sans importer useAuthStore (évite un cycle d'imports).
const SESSION_TOKEN_KEY = 'proker-session-token';

export function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_TOKEN_KEY);
}

export function setSessionToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken(): Promise<void> {
  return SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
}
