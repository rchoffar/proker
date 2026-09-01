# Roadmap produit — UPK

Ce qui est demandé mais pas encore construit, avec ce que chaque ligne suppose déjà en place. Ce
n'est pas un backlog de bugs : les retours qui deviennent des correctifs vivent dans
[docs/feedback/](feedback/) et se ferment avec leur batch.

Origine des lignes ci-dessous : Mathieu, message du 31/08/2026 20:58
([batch 2026-09-01](feedback/2026-09-01-mathieu/README.md)).

## Contenu

| Ligne | Notes |
|---|---|
| **Jeu Poker** | Les deux tuiles « Bientôt disponible » de l'accueil. Le plus gros morceau du lot : c'est le seul jeu qui a besoin d'un moteur de mise complet — or il existe déjà, `src/lib/handEngine.ts`, écrit pour le replayer. |
| **Jeu Blackjack** | Beaucoup plus petit : pas de mise entre joueurs, un croupier déterministe. Bon candidat pour valider la chaîne « nouveau jeu » de bout en bout. |

## Rétention

| Ligne | Notes |
|---|---|
| **Stats plus détaillées, OFC et Bluff en premier** | `src/lib/gameStats.ts` stocke déjà par pseudo et par jeu ; l'écran `app/stats.tsx` liste les jeux dans l'ordre historique. Réordonner est trivial, enrichir l'OFC (fouls, fantaisies, royalties) demande d'enregistrer plus au moment du scoring. |
| **Succès à débloquer** | « très addictif », selon lui. S'appuierait sur les mêmes compteurs `gameStats`. À cadrer : locaux au device, ou attachés au compte ? |

## Multijoueur

| Ligne | Notes |
|---|---|
| **Serveur de parties publiques** | Suppose de **sortir l'autorité du téléphone de l'host** : aujourd'hui le moteur tourne sur le device qui a créé la table et le relais ne fait que transporter (`apps/api`). C'est le chantier déjà identifié comme « la bonne architecture à terme » lors du batch précédent. Tout le reste de cette section en dépend. |
| **Notification push quand c'est ton tour** | Demandée le 30/08, laissée dehors alors parce qu'elle dépendait de la reconnexion — laquelle est livrée depuis. Redevenue faisable. |
| **Reprendre une partie locale OFC/Bluff en cours** | Le pendant local de la reconnexion en ligne : la session et l'état de l'host sont déjà persistés en MMKV pour l'online (`src/lib/online/session.ts`), le même mécanisme s'appliquerait au Pass & Play. Il le juge lui-même « pas très important, use case très rare ». |

## Monétisation

Aucune de ces lignes n'est cadrée, et elles s'enchaînent : rien n'a de sens avant les parties
publiques.

| Ligne | Notes |
|---|---|
| **Jetons pour les parties publiques** | Achat possible. Dépend du serveur de parties publiques. |
| **Abonnement, et pub pour les non-abonnés** | Décision produit avant décision technique. Touche aussi la fiche des stores. |
| **Pub pendant la génération de la vidéo du replayer** | L'export dure déjà un moment et affiche une barre de progression (`useVideoExport`) — c'est l'emplacement naturel s'il y a de la pub un jour. |
