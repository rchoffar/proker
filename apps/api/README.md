# @upk/api — Vercel + Neon

API d'authentification Google/Apple, sauvegarde des mains et relais Socket.IO des jeux
Bluff/OFC actuels. Production : **https://proker-api.vercel.app**.
Le moteur des jeux en ligne actuels reste sur le téléphone de l'hôte ; le relais
transmet les messages sans interpréter les règles du jeu.

## Hébergement

- Projet Vercel `proker-api`, équipe `remy-choffardets-projects`, Root Directory `apps/api`.
- Node.js 24, fonctions en région `fra1`, Fluid Compute, durée maximale 300 secondes.
- PostgreSQL Neon gratuit à Frankfurt : `proker-db` pour Production,
  `proker-test-db` pour Development et Preview. Aucune ressource Redis.
- Les connexions Socket.IO sont exclusivement WebSocket, sur `/socket.io`.
  Vercel les prend actuellement en charge en bêta. Le client rejoint sa salle
  et redemande l'état au téléphone hôte après une reconnexion.
- Les salles et membres vivent dans PostgreSQL. L'adaptateur PostgreSQL Socket.IO
  utilise une connexion directe `LISTEN/NOTIFY` et partage les messages entre
  instances et déploiements. Les gros messages passent par `socket_io_attachments`.
- Six membres par salle, expiration après 30 minutes d'inactivité, grâce de
  reconnexion de l'hôte de 60 secondes. Les connexions des instances interrompues
  sont détectées par un bail de présence de 45 secondes, renouvelé toutes les
  10 secondes. Les échéances sont vérifiées pendant l'activité et à chaque accès ;
  la reprise ne dépend pas de la survie d'un timer local.

- Les écritures déclenchées par les sockets utilisent `waitUntil` pour terminer
  après une déconnexion. PostgreSQL limite également la durée des transactions
  et des attentes de verrou pour permettre la reprise si une fonction s’interrompt.

## API HTTP

| Route | Auth | Corps / réponse |
|---|---|---|
| `GET /health` | — | `{ ok, rooms }`, vérifie PostgreSQL |
| `POST /auth/google` | — | `{ idToken }` → `{ token, user }` |
| `POST /auth/apple` | — | `{ identityToken, email? }` → `{ token, user }` |
| `GET /me` | Bearer | `{ user }` |
| `PATCH /me` | Bearer | `{ pseudo }` → `{ user }` |
| `DELETE /me` | Bearer | `{ ok: true }`, supprime également les mains |
| `GET /hands` | Bearer | `{ hands }`, métadonnées des 200 dernières mains |
| `GET /hands/:id` | Bearer | `{ hand }` |
| `PUT /hands/:id` | Bearer | Main complète → `{ hand }`, métadonnées |
| `DELETE /hands/:id` | Bearer | `{ ok: true }`, idempotent |
| `GET /privacy`, `/support`, `/account-deletion` | — | Pages publiques FR/EN |

Une main appartenant à un autre compte répond 404. Les écritures et la limite de
rétention sont atomiques. Les utilisateurs conservent un identifiant stable pour
un même couple provider + identifiant provider ; un email Apple absent ne remplace
pas l'email déjà connu. Les JWT de session sont signés en HS256 et durent 180 jours.

## Configuration et développement

| Variable serveur | Usage |
|---|---|
| `DATABASE_URL` | Connexion Neon poolée pour les requêtes applicatives |
| `DATABASE_URL_UNPOOLED` | Connexion directe pour migrations et relais Socket.IO ; aucun `-pooler` |
| `AUTH_JWT_SECRET` | Secret JWT, distinct entre Production et les environnements de test |
| `GOOGLE_IOS_CLIENT_ID` | Audience Google iOS |
| `GOOGLE_WEB_CLIENT_ID` | Audience Google Android |
| `APPLE_BUNDLE_ID` | Audience Apple, défaut `fr.upk.app` |
| `PORT` | Dev local, défaut 3001 |

Ne jamais placer ces secrets dans une variable `EXPO_PUBLIC_*`. Les variables
mobiles `EXPO_PUBLIC_API_URL` et `EXPO_PUBLIC_BLUFF_SERVER_URL` pointent en production
sur `https://proker-api.vercel.app`. Une `EXPO_PUBLIC_API_URL` vide reprend l'URL du relais.

Depuis la racine du dépôt, lié au projet Vercel :

```sh
vercel env pull apps/api/.env.test.local --environment development
cd apps/api
npm ci
node --env-file=.env.test.local scripts/db-migrate.mjs
node --env-file=.env.test.local --import tsx src/index.ts
```

Pointer les URL mobiles sur `http://localhost:3001` pour un simulateur ou l'IP LAN
pour un téléphone. Les fichiers `.env*.local` et `.vercel/` sont ignorés par Git.

## Migrations et déploiement

`npm run build` compile sans modifier la base. `npm run build:vercel` compile puis
applique les migrations SQL versionnées avant publication, sur la connexion de
l'environnement cible. Un verrou PostgreSQL empêche les migrations concurrentes ;
les empreintes des migrations déjà appliquées sont vérifiées. Toute erreur bloque
le déploiement. Ajouter une migration plutôt que modifier une migration appliquée.

Depuis la racine :

```sh
vercel link --project proker-api --scope remy-choffardets-projects
vercel deploy --target preview --local-config apps/api/vercel.json
vercel deploy --prod --local-config apps/api/vercel.json
```

La connexion GitHub automatique n'est pas encore activée pour ce projet : le
premier lien a été refusé par Vercel. Les déploiements actuels sont faits par CLI.
`vercel.json` limite les déploiements Git à `main` lorsqu'une liaison sera activée.
Ne pas envoyer les travaux OFC HTTP en cours avant leur validation : la migration
initiale a été déployée depuis une copie isolée qui les exclut.

Un rollback applicatif ne restaure pas le schéma. Garder les migrations compatibles
avec les versions coexistantes pendant un déploiement.

## Vérification

```sh
cd apps/api
npm test
PROKER_INTEGRATION_TEST=1 node --env-file=.env.test.local --import tsx --test test/*.test.ts
```

Les tests d'intégration créent puis suppriment un schéma temporaire dans la base
de test. Ils vérifient isolation des comptes, rétention, salles concurrentes,
messages entre deux instances, messages de plus de 8 Ko, reprise de session,
suppression de compte et reprise après terminaison des connexions PostgreSQL.
Les tests d'intégration ne s'exécutent que si `PROKER_INTEGRATION_TEST` est défini.

Le protocole Socket.IO est défini dans `src/protocol.ts` et recopié dans
`apps/mobile/src/lib/bluff/protocol.ts`.

## Bascule du 30 septembre 2026

Base de production repartie à zéro, sans import SQLite. L'application Fly.io
`upk-api`, ses machines et son volume ont été supprimés après validation de Vercel.
L'ancien `proker-bluff-relay` n'existait plus dans le compte Fly.io.
Les anciennes versions mobiles qui ciblent Fly.io doivent être mises à jour.
Les URL des fiches App Store / Play Store sont mises à jour dans `docs/store/` ;
leur publication dans les consoles des stores est une opération séparée.
