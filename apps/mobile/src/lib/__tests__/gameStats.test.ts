import { describe, expect, it } from 'vitest';
import {
  bluffCatchRate,
  bluffChallengeSurvivalRate,
  flipWinRate,
  hasAnyStats,
  normalizePseudo,
  ofcFantasyRate,
  ofcFoulRate,
  recordBluffGameEnd,
  recordBluffReveal,
  recordFlipRound,
  recordOfcGameEnd,
  recordOfcHand,
  recordRouletteSpin,
  rouletteSurvivalRate,
  sortedByGame,
  totals,
  type GameStatsState,
} from '../gameStats';

const AT = '2026-08-25T12:00:00.000Z';

function frozen(state: GameStatsState): GameStatsState {
  for (const entry of Object.values(state)) {
    for (const value of Object.values(entry)) {
      if (typeof value === 'object' && value !== null) Object.freeze(value);
    }
    Object.freeze(entry);
  }
  return Object.freeze(state);
}

describe('normalizePseudo', () => {
  it('trims, lowercases and collapses inner whitespace', () => {
    expect(normalizePseudo('  RÉMY   C  ')).toBe('rémy c');
  });

  it('applies NFKC so composed and decomposed accents share a key', () => {
    expect(normalizePseudo('rémy')).toBe(normalizePseudo('rémy'));
  });
});

describe('recordFlipRound', () => {
  it('counts ties for every winner and every loser, rounds for everyone', () => {
    const state = recordFlipRound(
      frozen({}),
      { players: ['A', 'B', 'C', 'D', 'E'], winners: ['A', 'B'], losers: ['C', 'D'] },
      AT
    );
    expect(state[normalizePseudo('A')].flip).toEqual({ rounds: 1, wins: 1, losses: 0 });
    expect(state[normalizePseudo('B')].flip).toEqual({ rounds: 1, wins: 1, losses: 0 });
    expect(state[normalizePseudo('C')].flip).toEqual({ rounds: 1, wins: 0, losses: 1 });
    expect(state[normalizePseudo('E')].flip).toEqual({ rounds: 1, wins: 0, losses: 0 });
  });

  it('never mutates the input state', () => {
    const before = frozen({
      a: { displayName: 'A', lastPlayedAt: AT, flip: { rounds: 1, wins: 1, losses: 0 } },
    });
    const after = recordFlipRound(before, { players: ['A'], winners: ['A'], losers: [] }, AT);
    expect(before.a.flip).toEqual({ rounds: 1, wins: 1, losses: 0 });
    expect(after.a.flip).toEqual({ rounds: 2, wins: 2, losses: 0 });
  });

  it('keeps the latest display casing and timestamp', () => {
    let state = recordFlipRound({}, { players: ['rémy'], winners: [], losers: [] }, AT);
    state = recordFlipRound(state, { players: ['  Rémy '], winners: [], losers: [] }, '2026-08-26T00:00:00.000Z');
    const entry = state[normalizePseudo('rémy')];
    expect(entry.displayName).toBe('Rémy');
    expect(entry.lastPlayedAt).toBe('2026-08-26T00:00:00.000Z');
    expect(entry.flip?.rounds).toBe(2);
  });
});

describe('recordRouletteSpin', () => {
  it('marks the picked player and the survivors', () => {
    const state = recordRouletteSpin(frozen({}), { picked: 'A', survivors: ['B', 'C'] }, AT);
    expect(state[normalizePseudo('A')].roulette).toEqual({ spins: 1, picked: 1 });
    expect(state[normalizePseudo('B')].roulette).toEqual({ spins: 1, picked: 0 });
    expect(rouletteSurvivalRate(state[normalizePseudo('A')].roulette!)).toBe(0);
    expect(rouletteSurvivalRate(state[normalizePseudo('B')].roulette!)).toBe(1);
  });
});

describe('recordBluffReveal', () => {
  it('credits a successful catch when the claim does not hold', () => {
    const state = recordBluffReveal(frozen({}), { catcher: 'Cat', claimer: 'Bluffer', holds: false }, AT);
    expect(state[normalizePseudo('Cat')].bluff).toMatchObject({ catchAttempts: 1, catchSuccesses: 1 });
    expect(state[normalizePseudo('Bluffer')].bluff).toMatchObject({ timesChallenged: 1, caughtBluffing: 1 });
  });

  it('counts a failed catch when the claim holds', () => {
    const state = recordBluffReveal(frozen({}), { catcher: 'Cat', claimer: 'Honest', holds: true }, AT);
    expect(state[normalizePseudo('Cat')].bluff).toMatchObject({ catchAttempts: 1, catchSuccesses: 0 });
    expect(state[normalizePseudo('Honest')].bluff).toMatchObject({ timesChallenged: 1, caughtBluffing: 0 });
    expect(bluffCatchRate(state[normalizePseudo('Cat')].bluff!)).toBe(0);
    expect(bluffChallengeSurvivalRate(state[normalizePseudo('Honest')].bluff!)).toBe(1);
  });
});

describe('game end records', () => {
  it('counts a bluff game for every participant including eliminated ones', () => {
    const state = recordBluffGameEnd(frozen({}), { players: ['A', 'B', 'C'], winner: 'B' }, AT);
    expect(state[normalizePseudo('A')].bluff).toMatchObject({ games: 1, gamesWon: 0 });
    expect(state[normalizePseudo('B')].bluff).toMatchObject({ games: 1, gamesWon: 1 });
    expect(state[normalizePseudo('C')].bluff).toMatchObject({ games: 1, gamesWon: 0 });
  });

  it('counts an OFC game the same way', () => {
    const state = recordOfcGameEnd(frozen({}), { players: ['A', 'B'], winner: 'A' }, AT);
    expect(state[normalizePseudo('A')].ofc).toMatchObject({ games: 1, gamesWon: 1 });
    expect(state[normalizePseudo('B')].ofc).toMatchObject({ games: 1, gamesWon: 0 });
  });
});

describe('recordOfcHand', () => {
  it('tracks hands, fouls and fantasy entries per player', () => {
    let state: GameStatsState = {};
    state = recordOfcHand(
      state,
      {
        perPlayer: [
          { name: 'A', fouled: true, fantasyNext: false },
          { name: 'B', fouled: false, fantasyNext: true },
        ],
      },
      AT
    );
    state = recordOfcHand(
      frozen(state),
      {
        perPlayer: [
          { name: 'A', fouled: false, fantasyNext: false },
          { name: 'B', fouled: false, fantasyNext: false },
        ],
      },
      AT
    );
    const a = state[normalizePseudo('A')].ofc!;
    const b = state[normalizePseudo('B')].ofc!;
    expect(a).toMatchObject({ hands: 2, fouls: 1, fantasyEntries: 0 });
    expect(b).toMatchObject({ hands: 2, fouls: 0, fantasyEntries: 1 });
    expect(ofcFoulRate(a)).toBe(0.5);
    expect(ofcFantasyRate(b)).toBe(0.5);
  });
});

describe('selectors', () => {
  it('ratios return null on zero denominators', () => {
    expect(flipWinRate({ rounds: 0, wins: 0, losses: 0 })).toBeNull();
    expect(rouletteSurvivalRate({ spins: 0, picked: 0 })).toBeNull();
    expect(
      bluffCatchRate({ games: 1, gamesWon: 0, catchAttempts: 0, catchSuccesses: 0, timesChallenged: 0, caughtBluffing: 0 })
    ).toBeNull();
    expect(
      bluffChallengeSurvivalRate({ games: 1, gamesWon: 0, catchAttempts: 0, catchSuccesses: 0, timesChallenged: 0, caughtBluffing: 0 })
    ).toBeNull();
    expect(ofcFantasyRate({ games: 0, gamesWon: 0, hands: 0, fantasyEntries: 0, fouls: 0 })).toBeNull();
  });

  it('hasAnyStats reflects emptiness', () => {
    expect(hasAnyStats({})).toBe(false);
    expect(hasAnyStats(recordRouletteSpin({}, { picked: 'A', survivors: [] }, AT))).toBe(true);
  });

  it('sortedByGame filters to the game and ranks best first', () => {
    let state: GameStatsState = {};
    state = recordFlipRound(state, { players: ['A', 'B'], winners: ['B'], losers: ['A'] }, AT);
    state = recordFlipRound(state, { players: ['A', 'B'], winners: ['B'], losers: ['A'] }, AT);
    state = recordRouletteSpin(state, { picked: 'C', survivors: [] }, AT);
    const rows = sortedByGame(state, 'flip');
    expect(rows.map(([key]) => key)).toEqual([normalizePseudo('B'), normalizePseudo('A')]);
  });

  it('totals sums per-pseudo participations', () => {
    let state: GameStatsState = {};
    state = recordFlipRound(state, { players: ['A', 'B'], winners: ['A'], losers: ['B'] }, AT);
    state = recordOfcHand(state, { perPlayer: [{ name: 'A', fouled: false, fantasyNext: false }] }, AT);
    expect(totals(state)).toEqual({ pseudos: 2, flipRounds: 2, rouletteSpins: 0, bluffGames: 0, ofcHands: 1 });
  });
});
