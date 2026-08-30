// Card-fan dimensions, kept free of react-native so the table-layout test can reason about
// what a seat actually occupies. CardFan re-exports all of it.

export type FanSize = 'sm' | 'md';

export const FAN_GEOMETRY: Record<FanSize, { cardW: number; cardH: number; overlap: number; aboveOffset: number }> = {
  sm: { cardW: 30, cardH: 42, overlap: -12, aboveOffset: 44 },
  md: { cardW: 46, cardH: 64, overlap: -16, aboveOffset: 56 },
};

// Small cards for a wide hand (Omaha) OR a busy table: at five seats and up the side pods
// sit close enough to the felt centre that md fans crowd the board even after the table was
// widened. `seatCount` defaults to a short table so a bare `fanSizeFor(n)` keeps its meaning.
export function fanSizeFor(count: number, seatCount = 0): FanSize {
  return count >= 4 || seatCount >= 5 ? 'sm' : 'md';
}

export function fanStep(size: FanSize): number {
  const g = FAN_GEOMETRY[size];
  return g.cardW + g.overlap;
}

export function fanWidth(count: number, size: FanSize): number {
  return FAN_GEOMETRY[size].cardW + Math.max(0, count - 1) * fanStep(size);
}
