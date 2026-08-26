import { Platform } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import type { AuthUser } from '../types';
import { ApiError, deleteMe, getMe, patchMe, postAuthApple, postAuthGoogle } from '../lib/api/client';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '../lib/api/config';
import { mmkvStorage } from './mmkvStorage';
import { clearSessionToken, getSessionToken, setSessionToken } from './sessionToken';
import { clearHandHistory } from './useHandHistoryStore';

// iOS s'appuie sur iosClientId ; Android (Credential Manager) exige webClientId.
const GOOGLE_CLIENT_ID = Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : GOOGLE_WEB_CLIENT_ID;
const GOOGLE_CLIENT_ID_ENV =
  Platform.OS === 'ios' ? 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID' : 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID';

// Un iosClientId vide fait crasher nativement GIDSignIn au premier signIn() :
// on ne configure que si l'ID de la plateforme est présent et on vérifie avant chaque signIn().
if (GOOGLE_CLIENT_ID) {
  GoogleSignin.configure({
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
  });
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
  const token = await getSessionToken();
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
        const token = await getSessionToken();
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
        if (!GOOGLE_CLIENT_ID) throw new Error(`missing ${GOOGLE_CLIENT_ID_ENV}`);
        const response = await GoogleSignin.signIn();
        if (!isSuccessResponse(response)) return; // annulé par l'utilisateur
        const idToken = response.data.idToken;
        if (!idToken) throw new Error('missing idToken');
        const { token, user } = await postAuthGoogle(idToken);
        await setSessionToken(token);
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
        await setSessionToken(token);
        set({ status: 'signedIn', user });
      },

      setPseudo: async (pseudo: string) => {
        const token = await requireToken();
        const { user } = await patchMe(token, { pseudo: pseudo.trim() });
        set({ user });
      },

      signOut: async () => {
        await clearSessionToken();
        // Les mains en cache appartiennent au compte qui part — les garder ferait fuiter
        // (et re-synchroniser) ses mains vers le prochain compte connecté sur cet appareil.
        clearHandHistory();
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
