# @upk/api — Vercel + Neon

API d'authentification Google/Apple, sauvegarde des mains, OFC et Bluff en tour par tour HTTP. Production : **https://proker-api.vercel.app**.
Les moteurs des deux jeux s'exécutent sur le serveur et leurs états sont sauvegardés dans Neon.

## Hébergement

- Projet Vercel `proker-api`, Root Directory `apps/api`, Node.js 24, région `fra1`.
- Le point d'entrée `api/server.ts` expose uniquement HTTP, sans Socket.IO, WebSocket ni adaptateur PostgreSQL de relais.
- Les lectures sont rafraîchies toutes les 3 secondes sur une table et toutes les 10 secondes dans le lobby, uniquement pendant l'utilisation de l'app. Les listes acceptent aussi le geste tirer pour actualiser.
- Les rooms ne dépendent pas de la présence du créateur et n'expirent pas à la fermeture de l'app.
- Les anciennes tables `rooms` et `socket_io_attachments` sont conservées mais ne sont plus utilisées ; les migrations déjà appliquées restent inchangées.

## API HTTP

| Route | Auth | Corps / réponse |
|---|---|---|
| `GET /health` | — | `{ ok }`, vérifie PostgreSQL |
| `POST /auth/google` | — | `{ idToken }` → `{ token, user }` |
| `POST /auth/apple` | — | `{ identityToken, email? }` → `{ token, user }` |
| `GET /me` | Bearer | `{ user }` |
| `PATCH /me` | Bearer | `{ pseudo }` → `{ user }` |
| `DELETE /me` | Bearer | `{ ok: true }`, supprime également les mains, applique les forfaits OFC et Bluff et anonymise les participations |
| `GET /hands` | Bearer | `{ hands }`, métadonnées des 200 dernières mains |
| `GET /hands/:id` | Bearer | `{ hand }` |
| `PUT /hands/:id` | Bearer | Main complète → `{ hand }`, métadonnées |
| `DELETE /hands/:id` | Bearer | `{ ok: true }`, idempotent |
| `GET /privacy`, `/support`, `/account-deletion` | — | Pages publiques FR/EN |

Une main appartenant à un autre compte répond 404. Les écritures et la limite de
rétention sont atomiques. Les utilisateurs conservent un identifiant stable pour
un même couple provider + identifiant provider ; un email Apple absent ne remplace
pas l'email déjà connu. Les JWT de session sont signés en HS256 et durent 180 jours.

## Bluff asynchrone

Routes authentifiées : `GET /bluff/games`, `GET /bluff/rooms`, `POST /bluff/games`, `POST /bluff/join`, `GET /bluff/games/:id`, `POST /bluff/games/:id/moves`, `POST /bluff/games/:id/leave`.
Création : `{ config: { variant: "standard" | "quick", jeuMax: boolean }, capacity: 2..6, visibility: "public" | "private", requestId }`.
La dernière place démarre automatiquement le jeu. Les coups comportent `expectedVersion`, `requestId` et `action` ; le serveur impose l'identité authentifiée, valide le tour et masque les mains adverses. Les révélations restent affichées 7 secondes ; la lecture suivante fait avancer la manche sous verrou, sans dépendre d'un téléphone hôte ni d'un timer de fonction Vercel.
Quitter l'écran conserve la participation. Abandonner explicitement élimine le joueur et annule la manche courante pour permettre aux autres de continuer.

## OFC asynchrone

Toutes les routes OFC exigent un Bearer token et répondent avec `Cache-Control: no-store`.

| Route | Corps / réponse |
|---|---|
| `GET /ofc/games` | `{ games }`, toutes les parties du compte, dont les terminées |
| `GET /ofc/rooms` | `{ rooms }`, rooms publiques en attente auxquelles le compte ne participe pas |
| `POST /ofc/games` | `{ variant, startingStack, capacity, visibility, requestId }` → `{ game }` |
| `POST /ofc/join` | `{ code, requestId }` → `{ game }` |
| `GET /ofc/games/:id` | `{ game }`, état masqué pour le participant authentifié |
| `POST /ofc/games/:id/moves` | `{ expectedVersion, requestId, action: { type, placements } }` → `{ game }` |
| `POST /ofc/games/:id/leave` | `{ requestId }` → `{ ok: true }` |
| `GET /ofc/games/:id/history?afterHand=0` | `{ hands }`, au plus 50 entrées, reprendre après le dernier numéro reçu |

`capacity` vaut 2 ou 3, `visibility` vaut `public` ou `private`, `variant` vaut
`classic` ou `pineapple`. Les nouvelles rooms utilisent un code à **6 chiffres**,
indépendant des codes du relais historique. Le moteur partagé est dans `packages/ofc`.
Le serveur distribue automatiquement à la dernière inscription et après chaque main.
Les mains terminées restent consultables ; une main annulée est archivée sans score.

Chaque mutation a un UUID `requestId` : réessayer une requête incertaine avec le même
identifiant et le même corps. Un identifiant réutilisé avec un autre corps répond 409
(`request_reused`), comme une version périmée (`stale_version`). Les erreurs de règles
répondent 422 avec `{ error, params? }`. Les mains et le paquet ne sont jamais acceptés
depuis le client ; seuls les placements sont autorisés. L'identité vient du compte.
Les inscriptions et coups sont sérialisés par verrou de ligne PostgreSQL et les
requêtes répétées par verrou transactionnel du compte. Un coup confirmé est déjà
persisté, ainsi que son résultat et sa distribution suivante éventuels.

Quitter l'écran conserve sa place. Quitter explicitement une room en attente libère
sa place (y compris celle du créateur). Un forfait après démarrage retire ses jetons,
annule la main inachevée et redistribue aux survivants, ou déclare l'unique survivant
vainqueur. Supprimer le compte applique cette règle et anonymise les sièges conservés.
Pas de limite de temps ni d'expiration automatique des parties OFC HTTP.

Le mobile actualise la table toutes les 3 secondes et les listes visibles toutes les
10 secondes, uniquement au premier plan, avec une actualisation immédiate au retour.
Les placements en préparation sont conservés localement par partie et tour ; seuls
les placements confirmés vivent sur le serveur. Les statistiques utilisent un registre
persistant pour ne pas compter plusieurs fois une même main après réouverture.

## Configuration et développement

| Variable serveur | Usage |
|---|---|
| `DATABASE_URL` | Connexion Neon poolée pour les requêtes applicatives |
| `DATABASE_URL_UNPOOLED` | Connexion directe pour migrations ; aucun `-pooler` |
| `AUTH_JWT_SECRET` | Secret JWT, distinct entre Production et les environnements de test |
| `GOOGLE_IOS_CLIENT_ID` | Audience Google iOS |
| `GOOGLE_WEB_CLIENT_ID` | Audience Google Android |
| `APPLE_BUNDLE_ID` | Audience Apple, défaut `fr.upk.app` |
| `PORT` | Dev local, défaut 3001 |

Ne jamais placer ces secrets dans une variable `EXPO_PUBLIC_*`. Les variables
mobiles `EXPO_PUBLIC_API_URL` et `EXPO_PUBLIC_BLUFF_SERVER_URL` pointent en production
sur `https://proker-api.vercel.app`. `EXPO_PUBLIC_BLUFF_SERVER_URL` reste accepté comme ancien alias d'`EXPO_PUBLIC_API_URL`.

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

Le projet est relié à `rchoffar/proker` sur GitHub : chaque push sur `main` déclenche un déploiement de production. `vercel.json` désactive les déploiements Git des autres branches. Les déploiements CLI restent disponibles pour les vérifications manuelles.
Pour publier les jeux HTTP, déployer d'abord l'API avec les migrations additives `002_ofc.sql` et `003_bluff.sql`, puis le client mobile. Le build Vercel applique les migrations avant publication et échoue si elles ne passent pas. Les anciennes parties du relais ne sont pas converties et les anciennes versions mobiles utilisant les sockets doivent être mises à jour.

Le build inclut les sources partagées `packages/ofc` et `packages/bluff` hors de `apps/api`. Pour un déploiement depuis ce Root Directory, inclure les fichiers extérieurs dans les réglages du projet Vercel ; les déploiements CLI se font depuis la racine du dépôt. `npm start` utilise `dist/apps/api/src/index.js` et conserve les modules partagés sous `dist/packages/`.

Un rollback applicatif ne restaure pas le schéma. Garder les migrations compatibles
avec les versions coexistantes pendant un déploiement.

## Vérification

```sh
cd apps/api
npm test
PROKER_INTEGRATION_TEST=1 node --env-file=.env.test.local --import tsx --test test/*.test.ts
```

Les tests d'intégration créent puis suppriment un schéma temporaire dans la base
de test. Ils vérifient isolation des comptes, rétention, inscriptions et coups concurrents,
confidentialité des cartes, reprises, suppression de compte et parties persistantes sans créateur connecté.
Les tests d'intégration ne s'exécutent que si `PROKER_INTEGRATION_TEST` est défini.

Les contrats HTTP et les moteurs sont partagés dans `packages/ofc` et `packages/bluff`.

## Bascule du 30 septembre 2026

Base de production repartie à zéro, sans import SQLite. L'application Fly.io
`upk-api`, ses machines et son volume ont été supprimés après validation de Vercel.
L'ancien `proker-bluff-relay` n'existait plus dans le compte Fly.io.
Les anciennes versions mobiles qui ciblent Fly.io doivent être mises à jour.
Les URL des fiches App Store / Play Store sont mises à jour dans `docs/store/` ;
leur publication dans les consoles des stores est une opération séparée.
