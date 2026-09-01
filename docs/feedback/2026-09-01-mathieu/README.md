# Feedback Mathieu — 31 août 2026 (build des 28 correctifs)

Retours WhatsApp de Mathieu sur la build poussée le 31/08 à 20:07, celle qui contenait les 28
correctifs du [batch précédent](../2026-08-31-mathieu/README.md).

Source : export WhatsApp `_chat.txt`, messages du **31/08 20:07 → 21:05**. Un **appel vocal de 22
minutes** (20:14 → 20:36) sépare l'annonce de la build de ses premiers retours écrits : une partie du
contexte s'est dite de vive voix et n'est pas dans l'export.

Batch court, aucun bloquant, et il n'a pas pu tester le multijoueur.

| Dossier | Items | Points chauds |
|---|---|---|
| [ofc/](ofc/FEEDBACK.md) | 1 | **régression** — le feutre posé la veille mange l'écran |
| [replayer/](replayer/FEEDBACK.md) | 4 | **régression** — « BTN/SB » alors que heads-up est décoché ; mises sur le feutre ; deux réordonnancements |
| [nav/](nav/FEEDBACK.md) | 1 | deux clics pour rentrer à l'accueil — ❌ remonte, HOME rentre |
| [home/](home/FEEDBACK.md) | 1 | WSOP-C Paris à la une, avec le lien Texapoker |

## Deux des sept points sont des régressions de la veille

C'est le premier batch où Mathieu teste des correctifs et retrouve deux choses que ce travail a
lui-même cassées :

1. **Le feutre OFC** ([ofc/](ofc/FEEDBACK.md)) — posé la veille pour supprimer l'écran noir hors tour,
   il occupe ~40 % de l'écran pour une grille vide et repousse le panneau d'action hors champ.
2. **« BTN/SB » avec heads-up décoché** ([replayer/](replayer/FEEDBACK.md#2)) — le builder persiste
   `undefined` au lieu de `false`, et la lecture retombe alors sur le fallback conçu pour les mains
   d'avant la feature. La même main affiche « BTN/SB » *et* de l'argent mort dans le pot.

Rien de tout ça n'aurait été trouvé sans qu'il rejoue exactement les mêmes scénarios que la veille.

## Clos — pas un bug

**La vidéo « trop lente »** (20:37). Rémy a répondu que la vitesse était la bonne, et Mathieu a
confirmé lui-même : « Ah ouais t'as raison, j'pense c'est juste la première fois que j'ai regardé la
vidéo ». Rien à faire.

## Pour la suite, pas pour ce batch

Son message de 20:58 est une liste de backlog produit, pas des retours sur la build. Elle est reprise
et classée dans [docs/ROADMAP.md](../../ROADMAP.md) plutôt qu'enterrée ici.
