import { describe, expect, it } from 'vitest';
import {
  CAPTURE_SHARE,
  EXPORT_SLOWMO,
  advancePts,
  beatWorkWeights,
  buildCapturePlan,
  captureProgress,
  captureWindowMs,
  holdKeyframePts,
  retimedPts,
  totalDurationMs,
} from '../replayExport';
import type { Beat } from '../handReplay';
import type { HandAction, Street } from '../../types';

let order = 0;
const act = (street: Street, playerId: string, type: HandAction['type'], amount?: number): HandAction => ({
  id: `${street}-${playerId}-${++order}`,
  street,
  playerId,
  type,
  amount,
  order,
});

const street = (s: Street, revealsCards: boolean, actions: HandAction[] = []): Beat => ({
  kind: 'street',
  street: s,
  revealsCards,
  actions,
});

const BEATS: Beat[] = [
  { kind: 'intro' },
  street('preflop', false, [act('preflop', 'a', 'raise', 3), act('preflop', 'b', 'call', 3)]),
  street('flop', true, [act('flop', 'a', 'bet', 5)]),
  street('turn', true),
  street('river', true),
  { kind: 'showdown' },
];

describe('beatWorkWeights', () => {
  it('is strictly positive for every beat', () => {
    for (const w of beatWorkWeights(BEATS)) expect(w).toBeGreaterThan(0);
  });

  it('scales with the slow-motion factor', () => {
    const slow = beatWorkWeights(BEATS, 6);
    const fast = beatWorkWeights(BEATS, 1);
    slow.forEach((w, i) => expect(w).toBeGreaterThan(fast[i]));
  });

  it('gives the river more weight than the intro', () => {
    const w = beatWorkWeights(BEATS);
    expect(w[4]).toBeGreaterThan(w[0]);
  });
});

describe('retimedPts', () => {
  it('divides capture time by the slow-motion factor', () => {
    expect(retimedPts(1000, 900, 3)).toBe(1300);
  });

  it('is the identity at 1x', () => {
    expect(retimedPts(500, 250, 1)).toBe(750);
  });

  it('never runs past the window it belongs to', () => {
    const beat = BEATS[4];
    const windowMs = buildCapturePlan(BEATS)[4].windowMs;
    const lastCapture = captureWindowMs(beat) - 1;
    expect(retimedPts(0, lastCapture, EXPORT_SLOWMO)).toBeLessThanOrEqual(windowMs);
  });
});

describe('holdKeyframePts', () => {
  it('never emits a stamp at or past the end of the hold', () => {
    const stamps = holdKeyframePts(1000, 400, 1600);
    expect(stamps.length).toBeGreaterThan(0);
    for (const s of stamps) expect(s).toBeLessThan(advancePts(1000, 400, 1600));
  });

  it('emits nothing for a hold shorter than one keep-alive', () => {
    expect(holdKeyframePts(0, 100, 400, 500)).toEqual([]);
  });

  it('emits ascending stamps starting after the window', () => {
    const stamps = holdKeyframePts(0, 200, 2000, 500);
    expect(stamps).toEqual([700, 1200, 1700]);
  });
});

describe('advancePts / totalDurationMs', () => {
  it('is monotonic across the whole plan', () => {
    const plan = buildCapturePlan(BEATS);
    let pts = 0;
    const seen: number[] = [];
    for (const b of plan) {
      const next = advancePts(pts, b.windowMs, b.holdMs);
      expect(next).toBeGreaterThan(pts);
      pts = next;
      seen.push(pts);
    }
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(totalDurationMs(plan)).toBe(pts);
  });

  it('produces a plausible story length for a full hand', () => {
    const ms = totalDurationMs(buildCapturePlan(BEATS));
    expect(ms).toBeGreaterThan(3000);
    expect(ms).toBeLessThan(60000);
  });
});

describe('captureProgress', () => {
  it('is monotonic and never exceeds the capture share', () => {
    const plan = buildCapturePlan(BEATS);
    const total = plan.reduce((s, b) => s + b.work, 0);
    let done = 0;
    let prev = -1;
    for (const b of plan) {
      done += b.work;
      const p = captureProgress(done, total);
      expect(p).toBeGreaterThan(prev);
      expect(p).toBeLessThanOrEqual(CAPTURE_SHARE);
      prev = p;
    }
    expect(prev).toBeCloseTo(CAPTURE_SHARE, 5);
  });

  it('is 0 when there is no work to do', () => {
    expect(captureProgress(0, 0)).toBe(0);
  });

  it('clamps if more work is reported than planned', () => {
    expect(captureProgress(500, 100)).toBe(CAPTURE_SHARE);
  });
});
