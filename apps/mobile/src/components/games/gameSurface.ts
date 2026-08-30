// The game surfaces are dark by design in BOTH color schemes — the felt sets the mood and
// a light play screen around a green table reads as a bug, not a theme. So the play and
// online screens pair the theme-invariant onDark* text tokens with these fixed surfaces
// instead of `colors.*`, exactly like the table keeps one look in both schemes (see the
// TABLE palette in components/hand/PokerTable.tsx).
//
// These four values were redeclared in five route files, which is how the same rgba string
// ends up meaning "tile" in one screen and something else in the next. Kept react-free and
// camelCase like tableSize.ts / seatLayout.ts, its neighbours in the shared table layer.

/** Full-screen game background; matches the dark EnvironmentBackground mid-tone. */
export const SCREEN_BG = '#101114';

/** The circular header buttons and other small tiles sitting on SCREEN_BG. */
export const DARK_TILE = 'rgba(255, 255, 255, 0.08)';

/** Panels and cards that need to lift off SCREEN_BG without a border. */
export const DARK_CARD_BG = 'rgba(255, 255, 255, 0.05)';

/** `colors.loss` is tuned for the themed surfaces; this is its on-felt counterpart. */
export const LOSS_ON_DARK = '#FF6B70';
