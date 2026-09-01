# Accueil — Feedback Mathieu (31 août 2026)

Source : WhatsApp, message du 31/08 20:49.

> « Est-ce-que tu peux mettre (Logo WSOP) WSOP-C Paris, 1 - 13 Septembre, avec ce lien
> https://www.texapoker.net/fr/tournois-poker-live/paris-partouche-pasino-club-wsop-c_3089.html sur
> le bouton Voir les tournois.
>
> Pour que je la montre aux gérants de Texapoker quand j'arrive à Paris »

---

## 1. WSOP-C Paris à la une, avec le lien Texapoker

Ce n'est pas une demande cosmétique : il veut montrer l'app à des gérants de salle. La carte à la une
est ce qu'ils verront en premier.

Rien à inventer côté données — les festivals sont statiques (`src/data/mock.ts`) et **le pattern
existe déjà** : `WSOP Circuit London` et `WSOP Circuit Brussels`, tous deux sur l'organisateur `or7`
(WSOP), dont le logo est déjà dans la table de `OrganizerLogo`.

- Une fiche `WSOP-C Paris` : Paris, `co1`, `or7`, 2026-09-01 → 2026-09-13, `featured: true`.
- Retirer `featured` de `WPT Spain` (`f10`) : la sélection est un `festivals.find(f => f.featured)`,
  le premier gagne.

**Le lien.** Rien dans l'app n'ouvre d'URL externe aujourd'hui, mais `expo-linking` est déjà une
dépendance — pas d'installation, pas de prebuild.

**Décision : un champ `url` optionnel sur `Festival`, et quand il est présent, toute la carte
l'ouvre** (corps et bouton, qui partagent de toute façon le même `onPress`). Sans `url`, comportement
inchangé : la carte pousse vers la fiche festival interne. Faire l'inverse — envoyer toutes les
cartes vers l'externe — orphelinerait cet écran de détail, qui est une vraie feature (buy-ins, Main
Event, structure de blindes).

À noter : du 1er au 13 septembre, ce festival est *en cours* aujourd'hui. `featured` l'emporte sur
`ongoing`, le badge dira donc « À la une » et non « En ce moment ».
