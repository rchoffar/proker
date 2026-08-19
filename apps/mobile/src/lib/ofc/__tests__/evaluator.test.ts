import { describe, expect, it } from 'vitest';
import { compareHandScores, evaluateFiveCardHand } from '../../pokerHandEvaluator';
import {
  bottomRoyalty,
  compareRows,
  evaluateGrid,
  evaluateTopHand,
  isFouled,
  middleRoyalty,
  qualifiesFantasy,
  staysFantasy,
  topRoyalty,
} from '../evaluator';
import { cards } from './fixtures';

describe('evaluateTopHand', () => {
  it('detects trips', () => {
    const score = evaluateTopHand(cards('7s 7h 7c'));
    expect(score.categoryId).toBe('trips');
    expect(score.category).toBe(3);
    expect(score.tiebreakers).toEqual([7]);
  });

  it('detects a pair with its kicker, regardless of card order', () => {
    expect(evaluateTopHand(cards('As Kh Kc')).tiebreakers).toEqual([13, 14]);
    expect(evaluateTopHand(cards('Ks As Ah')).tiebreakers).toEqual([14, 13]);
    expect(evaluateTopHand(cards('2c 2d 9h')).tiebreakers).toEqual([2, 9]);
  });

  it('detects high card with descending tiebreakers', () => {
    const score = evaluateTopHand(cards('2c Jh 8d'));
    expect(score.categoryId).toBe('highCard');
    expect(score.tiebreakers).toEqual([11, 8, 2]);
  });

  it('never produces straights or flushes', () => {
    expect(evaluateTopHand(cards('9h Th Jh')).categoryId).toBe('highCard');
  });

  it('requires exactly 3 cards', () => {
    expect(() => evaluateTopHand(cards('As Kh'))).toThrow();
  });
});

describe('compareRows', () => {
  it('ranks by shared category scale (middle straight beats top trips)', () => {
    const straight = evaluateFiveCardHand(cards('5h 6c 7d 8s 9h'));
    const trips = evaluateTopHand(cards('2s 2h 2c'));
    expect(compareRows(straight, trips)).toBeGreaterThan(0);
  });

  it('never yields NaN on mixed 3-card vs 5-card scores (compareHandScores regression)', () => {
    const topPair = evaluateTopHand(cards('Qs Qh 9c'));
    const middlePair = evaluateFiveCardHand(cards('Qd Qc 9d 5s 3h'));
    // The shared comparator iterates the LEFT side's tiebreakers and hits undefined:
    expect(Number.isNaN(compareHandScores(middlePair, topPair))).toBe(true);
    // compareRows compares the common prefix and ties:
    expect(compareRows(middlePair, topPair)).toBe(0);
    expect(compareRows(topPair, middlePair)).toBe(0);
  });

  it('breaks ties within the common prefix', () => {
    const a = evaluateTopHand(cards('Qs Qh 9c'));
    const b = evaluateTopHand(cards('Qd Qc 8s'));
    expect(compareRows(a, b)).toBeGreaterThan(0);
  });
});

describe('isFouled', () => {
  const validGrid = {
    top: cards('Qs Qh 2c'),
    middle: cards('Kh Kc 3d 5s 7h'),
    bottom: cards('Ah Ac 4d 6s 8h'),
  };

  it('accepts bottom ≥ middle ≥ top', () => {
    expect(isFouled(evaluateGrid(validGrid))).toBe(false);
  });

  it('flags middle stronger than bottom', () => {
    const rows = evaluateGrid({
      top: cards('2c 3d 5s'),
      middle: cards('Ah Ac 4d 6s 8h'),
      bottom: cards('Kh Kc 3s 5h 7d'),
    });
    expect(isFouled(rows)).toBe(true);
  });

  it('flags top stronger than middle', () => {
    const rows = evaluateGrid({
      top: cards('As Ah 2c'),
      middle: cards('Kh Kc 3d 5s 7h'),
      bottom: cards('Qs Qh Qd 6s 8c'),
    });
    // bottom trips ≥ middle pair, but top pair A > middle pair K → foul
    expect(isFouled(rows)).toBe(true);
  });

  it('treats equal adjacent rows as legal', () => {
    const rows = evaluateGrid({
      top: cards('Qs Qh 9c'),
      middle: cards('Qd Qc 9d 5s 3h'),
      bottom: cards('Kh Kc 4d 6s 8s'),
    });
    expect(isFouled(rows)).toBe(false);
  });
});

describe('royalties', () => {
  it('top: pairs below 66 earn nothing, 66..AA earn 1..9', () => {
    expect(topRoyalty(evaluateTopHand(cards('2s 2h Kc')))).toBe(0);
    expect(topRoyalty(evaluateTopHand(cards('5s 5h Kc')))).toBe(0);
    const expected: [string, number][] = [
      ['6s 6h Kc', 1], ['7s 7h Kc', 2], ['8s 8h Kc', 3], ['9s 9h Kc', 4], ['Ts Th Kc', 5],
      ['Js Jh Kc', 6], ['Qs Qh Kc', 7], ['Ks Kh Qc', 8], ['As Ah Kc', 9],
    ];
    for (const [hand, points] of expected) {
      expect(topRoyalty(evaluateTopHand(cards(hand)))).toBe(points);
    }
  });

  it('top: trips earn 10 (222) through 22 (AAA)', () => {
    expect(topRoyalty(evaluateTopHand(cards('2s 2h 2c')))).toBe(10);
    expect(topRoyalty(evaluateTopHand(cards('7s 7h 7c')))).toBe(15);
    expect(topRoyalty(evaluateTopHand(cards('As Ah Ac')))).toBe(22);
  });

  it('top: high card earns nothing', () => {
    expect(topRoyalty(evaluateTopHand(cards('As Kh Qc')))).toBe(0);
  });

  it('middle: trips 2, straight 4, flush 8, full 12, quads 20, SF 30, RF 50', () => {
    expect(middleRoyalty(evaluateFiveCardHand(cards('9s 9h Td 5s 3h')))).toBe(0); // pair
    expect(middleRoyalty(evaluateFiveCardHand(cards('9s 9h 5d 5c 3h')))).toBe(0); // two pair
    expect(middleRoyalty(evaluateFiveCardHand(cards('9s 9h 9d 5c 3h')))).toBe(2);
    expect(middleRoyalty(evaluateFiveCardHand(cards('5h 6c 7d 8s 9h')))).toBe(4);
    expect(middleRoyalty(evaluateFiveCardHand(cards('Ah 2c 3d 4s 5h')))).toBe(4); // wheel
    expect(middleRoyalty(evaluateFiveCardHand(cards('2h 5h 8h Jh Kh')))).toBe(8);
    expect(middleRoyalty(evaluateFiveCardHand(cards('4s 4d 4h 9s 9h')))).toBe(12);
    expect(middleRoyalty(evaluateFiveCardHand(cards('4s 4d 4h 4c 9h')))).toBe(20);
    expect(middleRoyalty(evaluateFiveCardHand(cards('5h 6h 7h 8h 9h')))).toBe(30);
    expect(middleRoyalty(evaluateFiveCardHand(cards('Th Jh Qh Kh Ah')))).toBe(50);
  });

  it('bottom: straight 2, flush 4, full 6, quads 10, SF 15, RF 25', () => {
    expect(bottomRoyalty(evaluateFiveCardHand(cards('9s 9h 9d 5c 3h')))).toBe(0); // trips
    expect(bottomRoyalty(evaluateFiveCardHand(cards('5h 6c 7d 8s 9h')))).toBe(2);
    expect(bottomRoyalty(evaluateFiveCardHand(cards('2h 5h 8h Jh Kh')))).toBe(4);
    expect(bottomRoyalty(evaluateFiveCardHand(cards('4s 4d 4h 9s 9h')))).toBe(6);
    expect(bottomRoyalty(evaluateFiveCardHand(cards('4s 4d 4h 4c 9h')))).toBe(10);
    expect(bottomRoyalty(evaluateFiveCardHand(cards('5h 6h 7h 8h 9h')))).toBe(15);
    expect(bottomRoyalty(evaluateFiveCardHand(cards('Th Jh Qh Kh Ah')))).toBe(25);
  });
});

describe('Fantasy Land', () => {
  const gridWithTop = (top: string) => ({
    top: cards(top),
    middle: cards('Ah Ac Ad 6s 8h'),
    bottom: cards('5h 6h 7h 8h 9h'),
  });

  it('QQ+ on top qualifies, JJ does not', () => {
    expect(qualifiesFantasy(evaluateGrid(gridWithTop('Qs Qh 2c')))).toBe(true);
    expect(qualifiesFantasy(evaluateGrid(gridWithTop('Ks Kh 2c')))).toBe(true);
    expect(qualifiesFantasy(evaluateGrid(gridWithTop('Js Jh 2c')))).toBe(false);
    expect(qualifiesFantasy(evaluateGrid(gridWithTop('2s 2h 2c')))).toBe(true); // trips
  });

  it('a fouled QQ top does not qualify', () => {
    const rows = evaluateGrid({
      top: cards('Qs Qh 2c'),
      middle: cards('2h 3s 5d 8s Th'),
      bottom: cards('Kh Kc 3d 5s 7h'),
    });
    expect(isFouled(rows)).toBe(true);
    expect(qualifiesFantasy(rows)).toBe(false);
  });

  it('staying requires trips top, full house+ middle or quads+ bottom', () => {
    const stayTop = evaluateGrid({
      top: cards('2s 2h 2c'),
      middle: cards('9s 9h 9d 5c 3h'),
      bottom: cards('Ks Kh Kd 4c 4h'),
    });
    expect(staysFantasy(stayTop)).toBe(true);

    const stayMiddle = evaluateGrid({
      top: cards('Qs Qh 2c'),
      middle: cards('4s 4d 4h 9s 9h'),
      bottom: cards('Ks Kh Kd Ts Th'),
    });
    expect(isFouled(stayMiddle)).toBe(false);
    expect(staysFantasy(stayMiddle)).toBe(true);

    const stayBottom = evaluateGrid({
      top: cards('Qs Qh 2c'),
      middle: cards('Kh Kc 3d 5s 7h'),
      bottom: cards('4s 4d 4h 4c 9h'),
    });
    expect(staysFantasy(stayBottom)).toBe(true);

    // QQ top alone re-qualifies entry but NOT staying:
    const qqOnly = evaluateGrid({
      top: cards('Qs Qh 2c'),
      middle: cards('Kh Kc 3d 5s 7h'),
      bottom: cards('Ah Ac 4d 6s 8h'),
    });
    expect(staysFantasy(qqOnly)).toBe(false);
    expect(qualifiesFantasy(qqOnly)).toBe(true);
  });
});
