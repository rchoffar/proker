import { createRemoteJWKSet, jwtVerify } from 'jose';
import { APPLE_BUNDLE_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '../config.js';

export interface ProviderIdentity {
  sub: string;
  email?: string;
}

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

export async function verifyGoogleIdToken(idToken: string): Promise<ProviderIdentity> {
  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    // iOS émet des tokens aud=client iOS ; Android (via webClientId) aud=client Web.
    audience: [GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID].filter(Boolean),
  });
  if (!payload.sub) throw new Error('missing sub');
  return { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
}

export async function verifyAppleIdentityToken(identityToken: string): Promise<ProviderIdentity> {
  const { payload } = await jwtVerify(identityToken, appleJwks, {
    issuer: 'https://appleid.apple.com',
    audience: APPLE_BUNDLE_ID,
  });
  if (!payload.sub) throw new Error('missing sub');
  return { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
}
