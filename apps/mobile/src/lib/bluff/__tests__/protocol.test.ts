import { describe, expect, it } from 'vitest';
import type { Player } from '../../../types';
import type { Card } from '../../../types/hand';
import { createRoundDeal, initGame, reduce } from '../engine';
import type { BluffState } from '../engine';
import { redactFor } from '../protocol';
import { mulberry32 } from '../../rng';

const PLAYERS: Player[] = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
  { id: 'c', name: 'Carla' },
];

function dealtGame(seed = 1): BluffState {
  const state = initGame(PLAYERS, mulberry32(seed));
  return reduce(state, createRoundDeal(state, mulberry32(seed + 100)));
}

function serializedContainsCard(json: string, card: Card): boolean {
  return json.includes(JSON.stringify(card));
}

describe('redactFor — the leak test', () => {
  it('never ships another player’s cards, the board stock, nor the hidden middle before the reveal', () => {
    let state = dealtGame();
    const phases: BluffState[] = [state];
    state = reduce(state, { type: 'chooseBoard', playerId: state.starterId, faceUpCount: 2, faceDownCount: 2 });
    phases.push(state);
    state = reduce(state, { type: 'claim', playerId: state.turnId, claim: { category: 'pair', rank: '7' } });
    phases.push(state);

    for (const s of phases) {
      for (const viewer of s.players) {
        const redacted = redactFor(s, viewer.id);
        const json = JSON.stringify(redacted);
        for (const other of s.players) {
          if (other.id === viewer.id) continue;
          for (const card of other.hand) {
            // Chosen face-up board cards are public; anything else from a foreign hand is a leak.
            const isPublicBoard = s.board.some((b) => b.rank === card.rank && b.suit === card.suit);
            if (!isPublicBoard) {
              expect(serializedContainsCard(json, card), `${viewer.id} sees ${card.rank}${card.suit}`).toBe(false);
            }
          }
        }
        for (const stockCard of s.boardStock) {
          const inOwnHand = viewer.hand.some((c) => c.rank === stockCard.rank && c.suit === stockCard.suit);
          if (!inOwnHand) {
            expect(serializedContainsCard(json, stockCard), 'board stock leaked').toBe(false);
          }
        }
        for (const hiddenCard of s.hiddenBoard) {
          expect(serializedContainsCard(json, hiddenCard), 'hidden middle card leaked').toBe(false);
        }
        expect(json.includes('boardStock')).toBe(false);
        expect(json.includes('"hiddenBoard"')).toBe(false);
        expect(redacted.hiddenBoardCount).toBe(s.hiddenBoard.length);
      }
    }
  });

  it('always includes the viewer’s own hand', () => {
    const state = dealtGame();
    for (const viewer of state.players) {
      const redacted = redactFor(state, viewer.id);
      expect(redacted.players.find((p) => p.id === viewer.id)?.hand).toEqual(viewer.hand);
    }
  });

  it('exposes all alive hands and the hidden middle once the catch is revealed', () => {
    let state = dealtGame();
    state = reduce(state, { type: 'chooseBoard', playerId: state.starterId, faceUpCount: 0, faceDownCount: 3 });
    const hidden = state.hiddenBoard;
    state = reduce(state, { type: 'claim', playerId: state.turnId, claim: { category: 'royalFlush' } });
    state = reduce(state, { type: 'catch', playerId: state.turnId });
    for (const viewer of state.players) {
      const redacted = redactFor(state, viewer.id);
      for (const p of redacted.players) {
        expect(p.hand).toBeDefined();
        expect(p.hand).toHaveLength(p.cardCount);
      }
      expect(redacted.hiddenBoard).toEqual(hidden);
      expect(redacted.hiddenBoardCount).toBe(hidden.length);
    }
  });

  it('always carries the public jeu max counters', () => {
    const state = dealtGame();
    const redacted = redactFor(state, 'a');
    for (const p of redacted.players) {
      expect(p.jeuMaxAttempts).toBe(0);
      expect(p.jeuMaxSuccesses).toBe(0);
    }
  });

  it('carries connection flags when provided', () => {
    const state = dealtGame();
    const connected = new Map([['a', true], ['b', false], ['c', true]]);
    const redacted = redactFor(state, 'a', connected);
    expect(redacted.players.find((p) => p.id === 'b')?.connected).toBe(false);
    expect(redacted.players.find((p) => p.id === 'c')?.connected).toBe(true);
  });
});
