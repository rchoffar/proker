# Feedback Mathieu — 28–29 août 2026

Retours WhatsApp de Mathieu sur la build pushée le 28/08 à 17h46, triés par produit, avec les
screenshots associés. Chaque dossier est prévu pour lancer une session Claude dédiée.

Source : export WhatsApp `_chat.txt`, messages du 28/08 00:06 → 29/08 00:05. Le batch précédent
([2026-08-27-mathieu/](../2026-08-27-mathieu/README.md)) s'arrête au 27/08 06:03 et est déjà mergé.

| Dossier | Items | Screenshots | Points chauds |
|---|---|---|---|
| [shared-table/](shared-table/FEEDBACK.md) | 4 | 3 | table trop étroite partout, collision des cartes à 5 joueurs |
| [setup/](setup/FEEDBACK.md) | 6 | 4 | options au milieu de la table, bouton (!), lobbies en ligne |
| [replayer/](replayer/FEEDBACK.md) | 8 | 4 + 1 vidéo | ordre des actions dans la vidéo, crash à l'export, flow de partage |
| [home/](home/FEEDBACK.md) | 6 | 5 | réordonner, bloc Replayer trop haut, densité des tuiles |
| [roulette/](roulette/FEEDBACK.md) | 2 | 1 | texture des cartes (le tirage aléatoire est conservé) |
| [ofc/](ofc/FEEDBACK.md) | 1 | 0 | règle d'entrée en fantaisie — **réponse à envoyer, pas un bug** |

## Ce qui est demandé une fois mais concerne tout le monde

Mathieu décrit ses retours écran par écran. Deux d'entre eux sont en réalité **un seul changement
partagé** :

- « la table est trop petite » est répété pour Flip, OFC, Bluff et la Roulette → un seul module de
  dimensions, voir [shared-table/](shared-table/FEEDBACK.md).
- « les options au milieu de la table » est répété pour OFC solo, OFC en ligne, Bluff solo et Bluff
  en ligne → un seul slot `center` sur `SeatTableBoard`, voir [setup/](setup/FEEDBACK.md).

## Ce qui n'est pas un bug (réponses à lui envoyer)

Deux retours sont signalés comme des bugs alors que le code est correct. Ils sont fermés en tant que
**réponses**, pas en tant que correctifs — sans réponse il les re-signalera :

1. **« MathieuChfd (BTN) 0.5BB »** — en heads-up c'est le bouton qui paie la petite blinde, et les
   montants de relance sont déjà des totaux, pas des incréments. Seul l'affichage est à corriger.
   Détail dans [replayer/](replayer/FEEDBACK.md#7--mathieuchfd-btn-05bb--pas-un-bug).
2. **« Quinte flush en bas → fantaisie »** — la quinte flush en bas permet de *rester* en fantaisie,
   pas d'y *entrer*. C'est la règle standard. Détail dans [ofc/](ofc/FEEDBACK.md).

## Notes sur l'export

- `00001014` et `00001018` sont des cadrages en double de screenshots de Rémy — non repris.
- `00001013` et `00001017` sont des screenshots de Rémy (thème clair, Omaha à 2 joueurs) : ils
  servent de preuve que le feutre est déjà trop étroit à 2 joueurs, gardés dans `shared-table/`.
- `00001024` est une vidéo (l'export story qu'il commente) — gardée dans `replayer/`.
