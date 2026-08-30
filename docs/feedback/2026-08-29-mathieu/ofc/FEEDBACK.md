# OFC — Feedback Mathieu (28 août 2026)

Source : WhatsApp, message du 28/08 00:06 et la discussion du 28/08 11:36.

---

## 1. « Quinte flush en bas → fantaisie » — pas un bug, réponse à envoyer

> Mathieu : « Problème OFC : quand tu fais quinte flush en bas, ça doit te faire passer en fantaisie,
> ce n'est pas le cas actuellement »
> Rémy : « Quand je regarde sur internet sur les règles c'est que QQ KK AA qui fait passer en
> fantaisy. T'as pas mis sur ton doc la fantaisy »

**Le moteur implémente la règle standard**, `src/lib/ofc/evaluator.ts:124-134` :

```ts
qualifiesFantasy(rows)  // ENTRER : brelan en haut, ou une paire >= QQ en haut
staysFantasy(rows)      // RESTER : brelan en haut, ou quinte flush+ en bas
```

et `scoring.ts:76` choisit entre les deux selon `player.inFantasyLand`.

Autrement dit : une quinte flush en bas permet de **rester** en fantaisie, pas d'y **entrer**. C'est
la convention standard, et c'est ce que Rémy a retrouvé. Le doc de règles de Mathieu ne couvre pas du
tout la fantaisie.

**Décision : aucun changement de code.** À lui répondre, en lui demandant de confirmer contre son doc.
S'il maintient sa version, c'est une ligne dans `qualifiesFantasy` plus un cas dans
`src/lib/ofc/__tests__/evaluator.test.ts`.

---

## 2. Table plus large / options dans la table

Demandé pour l'OFC solo et l'OFC en ligne — traité dans [setup/](../setup/FEEDBACK.md).

À noter : l'écran de **jeu** OFC n'a pas de table du tout (`OfcSeatsStrip` + `OfcActorPanel` +
`PlacementBoard`). « Table plus large » ne concerne donc que l'écran de préparation.
