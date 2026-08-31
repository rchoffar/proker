# Feedback Mathieu — 30 août 2026 (après l'update de 16:43)

Retours WhatsApp de Mathieu sur la build pushée le 30/08 à 16:43 (TestFlight iOS +
`upk-preview-local.apk`), triés par domaine, avec les screenshots associés.

Source : export WhatsApp `_chat.txt`, messages du **30/08 18:07 → 30/08 21:02** — rien après. Le
batch précédent ([2026-08-29-mathieu/](../2026-08-29-mathieu/README.md)) s'arrête au 29/08 00:05 et
est déjà mergé.

C'est le premier batch où il a joué **en ligne à deux**, sur Android, contre une amie — et c'est là
que sont tous les bugs bloquants. Il annonce lui-même « plus d'update majeure, c'est vraiment des
petits détails graphiques ».

| Dossier | Items | Médias | Points chauds |
|---|---|---|---|
| [android/](android/FEEDBACK.md) | 1 | 1 vidéo | **le feutre passe devant les cartes sur Android** — `elevation`, pas l'encodeur vidéo |
| [ofc/](ofc/FEEDBACK.md) | 5 | 7 | un host éliminé gèle la table ; écran noir pendant l'attente ; secret de la fantaisie à sens unique |
| [bluff/](bluff/FEEDBACK.md) | 5 | 2 | Jeu Max à 1 carte qui finit la partie ; règle de variante fausse ; annonces qui collent au titre |
| [replayer/](replayer/FEEDBACK.md) | 8 | 2 | heads-up implicite ; split annoncé comme une victoire ; anim badbeat à retirer |
| [online/](online/FEEDBACK.md) | 6 | 1 | la ❌ ferme la room sans confirmation ; pas de reconnexion ; partage du code |
| [flip/](flip/FEEDBACK.md) | 1 | 1 | « X perd la main » faux à plus de 2 joueurs |
| [home/](home/FEEDBACK.md) | 3 | 1 | « fauler » ; Roulette → Tirage |

## Les 5 bugs bloquants

1. **OFC — un host éliminé gèle la table** ([ofc/](ofc/FEEDBACK.md#1)) : `validateAction` refuse
   toute action d'un éliminé, `nextHand` et `deal` compris, et seul l'host les émet.
2. **Bluff — un Jeu Max réussi à 1 carte termine la partie** ([bluff/](bluff/FEEDBACK.md#2)) : en
   variante rapide on démarre à 1 carte.
3. **Bluff — la description de variante est toujours celle de « Rapide »** ([bluff/](bluff/FEEDBACK.md#1)).
4. **Replayer — un pot partagé déclenche « X remporte la main »** ([replayer/](replayer/FEEDBACK.md#8)).
5. **Online — la ❌ ferme la room sans confirmation** ([online/](online/FEEDBACK.md#1)) : le garde
   n'est armé que pendant la main, donc dans le lobby elle tue la room instantanément.

## Le bug qu'il n'a pas vu venir

Sa remarque « Export main bug sur Android » n'est pas un bug d'export. En regardant la vidéo, le
feutre est **devant** les cartes et les joueurs : sur Android `elevation` dicte l'ordre de dessin
entre frères, iOS l'ignore. La lecture à l'écran est donc déjà fausse sur Android sur flip, bluff, le
replayer et la roulette. Voir [android/](android/FEEDBACK.md).

## Trouvés en explorant, pas signalés

- Un joueur qui **rejoint après le lancement** n'est pas dans `view.players` → écran noir total.
- Un **invité en fin de partie** ne sait pas que l'host peut relancer.
- Aucun listener `disconnect` : hors ligne, l'écran affiche une partie vivante.
- `stats.json` parle encore de « l'onglet Jeux », supprimé par `3d38e64`.

Tous dans [online/](online/FEEDBACK.md) sauf le dernier ([home/](home/FEEDBACK.md)).

## Clos — pas des bugs, rien à répondre

Mathieu arrive chez Rémy le lundi 7, ces trois-là se règlent de vive voix s'il les ressort :

1. **La barre d'onglets** (18:50 → 18:57). Il l'a regrettée puis a concédé : « Ok pas de soucis,
   j'avais sûrement juste pris l'habitude », « comme tu le sens ». La position de Rémy tient — profil
   et stats ne justifiaient pas un onglet, et l'accueil ouvre direct sur les jeux avec « Nouvelle
   main » à portée. Rien à faire.
2. **Quinte flush en bas → fantaisie** (18:56). Il a confirmé de lui-même : « t'as bien raison pour
   OFC quinte flush en bas ne qualifie pas en fantasy ». Elle prolonge la fantaisie, elle n'y fait
   pas entrer. Sujet clos, déjà ouvert dans le batch du 29/08.
3. **Les placements « bloqués » en ligne** (19:01 → 19:09). C'était son wifi, il l'a établi lui-même :
   « même si elle valide son jeu quand je suis sur WhatsApp ça marche quand je reviens », « on a juste
   un wifi de merde ». Pas un bug — mais l'attente muette lui a fait croire deux fois à un blocage,
   d'où l'état d'envoi dans [online/](online/FEEDBACK.md#6).

## Une question de règle ouverte

Sur le Jeu Max à 0 carte, **il se contredit** : « à 0 carte tu gagnes » est la règle qu'il a donnée et
elle est écrite dans le hint du setup qu'il a validé (`bluff.json` `setup.jeuMaxHint`). Son message du
19:44 dit l'inverse. **Décision prise : on suit son nouveau message** — 0 carte ne gagne plus. À lui
confirmer, avec la question restante : un joueur à 0 carte peut-il encore annoncer et crier menteur ?
