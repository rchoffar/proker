import { createContext, useContext } from 'react';

// How much room a setup screen actually has for its content, measured on the scroll view
// itself rather than on the content inside it.
//
// A board that fills cannot ask its own parent how tall it may be: inside a ScrollView a
// `flex: 1` child resolves against the CONTENT height, which the board is itself setting. So
// an oversized first guess stays oversized — the content grows to fit it, the board measures
// that and keeps its size, and the screen scrolls. Bluff showed it first because its mode
// switch leaves the least room.
export const SetupViewportContext = createContext<number | null>(null);

export const useSetupViewport = () => useContext(SetupViewportContext);

/**
 * The height a filling board should size itself to.
 *
 * Its own measurement is the honest number when the content fits, and it accounts for
 * siblings (the join-code card on the online tabs). But it is content-derived, so it can only
 * ever agree with an oversized guess — capping it with the measured viewport is what makes it
 * settle downward instead.
 */
export function fillHeight(selfMeasured: number | null, viewport: number | null): number | null {
  if (selfMeasured === null) return viewport;
  if (viewport === null) return selfMeasured;
  return Math.min(selfMeasured, viewport);
}

/** `available` less the chrome around the felt, keeping the null "not measured yet". */
export function subtract(available: number | null, chrome: number): number | null {
  return available === null ? null : available - chrome;
}
