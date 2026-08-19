function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

export const AUTH_JWT_SECRET = required('AUTH_JWT_SECRET');
export const GOOGLE_IOS_CLIENT_ID = required('GOOGLE_IOS_CLIENT_ID');
export const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID ?? 'fr.upk.app';
export const DATABASE_PATH = process.env.DATABASE_PATH ?? './dev.db';
