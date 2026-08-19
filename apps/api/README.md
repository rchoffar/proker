# @upk/api — relais Bluff + auth

Serveur minimal : relais socket.io pour le mode en ligne du mini-jeu **Bluff**,
plus une petite API HTTP d'authentification (Google / Apple) avec une base SQLite.
Le relais ne connaît AUCUNE règle du jeu : le téléphone de l'hôte fait tourner le moteur
(`apps/mobile/src/lib/bluff/engine.ts`) ; le serveur gère seulement les salles
(code à 4 chiffres) et fait suivre des messages opaques entre les membres.

## API auth

| Route | Auth | Corps | Réponse |
|---|---|---|---|
| `POST /auth/google` | — | `{ idToken }` | `{ token, user }` |
| `POST /auth/apple` | — | `{ identityToken, email? }` | `{ token, user }` |
| `GET /me` | Bearer | — | `{ user }` |
| `PATCH /me` | Bearer | `{ pseudo }` (2–20 car.) | `{ user }` |
| `DELETE /me` | Bearer | — | `{ ok: true }` (suppression définitive du compte) |

Le serveur vérifie le jeton d'identité du provider (signature JWKS via `jose`,
audience = client ID iOS Google / bundle ID Apple), upsert l'utilisateur dans
SQLite (`users`, clé unique `provider + provider_user_id`) et signe un JWT de
session HS256 (~180 j). `user` = `{ id, provider, email, pseudo }`.
Apple n'envoie l'email qu'à la PREMIÈRE autorisation : l'upsert conserve
l'email existant (`COALESCE`), et le client envoie `credential.email` en secours.

### Variables d'environnement

| Var | Rôle |
|---|---|
| `AUTH_JWT_SECRET` | secret HS256 des JWT de session (requis) |
| `GOOGLE_IOS_CLIENT_ID` | audience des idToken Google (requis) |
| `APPLE_BUNDLE_ID` | audience des jetons Apple (défaut `fr.upk.app`) |
| `DATABASE_PATH` | fichier SQLite (défaut `./dev.db`, prod `/data/upk.db`) |

## Dev local

```bash
npm install
AUTH_JWT_SECRET=dev-secret GOOGLE_IOS_CLIENT_ID=<client-id> npm run dev   # tsx watch, port 3001
curl localhost:3001/health
```

Côté app, pointer le client sur la machine locale :

```bash
EXPO_PUBLIC_BLUFF_SERVER_URL=http://localhost:3001 npx expo start
```

(Sur un appareil physique, remplacer `localhost` par l'IP LAN de la machine.)

## Déploiement — Fly.io (prod actuelle)

Déployé sur **https://upk-api.fly.dev** (app `upk-api`, région `cdg`),
en scale-to-zero : la machine s'arrête quand plus personne n'est connecté (les websockets
ouvertes la maintiennent en vie) et se réveille en <1s. Coût ≈ centimes/mois.

Mise en place initiale (une seule fois) — app + volume SQLite + secrets :

```bash
cd apps/api
flyctl apps create upk-api
flyctl volumes create upk_data --region cdg --size 1 -a upk-api
flyctl secrets set -a upk-api \
  AUTH_JWT_SECRET=$(openssl rand -hex 32) \
  GOOGLE_IOS_CLIENT_ID=<id>.apps.googleusercontent.com
```

(L'ancienne app `proker-bluff-relay` peut être détruite : `flyctl apps destroy proker-bluff-relay`.)

(Changer `AUTH_JWT_SECRET` déconnecte tous les utilisateurs.)

Déploiement :

```bash
cd apps/api
flyctl deploy --ha=false --remote-only   # --ha=false OBLIGATOIRE : une seule machine
```

Un seul process Node, salles en mémoire (jetables, TTL 30 min) ; les utilisateurs
sont persistés dans `/data/upk.db` sur le volume `upk_data`.
Ne JAMAIS scaler au-delà d'une machine sans ajouter un adapter socket.io (redis) —
les salles vivent en mémoire, deux machines = salles invisibles entre elles.

Côté app : `EXPO_PUBLIC_BLUFF_SERVER_URL=https://upk-api.fly.dev`
(déjà dans `apps/mobile/.env`, gitignoré — voir `.env.example`).

## Protocole

Voir `src/protocol.ts` — copie maintenue à la main dans
`apps/mobile/src/lib/bluff/protocol.ts` (pas de workspace npm dans ce repo).
