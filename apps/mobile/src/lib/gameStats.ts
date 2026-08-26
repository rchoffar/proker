// Local per-pseudo stats for the mini-games (Flip, Roulette, Bluff, OFC).
// Pure and react/i18n-free: counters only (no event log), persisted via the app
// store. Ratios are derived at display time so nothing stored can go stale.
// Keys are normalized pseudos so "Rémy", " rémy " and "RÉMY" share one entry,
// while the last-seen casing is kept for display.

export type GameKey = 'flip' | 'roulette' | 'bluff' | 'ofc';

export interface FlipStats {
  rounds: number;
  wins: number;
  losses: number;
}

/** The picked player pays the bill — picked = loss, survived = spins - picked. */
export interface RouletteStats {
  spins: number;
  picked: number;
}

export interface BluffStats {
  games: number;
  gamesWon: number;
  /** As catcher: success = the claim did NOT hold. */
  catchAttempts: number;
  catchSuccesses: number;
  /** As claimer: caughtBluffing = challenged while the claim did NOT hold. */
  timesChallenged: number;
  caughtBluffing: number;
}

export interface OfcStats {
  games: number;
  gamesWon: number;
  hands: number;
  fantasyEntries: number;
  fouls: number;
}

export interface PseudoStats {
  displayName: string;
  lastPlayedAt: string;
  flip?: FlipStats;
  roulette?: RouletteStats;
  bluff?: BluffStats;
  ofc?: OfcStats;
}

export type GameStatsState = Record<string, PseudoStats>;

export function normalizePseudo(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function displayName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

const emptyFlip = (): FlipStats => ({ rounds: 0, wins: 0, losses: 0 });
const emptyRoulette = (): RouletteStats => ({ spins: 0, picked: 0 });
const emptyBluff = (): BluffStats => ({
  games: 0,
  gamesWon: 0,
  catchAttempts: 0,
  catchSuccesses: 0,
  timesChallenged: 0,
  caughtBluffing: 0,
});
const emptyOfc = (): OfcStats => ({ games: 0, gamesWon: 0, hands: 0, fantasyEntries: 0, fouls: 0 });

/**
 * Applies `apply` to a fresh copy of one pseudo's per-game counters inside `next`
 * (an already shallow-cloned state). Never touches objects from the input state.
 */
function bump<K extends GameKey>(
  next: GameStatsState,
  name: string,
  at: string,
  game: K,
  create: () => NonNullable<PseudoStats[K]>,
  apply: (g: NonNullable<PseudoStats[K]>) => void
): void {
  const key = normalizePseudo(name);
  if (!key) return;
  const entry: PseudoStats = { ...next[key], displayName: displayName(name), lastPlayedAt: at };
  const counters = { ...(entry[game] ?? create()) } as NonNullable<PseudoStats[K]>;
  apply(counters);
  entry[game] = counters;
  next[key] = entry;
}

export interface FlipRound {
  players: string[];
  /** Ties are possible: several winners AND several losers in one round. */
  winners: string[];
  losers: string[];
}

export function recordFlipRound(
  state: GameStatsState,
  round: FlipRound,
  at: string = new Date().toISOString()
): GameStatsState {
  const next = { ...state };
  for (const name of round.players) bump(next, name, at, 'flip', emptyFlip, (g) => void (g.rounds += 1));
  for (const name of round.winners) bump(next, name, at, 'flip', emptyFlip, (g) => void (g.wins += 1));
  for (const name of round.losers) bump(next, name, at, 'flip', emptyFlip, (g) => void (g.losses += 1));
  return next;
}

export function recordRouletteSpin(
  state: GameStatsState,
  spin: { picked: string; survivors: string[] },
  at: string = new Date().toISOString()
): GameStatsState {
  const next = { ...state };
  bump(next, spin.picked, at, 'roulette', emptyRoulette, (g) => {
    g.spins += 1;
    g.picked += 1;
  });
  for (const name of spin.survivors) {
    bump(next, name, at, 'roulette', emptyRoulette, (g) => void (g.spins += 1));
  }
  return next;
}

export function recordBluffReveal(
  state: GameStatsState,
  reveal: { catcher: string; claimer: string; holds: boolean },
  at: string = new Date().toISOString()
): GameStatsState {
  const next = { ...state };
  bump(next, reveal.catcher, at, 'bluff', emptyBluff, (g) => {
    g.catchAttempts += 1;
    if (!reveal.holds) g.catchSuccesses += 1;
  });
  bump(next, reveal.claimer, at, 'bluff', emptyBluff, (g) => {
    g.timesChallenged += 1;
    if (!reveal.holds) g.caughtBluffing += 1;
  });
  return next;
}

export function recordBluffGameEnd(
  state: GameStatsState,
  game: { players: string[]; winner: string },
  at: string = new Date().toISOString()
): GameStatsState {
  const next = { ...state };
  for (const name of game.players) bump(next, name, at, 'bluff', emptyBluff, (g) => void (g.games += 1));
  bump(next, game.winner, at, 'bluff', emptyBluff, (g) => void (g.gamesWon += 1));
  return next;
}

export interface OfcHandPlayer {
  name: string;
  fouled: boolean;
  fantasyNext: boolean;
}

export function recordOfcHand(
  state: GameStatsState,
  hand: { perPlayer: OfcHandPlayer[] },
  at: string = new Date().toISOString()
): GameStatsState {
  const next = { ...state };
  for (const p of hand.perPlayer) {
    bump(next, p.name, at, 'ofc', emptyOfc, (g) => {
      g.hands += 1;
      if (p.fouled) g.fouls += 1;
      if (p.fantasyNext) g.fantasyEntries += 1;
    });
  }
  return next;
}

export function recordOfcGameEnd(
  state: GameStatsState,
  game: { players: string[]; winner: string },
  at: string = new Date().toISOString()
): GameStatsState {
  const next = { ...state };
  for (const name of game.players) bump(next, name, at, 'ofc', emptyOfc, (g) => void (g.games += 1));
  bump(next, game.winner, at, 'ofc', emptyOfc, (g) => void (g.gamesWon += 1));
  return next;
}

// ---------------------------------------------------------------------------
// Display-time selectors. Ratios return null when the denominator is 0 so the
// UI can hide them instead of showing a meaningless 0%.

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export const flipWinRate = (s: FlipStats): number | null => rate(s.wins, s.rounds);
export const rouletteSurvivalRate = (s: RouletteStats): number | null => rate(s.spins - s.picked, s.spins);
export const bluffCatchRate = (s: BluffStats): number | null => rate(s.catchSuccesses, s.catchAttempts);
export const bluffChallengeSurvivalRate = (s: BluffStats): number | null =>
  rate(s.timesChallenged - s.caughtBluffing, s.timesChallenged);
export const ofcFantasyRate = (s: OfcStats): number | null => rate(s.fantasyEntries, s.hands);
export const ofcFoulRate = (s: OfcStats): number | null => rate(s.fouls, s.hands);

export function hasAnyStats(state: GameStatsState): boolean {
  return Object.keys(state).length > 0;
}

function leaderboardMetric(p: PseudoStats, game: GameKey): number {
  switch (game) {
    case 'flip':
      return p.flip?.wins ?? 0;
    case 'roulette':
      return (p.roulette?.spins ?? 0) - (p.roulette?.picked ?? 0);
    case 'bluff':
      return p.bluff?.gamesWon ?? 0;
    case 'ofc':
      return p.ofc?.gamesWon ?? 0;
  }
}

/** Pseudos having played `game`, best first (wins/survivals desc, then name). */
export function sortedByGame(state: GameStatsState, game: GameKey): [string, PseudoStats][] {
  return Object.entries(state)
    .filter(([, p]) => p[game] !== undefined)
    .sort(
      ([, a], [, b]) =>
        leaderboardMetric(b, game) - leaderboardMetric(a, game) ||
        a.displayName.localeCompare(b.displayName)
    );
}

export interface GameTotals {
  pseudos: number;
  /** Per-pseudo participations summed — a round with 4 players counts 4. */
  flipRounds: number;
  rouletteSpins: number;
  bluffGames: number;
  ofcHands: number;
}

export function totals(state: GameStatsState): GameTotals {
  const result: GameTotals = { pseudos: 0, flipRounds: 0, rouletteSpins: 0, bluffGames: 0, ofcHands: 0 };
  for (const p of Object.values(state)) {
    result.pseudos += 1;
    result.flipRounds += p.flip?.rounds ?? 0;
    result.rouletteSpins += p.roulette?.spins ?? 0;
    result.bluffGames += p.bluff?.games ?? 0;
    result.ofcHands += p.ofc?.hands ?? 0;
  }
  return result;
}
