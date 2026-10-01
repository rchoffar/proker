import type { OfcAction, OfcVariant } from './engine.js';
import type { RedactedOfcState } from './protocol.js';
import type { OfcHandResult } from './scoring.js';

export type OfcVisibility = 'public' | 'private';
export type OfcGameStatus = 'waiting' | 'playing' | 'finished' | 'abandoned';
export interface OfcMember {
  playerId: string;
  name: string | null; // null after account deletion; translate on the device
  status: 'active' | 'forfeited';
}
export interface OfcGameSummary {
  id: string;
  code: string;
  variant: OfcVariant;
  startingStack: number;
  capacity: 2 | 3;
  visibility: OfcVisibility;
  status: OfcGameStatus;
  version: number;
  members: OfcMember[];
  myPlayerId: string | null;
  canAct: boolean;
  handNumber: number;
  completedHands: number;
  updatedAt: string;
}
export interface OfcGameDetail extends OfcGameSummary {
  state: RedactedOfcState | null;
}
export interface OfcHistoryEntry {
  handNumber: number;
  status: 'completed' | 'cancelled';
  result: OfcHandResult | null;
  createdAt: string;
}
export interface OfcCreateInput {
  variant: OfcVariant;
  startingStack: number;
  capacity: 2 | 3;
  visibility: OfcVisibility;
  requestId: string;
}
export type OfcPlacementAction = Omit<Extract<OfcAction, { placements: unknown }>, 'playerId'>;
export interface OfcMoveInput {
  expectedVersion: number;
  requestId: string;
  action: OfcPlacementAction;
}
