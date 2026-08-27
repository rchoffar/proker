import { describe, expect, it } from 'vitest';
import { mulberry32, shuffleWithRng } from '../../rng';
import { createDeck } from '../../pokerHandEvaluator';
import type { OfcGrid } from '../evaluator';
import type { ScoringInput } from '../scoring';
import { scoreHand } from '../scoring';
import { cards } from './fixtures';

// Reference grids (no cross-player card-uniqueness needed — scoring is pure math):
// STRONG_A beats PLAIN_B on all three rows (scoop), no royalties on either side.
const STRONG_A: OfcGrid = {
  top: cards('Ah Kd 2c'),
  middle: cards('9h 9c 4d 6s Jc'),
  bottom: cards('Kh Ks 3d 7c 9d'),
};
const PLAIN_B: OfcGrid = {
  top: cards('Qh Jd 3c'),
  middle: cards('8h 8c 4h 6d Jh'),
  bottom: cards('Qc Qd 5s 7d Td'),
};
// Fouled: top pair of aces over a ten-high middle.
const FOULED: OfcGrid = {
  top: cards('As Ac 4c'),
  middle: cards('2h 3s 5d 8s Th'),
  bottom: cards('2d 2s 6h 7s 8c'),
};
// 16 royalty points: top 77 (+2), middle flush (+8), bottom full house (+6).
const ROYAL_16: OfcGrid = {
  top: cards('7h 7c Ah'),
  middle: cards('2c 5c 8c Jc Kc'),
  bottom: cards('4s 4d 4h 9s 9h'),
};

function input(id: string, grid: OfcGrid, chips = 100, inFantasyLand = false): ScoringInput {
  return { id, grid, inFantasyLand, chips };
}

describe('scoreHand — pairwise points', () => {
  it('scores a scoop as 3 lines + 3 bonus', () => {
    const result = scoreHand([input('a', STRONG_A), input('b', PLAIN_B)]);
    const pair = result.pairs[0];
    expect(pair.lineWins).toEqual({ top: 1, middle: 1, bottom: 1 });
    expect(pair.scoopBy).toBe('a');
    expect(pair.points).toBe(6);
    expect(result.chipDelta).toEqual({ a: 6, b: -6 });
  });

  it('nets royalties between non-fouled players', () => {
    // ROYAL_16 also wins all three rows vs PLAIN_B → 3 + 3 + 16 = 22.
    const result = scoreHand([input('r', ROYAL_16), input('b', PLAIN_B)]);
    expect(result.perPlayer.r.royalties.total).toBe(16);
    expect(result.perPlayer.r.royalties).toEqual({ top: 2, middle: 8, bottom: 6, total: 16 });
    expect(result.pairs[0].points).toBe(22);
  });

  it('a tied row kills the scoop', () => {
    const aTied: OfcGrid = { ...STRONG_A, top: cards('Qs Jc 3d') }; // same Q-J-3 as PLAIN_B
    const result = scoreHand([input('a', aTied), input('b', PLAIN_B)]);
    const pair = result.pairs[0];
    expect(pair.lineWins.top).toBe(0);
    expect(pair.scoopBy).toBeNull();
    expect(pair.points).toBe(2);
  });

  it('foul pays 6 plus the standing player\'s royalties, own royalties cancelled', () => {
    const result = scoreHand([input('f', FOULED), input('r', ROYAL_16)]);
    expect(result.perPlayer.f.fouled).toBe(true);
    expect(result.perPlayer.f.royalties.total).toBe(0); // AA top royalty cancelled
    expect(result.pairs[0].points).toBe(-(6 + 16));
    expect(result.pairs[0].lineWins).toEqual({ top: 0, middle: 0, bottom: 0 });
    expect(result.chipDelta).toEqual({ f: -22, r: 22 });
  });

  it('both fouled exchanges nothing', () => {
    const otherFoul: OfcGrid = {
      top: cards('Ks Kc 5c'),
      middle: cards('2c 3c 5h 8d Tc'),
      bottom: cards('3d 3h 6d 7h 9c'),
    };
    const result = scoreHand([input('f1', FOULED), input('f2', otherFoul)]);
    expect(result.pairs[0].points).toBe(0);
    expect(result.chipDelta).toEqual({ f1: 0, f2: 0 });
  });

  it('a fouled hand never enters Fantasy Land', () => {
    const result = scoreHand([input('f', FOULED), input('b', PLAIN_B)]);
    expect(result.perPlayer.f.fantasyNext).toBe(false);
  });
});

describe('scoreHand — chip settlement', () => {
  it('caps a transfer at the payer\'s stack and eliminates at zero', () => {
    const result = scoreHand([input('r', ROYAL_16, 100), input('b', PLAIN_B, 10)]);
    const pair = result.pairs[0];
    expect(pair.points).toBe(22);
    expect(pair.chips).toBe(10);
    expect(pair.capped).toBe(true);
    expect(result.chipDelta).toEqual({ r: 10, b: -10 });
    expect(result.eliminatedIds).toEqual(['b']);
  });

  it("caps a win at the winner's own stack — a 4-chip stack can't win 18 (table stakes)", () => {
    // ROYAL_16 scoops PLAIN_B for 22 points, but only has 4 chips behind: like a poker
    // all-in, it can only win what it can match per opponent.
    const result = scoreHand([input('r', ROYAL_16, 4), input('b', PLAIN_B, 100)]);
    const pair = result.pairs[0];
    expect(pair.points).toBe(22);
    expect(pair.chips).toBe(4);
    expect(pair.capped).toBe(true);
    expect(result.chipDelta).toEqual({ r: 4, b: -4 });
    expect(result.eliminatedIds).toEqual([]);
  });

  it('settles sequentially — a win collected earlier funds a later loss', () => {
    // p0 fouled (10 chips), p1 = PLAIN_B (5 chips), p2 = ROYAL_16 (100 chips).
    // (p0,p1): p0 owes 6, but p1 can only match its 5-chip stack → p1 has 10, p0 has 5.
    // (p0,p2): p0 owes 22, pays its remaining min(22, 5) = 5, busts.
    // (p1,p2): p1 owes 22, pays min(22, 10) = 10 with chips won from p0, busts.
    const result = scoreHand([
      input('p0', FOULED, 10),
      input('p1', PLAIN_B, 5),
      input('p2', ROYAL_16, 100),
    ]);
    expect(result.pairs.map((p) => [p.aId, p.bId])).toEqual([
      ['p0', 'p1'],
      ['p0', 'p2'],
      ['p1', 'p2'],
    ]);
    expect(result.pairs[0].chips).toBe(-5);
    expect(result.pairs[0].capped).toBe(true);
    expect(result.pairs[1].chips).toBe(-5);
    expect(result.pairs[1].capped).toBe(true);
    expect(result.pairs[2].chips).toBe(-10);
    expect(result.pairs[2].capped).toBe(true);
    expect(result.chipDelta).toEqual({ p0: -10, p1: -5, p2: 15 });
    expect(result.eliminatedIds).toEqual(['p0', 'p1']);
  });

  it('conserves chips (zero-sum) over random complete grids', () => {
    const rng = mulberry32(1234);
    for (let round = 0; round < 50; round++) {
      const deck = shuffleWithRng(createDeck(), rng);
      const playerCount = round % 2 === 0 ? 2 : 3;
      const players: ScoringInput[] = [];
      let cursor = 0;
      for (let i = 0; i < playerCount; i++) {
        const hand = deck.slice(cursor, cursor + 13);
        cursor += 13;
        players.push({
          id: `p${i}`,
          grid: { top: hand.slice(0, 3), middle: hand.slice(3, 8), bottom: hand.slice(8, 13) },
          inFantasyLand: false,
          chips: 20 + Math.floor(rng() * 80),
        });
      }
      const result = scoreHand(players);
      const totalDelta = Object.values(result.chipDelta).reduce((sum, d) => sum + d, 0);
      expect(totalDelta).toBe(0);
      for (const p of players) {
        expect(p.chips + result.chipDelta[p.id]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
