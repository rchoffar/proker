# Android — Feedback Mathieu (30 août 2026)

Source : WhatsApp, message du 30/08 20:08 (vidéo).

> « Export main bug sur Android »

[vidéo](00001159-VIDEO-2026-08-30-20-08-50.mp4)

---

## 1. Ce n'est pas l'export — c'est l'ordre de dessin Android

Sur la vidéo, le feutre passe **devant** les cartes et les joueurs. L'encodeur n'est pas en cause :
la lecture à l'écran est déjà fausse sur Android, la capture ne fait que l'enregistrer.

Sur Android, `elevation` dicte l'ordre de dessin entre frères **indépendamment de l'ordre de
l'arbre** ; iOS l'ignore totalement et suit l'arbre. Or le feutre porte `elevation: 12` — le seul
moyen d'avoir une ombre portée sur Android — pendant que tout ce qui doit passer devant est plus bas :

| Couche | Fichier | `elevation` |
|---|---|---|
| Feutre | `src/components/hand/PokerTable.tsx:64` | **12** |
| Feutre roulette | `src/components/degen/RouletteCardTable.tsx:311` | **12** |
| Plaque de nom (setup) | `src/components/games/SeatNameBubble.tsx:96` | 10 |
| Halo de siège | `src/components/hand/TableSeat.tsx:147` | 8 |
| Main du joueur (bluff) | `app/games/bluff/play.tsx:351`, `online.tsx:447` | `i + 1` |
| Pods, cartes, board | — | 0 |

Donc le bug touche **flip, bluff, le replayer et la roulette**, plus la plaque de nom des boards de
setup — pas seulement la vidéo.

**Décision** : une vue sœur placée **sous** le feutre porte l'`elevation` et l'ombre, le feutre
lui-même passe à `elevation: 0`. L'ordre de l'arbre reprend la main et l'ombre survit sur les deux
plateformes. Idem pour `RouletteCardTable`.

À vérifier sur la build Android **avant** de retoucher quoi que ce soit à l'export : les quatre
écrans à feutre, plus un board de setup. Si l'export casse encore après ça, `adb logcat` sur le
`console.warn('[replayer] video export failed', …)` déjà en place (`src/hooks/useVideoExport.ts:200`).

## Note — l'export Android n'a jamais été testé par ailleurs

Les suspects relevés dans le module natif restent valables si un vrai bug d'encodage apparaît après
le correctif d'ordre de dessin (`modules/frame-video-encoder/android/.../FrameVideoEncoderModule.kt`) :
`BitmapFactory.decodeFile` sans `inSampleSize` (un bitmap ARGB_8888 1080×1920 par frame, plus
`lastBitmap` retenu) ; `thread.quitSafely()` dans le `finally` de `finish`, qui rend la session non
réutilisable après un `cancel()` ; les `check(...)` d'EGL de `GlFrameWriter.kt`, qui lèvent selon la
config du device. `react-native-view-shot` est aussi figé en 5.1.0, dont le `captureRef` Android
diverge beaucoup d'iOS.
