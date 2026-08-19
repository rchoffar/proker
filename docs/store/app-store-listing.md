# UPK — App Store submission kit

Everything to paste into App Store Connect. Limits are noted per field; all texts below respect them.

- Bundle ID: `fr.upk.app` · Team ID: `J9M3DDY93R` · EAS project `758e18a1-a494-47de-b8e7-518879a3fc9e`
- Privacy policy URL: **https://upk-api.fly.dev/privacy**
- Support URL: **https://upk-api.fly.dev/support**
- Marketing URL (optional): https://upk-api.fly.dev/support
- Copyright: `© 2026 Remy Choffardet`
- Primary category: **Games** (subcategories: **Card** + **Board**) — Secondary category: **Sports**
  - Games is primary because the card games are the app's center. When Games is primary, App Store Connect asks for two game subcategories: pick **Card** (Bluff/OFC are card games) and **Board** (tabletop-with-friends fits; Casual also acceptable).
  - Do **not** pick the **Casino** subcategory: it signals gambling, invites extra review scrutiny, and is regulated/blocked in some storefronts — UPK has no real-money play, so nothing forces it.
  - Secondary **Sports** covers the companion side (live-tournament tracker/planner); **Entertainment** is a fine alternative.
- Before `eas submit`: add `ascAppId` (numeric Apple ID of the app, App Store Connect → App Information → General → Apple ID) and your `appleId` login email to `apps/mobile/eas.json` under `submit.production.ios`, or let `eas submit -p ios --latest` prompt for them on first run.

---

## en-US listing

**Name** (30 max, must match/rename the existing App Store Connect record)
```
UPK – Ultimate Poker Kit
```

**Subtitle** (30 max — 28 chars)
```
Card games with your friends
```

**Promotional text** (170 max)
```
Bluff, OFC and more — free poker card games to play with friends, plus a hand replayer, a session tracker and live festival schedules. No ads, no real-money play.
```

**Description** (4000 max)
```
UPK (Ultimate Poker Kit) is a collection of free poker card games to play with your friends — at the table, on the couch, or online — wrapped in a complete toolkit for live poker players. No ads, no tracking, and no real-money gambling. Ever.

PLAY WITH YOUR FRIENDS
• Bluff — a fast-paced bluffing card game. Call out your friends' lies in pass-and-play, or create a private room and play online.
• OFC — Open Face Chinese poker, the grinders' favorite. Pass-and-play or online with friends.
• Flip & roulette — instant coin-flip style games to settle any debate at the table.

All games are purely recreational: no real-money wagering, no chips to buy, no payouts.

REPLAY YOUR HANDS
Rebuild any hand you played with the built-in hand replayer: positions, blinds, stacks, action street by street. Save it, replay it, and share a clean recap card with your friends.

TRACK YOUR RESULTS
Log your tournaments and cash sessions in seconds: buy-ins, cashes, venues, stakes. Follow your bankroll, ROI and ITM rate with clear charts. Your data stays on your device.

FESTIVALS AT A GLANCE
Browse upcoming live poker festivals and their schedules, and plan which events you'll play.

PRIVATE BY DESIGN
Sign in with Apple or Google in seconds — no forms, no passwords. We collect nothing beyond your email and an account ID; your sessions and hands stay on your device. No ads, no analytics, no data resale — and you can delete your account in one tap.

Fully available in English and French.

UPK is an independent app and is not affiliated with or endorsed by any poker operator or tournament organizer. Event names and logos are used solely to identify real-world festivals.
```

**Keywords** (100 max, comma-separated, no spaces — 92 chars)
```
poker,card,games,bluff,ofc,friends,holdem,replayer,tracker,bankroll,tournament,live,festival
```

## fr-FR listing

**Name / Nom** (30 max)
```
UPK – Ultimate Poker Kit
```

**Subtitle / Sous-titre** (30 max — 25 chars)
```
Jeux de cartes entre amis
```

**Promotional text / Texte promotionnel** (170 max)
```
Bluff, OFC et plus — des jeux de cartes poker gratuits entre amis, plus un hand replayer, un tracker de sessions et les programmes des festivals. Sans pub, sans argent réel.
```

**Description** (4000 max)
```
UPK (Ultimate Poker Kit) est une collection de jeux de cartes poker gratuits à jouer entre amis — à la table, sur le canapé ou en ligne — accompagnée d'une boîte à outils complète pour les joueurs de poker live. Sans pub, sans tracking et sans jeu d'argent réel. Jamais.

JOUEZ AVEC VOS AMIS
• Bluff — un jeu de cartes de bluff nerveux. Démasquez les mensonges de vos amis en pass-and-play, ou créez un salon privé et jouez en ligne.
• OFC — l'Open Face Chinese poker, le chouchou des grinders. En pass-and-play ou en ligne entre amis.
• Flip & roulette — des jeux instantanés façon pile ou face pour départager n'importe quel débat à la table.

Tous les jeux sont purement récréatifs : aucune mise en argent réel, aucun jeton à acheter, aucun gain.

REVIVEZ VOS MAINS
Reconstituez n'importe quelle main avec le hand replayer intégré : positions, blindes, tapis, action street par street. Sauvegardez-la, rejouez-la et partagez un récap élégant avec vos amis.

SUIVEZ VOS RÉSULTATS
Enregistrez vos tournois et sessions de cash game en quelques secondes : buy-ins, gains, lieux, stakes. Suivez votre bankroll, votre ROI et votre taux ITM avec des graphiques clairs. Vos données restent sur votre appareil.

LES FESTIVALS EN UN COUP D'ŒIL
Parcourez les festivals de poker live à venir et leurs programmes, et planifiez les événements que vous jouerez.

CONFIDENTIALITÉ PAR CONCEPTION
Connectez-vous avec Apple ou Google en quelques secondes — sans formulaire, sans mot de passe. Nous ne collectons rien d'autre que votre e-mail et un identifiant de compte ; vos sessions et vos mains restent sur votre appareil. Pas de pub, pas d'analytics, pas de revente de données — et votre compte se supprime en un geste.

Disponible intégralement en français et en anglais.

UPK est une application indépendante, sans affiliation ni parrainage d'aucun opérateur de poker ou organisateur de tournois. Les noms et logos d'événements servent uniquement à identifier des festivals réels.
```

**Keywords / Mots-clés** (100 max, séparés par des virgules, sans espaces — 87 chars)
```
poker,cartes,jeux,bluff,ofc,amis,holdem,replayer,tracker,bankroll,tournoi,live,festival
```

---

## App Review notes (paste into "Notes" in the review information section)

```
UPK is a collection of free recreational poker card games (Bluff, OFC, coin-flip games) played between friends, bundled with companion tools for live poker players (personal results tracking, hand replay, festival schedule browsing).

IMPORTANT — no gambling:
- There is NO real-money wagering anywhere in the app: no bets, no deposits, no payouts, no virtual currency, no in-app purchases.
- The app does NOT link to any gambling operator, betting flow, or casino service.
- Poker operator/festival logos shown in the app (e.g. on festival cards) are nominative use only, to identify real-world tournament series the user may attend — exactly like a TV-guide app showing channel logos. UPK is not affiliated with these brands and does not claim to be.

Account / sign-in:
- Sign-in is required to use the app. The demo-account fields contain placeholders because the app has no password-based login: the only sign-in methods are Sign in with Apple and Sign in with Google. Account creation is free, instant, and has no extra steps — please sign in with any Apple ID via "Sign in with Apple" (Sign in with Google is also offered, per guideline 4.8).
- Account deletion is available in-app: Profile tab → Delete account (guideline 5.1.1(v)).

Privacy: the only data collected is email + account identifier + user-chosen nickname, used solely for authentication and online play. No ads, no analytics, no tracking SDKs.
```

## Age rating questionnaire (2025 tiers)

Answer everything "None" except:

| Question | Answer |
|---|---|
| Simulated Gambling | **Frequent/Intense** (poker-themed mini-games with play chips) |
| Unrestricted web access | No |
| Gambling with real currency | **No** |
| Contests | No |
| User-generated content / communication | Nicknames visible in private online games only → answer per current questionnaire; there is no chat, no public UGC |

Expected resulting rating: **18+** (driven by Simulated Gambling under the 2025 rating system). Do not fight this — a lower self-declared rating with poker content is a common rejection cause.

## App Privacy questionnaire ("nutrition label")

Data collection: **Yes**, then declare exactly two data types:

| Data type | Linked to user? | Used for tracking? | Purposes |
|---|---|---|---|
| Contact Info → Email Address | Yes | No | App Functionality |
| Identifiers → User ID | Yes | No | App Functionality |

Everything else: **not collected**. (Session/bankroll data never leaves the device; the nickname is user-generated but stored under User ID/account data.)

This matches the `ios.privacyManifests` now declared in `apps/mobile/app.json`.

## Screenshots

Required: one set for **6.9" iPhone** (1320×2868 portrait), minimum 3, max 10, per locale (fr-FR, en-US). Generate with:

```bash
cd apps/mobile
npx expo run:ios --configuration Release   # once, to build+install the release app
node scripts/capture-screenshots.mjs       # captures to store/screenshots/{en,fr}/
```

Suggested order (first 3 are what most users see — games lead): 1. Bluff game · 2. OFC game · 3. Hand replayer · 4. Tracker dashboard · 5. Home/festivals.

## Final submission checklist

1. Commit the pending working-tree changes (Bluff/OFC work), then:
2. `cd apps/api && fly deploy` → check https://upk-api.fly.dev/privacy and /support
3. `cd apps/mobile && npm install` (moves expo-dev-client to devDependencies in the lockfile)
4. `eas build -p ios --profile production`
5. `eas submit -p ios --latest` (fills/asks for ascAppId + appleId on first run)
6. In App Store Connect: paste the fr/en texts above, set URLs + copyright + categories, upload screenshots, answer the two questionnaires as above, paste the review notes, add build, submit for review.
7. In the review information section, enable **"Sign-in required"**. The username/password fields become mandatory but are free text — the app has no password login, so fill them with placeholders and let the review notes explain:
   - User name: `Sign in with Apple — any Apple ID works`
   - Password: `N/A (no password login exists)`
   Reviewers routinely test SIWA-only apps with their own Apple IDs. Fallback if a reviewer nevertheless rejects with a 2.1 "demo account" request: add a review-only email/password login (or a demo mode) to the API and resubmit — but don't build that preemptively.
