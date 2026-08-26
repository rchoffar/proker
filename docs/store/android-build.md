# UPK — Android build & Google Sign-In setup

How to produce an installable Android APK and finish the one-time Google console setup that makes sign-in work on Android. Companion to `app-store-listing.md` (iOS).

- Android package: `fr.upk.app` · EAS project `758e18a1-a494-47de-b8e7-518879a3fc9e`
- Build profile: `preview` in `apps/mobile/eas.json` — `distribution: internal` + `android.buildType: apk` → a signed APK you can sideload (production stays AAB for Google Play).
- Signing: EAS-managed keystore, generated on the first `eas build -p android` (nothing stored in the repo).
- Login on Android: Apple button is hidden (iOS-only); Google Sign-In needs the console setup below — until then the Google button shows the localized sign-in error.

## Build the APK

```sh
cd apps/mobile
eas build -p android --profile preview
```

- First run: accept "Generate a new Android Keystore" (EAS creates and stores it).
- When the build finishes (~15–25 min), open the build page link (or `eas build:list`) on the phone, download the APK and install it (allow "install unknown apps" if prompted).

## One-time Google console setup (makes Google Sign-In work on Android)

Android sign-in uses Credential Manager via `@react-native-google-signin`: it needs an **Android** OAuth client (package + keystore SHA-1) to exist in the Google Cloud project, and a **Web** OAuth client whose ID is passed as `webClientId` (the id_token audience). No `google-services.json` needed.

**0. Get the keystore SHA-1** (exists only after the first build):

```sh
cd apps/mobile && eas credentials -p android
```

Select the `production` keystore — the summary prints the **SHA-1 fingerprint**. Copy it.

**In https://console.cloud.google.com → APIs & Services → Credentials**, in the **same project** that holds the iOS OAuth client (`1095846669375-vuocogitehuqh74bq9ogh89su33gf5hi.apps.googleusercontent.com`) — check the project selector at the top:

**1. Create Credentials → OAuth client ID → Application type: Android**
- Name: `UPK Android`
- Package name: `fr.upk.app`
- SHA-1 certificate fingerprint: the one from step 0
- Create. Nothing to copy — this client just needs to exist for Android sign-in to be allowed.

**2. Create Credentials → OAuth client ID → Application type: Web application**
- Name: `UPK Web (Android sign-in)`
- Authorized JavaScript origins / redirect URIs: leave empty (not used by native sign-in)
- Create → **copy the client ID** (`1095846669375-xxxx.apps.googleusercontent.com`). It goes in both places in steps 4–5.

**3. OAuth consent screen** — should already be configured from the iOS client. Verify app name/support email are set, and that the publishing status lets your Google account in (Testing → add yourself as a test user, or Published).

**4. Mobile:** add the Web client ID to `apps/mobile/eas.json` → `build.base.env` as `"EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "<web-client-id>"` (eas.json rejects empty values, so the key only exists once you have the ID; also add it to `apps/mobile/.env` for local dev).

**5. API:** the server accepts the Web audience once the secret is set (see `apps/api/src/auth/verify.ts`):

```sh
fly secrets set GOOGLE_WEB_CLIENT_ID=<web-client-id> -a upk-api
```

(`fly secrets set` redeploys the API automatically.)

**6. Rebuild** the APK (`eas build -p android --profile preview`) and reinstall — Google Sign-In now works end-to-end on Android.

## Notes for a future Play Store release

- `production` builds produce an AAB, auto-incremented versionCode (`appVersionSource: remote`).
- Google Play requires app signing enrollment; EAS keystore becomes the upload key.
- Review the merged Android permissions (expo-media-library injects media/storage ones) before submitting.
