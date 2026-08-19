import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import * as SecureStore from 'expo-secure-store';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import type { AuthUser } from '../types';
import { ApiError, deleteMe, getMe, patchMe, postAuthApple, postAuthGoogle } from '../lib/api/client';
import { GOOGLE_IOS_CLIENT_ID } from '../lib/api/config';

// Le jeton de session ne passe JAMAIS par MMKV (non chiffré) : SecureStore uniquement.
const SESSION_TOKEN_KEY = 'proker-session-token';

const mmkv = createMMKV({ id: 'proker' });

const mmkvStorage = {
  setItem: (name: string, value: string) => { mmkv.set(name, value); },
  getItem: (name: string) => mmkv.getString(name) ?? null,
  removeItem: (name: string) => { mmkv.remove(name); },
};

// Un iosClientId vide fait crasher nativement GIDSignIn au premier signIn() :
// on ne configure que si l'ID est présent et on vérifie avant chaque signIn().
if (GOOGLE_IOS_CLIENT_ID) {
  GoogleSignin.configure({ iosClientId: GOOGLE_IOS_CLIENT_ID });
}

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthStore {
  status: AuthStatus;
  user: AuthUser | null;

  hydrate: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  setPseudo: (pseudo: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

async function requireToken(): Promise<string> {
  const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  if (!token) throw new ApiError(401, 'unauthorized');
  return token;
}

function isUserCancellation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: unknown }).code === 'ERR_REQUEST_CANCELED';
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      status: 'loading',
      user: null,

      hydrate: async () => {
        const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
        if (!token) {
          set({ status: 'signedOut', user: null });
          return;
        }
        // Offline-first : on entre avec le profil en cache, puis on rafraîchit en fond.
        set({ status: 'signedIn' });
        try {
          const { user } = await getMe(token);
          set({ user });
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) {
            await get().signOut();
          }
          // Erreur réseau : on garde le cache.
        }
      },

      signInWithGoogle: async () => {
        if (!GOOGLE_IOS_CLIENT_ID) throw new Error('missing EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');
        const response = await GoogleSignin.signIn();
        if (!isSuccessResponse(response)) return; // annulé par l'utilisateur
        const idToken = response.data.idToken;
        if (!idToken) throw new Error('missing idToken');
        const { token, user } = await postAuthGoogle(idToken);
        await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
        set({ status: 'signedIn', user });
      },

      signInWithApple: async () => {
        let credential: AppleAuthentication.AppleAuthenticationCredential;
        try {
          credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });
        } catch (e) {
          if (isUserCancellation(e)) return;
          throw e;
        }
        if (!credential.identityToken) throw new Error('missing identityToken');
        // Apple ne fournit l'email qu'à la première autorisation : on le transmet
        // pour que le serveur puisse le stocker.
        const { token, user } = await postAuthApple(credential.identityToken, credential.email);
        await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
        set({ status: 'signedIn', user });
      },

      setPseudo: async (pseudo: string) => {
        const token = await requireToken();
        const { user } = await patchMe(token, { pseudo: pseudo.trim() });
        set({ user });
      },

      signOut: async () => {
        await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
        set({ status: 'signedOut', user: null });
      },

      deleteAccount: async () => {
        const token = await requireToken();
        await deleteMe(token); // remonte l'erreur à l'écran si le serveur est injoignable
        await get().signOut();
      },
    }),
    {
      name: 'proker-auth-store',
      storage: createJSONStorage(() => mmkvStorage),
      // Seul le profil est persisté ; status repart de 'loading' et est résolu par hydrate().
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
