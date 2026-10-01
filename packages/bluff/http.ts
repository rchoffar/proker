import type { BluffAction, BluffConfig, RevealResult } from './engine.js';
import type { RedactedState } from './protocol.js';
export type BluffStatus = 'waiting' | 'playing' | 'finished' | 'abandoned';
export interface BluffCreateInput {
  config: BluffConfig;
  capacity: number;
  visibility: 'public' | 'private';
  requestId: string;
}
export interface BluffGameSummary {
  id: string;
  code: string;
  config: BluffConfig;
  capacity: number;
  visibility: 'public' | 'private';
  status: BluffStatus;
  version: number;
  members: { playerId: string; name: string | null; status: 'active' | 'forfeited' }[];
  myPlayerId: string | null;
  canAct: boolean;
  round: number;
  completedRounds: number;
  updatedAt: string;
}
export interface BluffGameDetail extends BluffGameSummary { state: RedactedState | null }
export interface BluffMoveInput {
  requestId: string;
  expectedVersion: number;
  action: Omit<Extract<BluffAction, { type: 'chooseBoard' }>, 'playerId'> |
    Omit<Extract<BluffAction, { type: 'claim' }>, 'playerId'> | { type: 'catch' | 'jeuMax' };
}
export interface BluffHistoryEntry {
  round: number;
  status: 'completed' | 'cancelled';
  result: RevealResult | null;
}
