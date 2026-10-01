import type { BluffGameDetail, BluffHistoryEntry } from '../../../../../packages/bluff/http';
import { recordBluffGameEnd, recordBluffReveal, type GameStatsState } from '../gameStats';

export function applyBluffOnlineStats(stats: GameStatsState, ledger: Record<string, true>, game: BluffGameDetail, history: BluffHistoryEntry[]) {
  let next = stats;
  const recorded = { ...ledger };
  const names = new Map(game.members.map(m => [m.playerId, m.name]));
  for (const round of history) {
    const key = `${game.id}:round:${round.round}`;
    if (recorded[key] || round.status !== 'completed' || round.result?.kind !== 'catch') continue;
    const catcher = names.get(round.result.catcherId), claimer = names.get(round.result.claimerId);
    if (!catcher || !claimer) continue;
    next = recordBluffReveal(next, { catcher, claimer, holds: round.result.holds });
    recorded[key] = true;
  }
  const key = `${game.id}:end`;
  const winner = game.state?.winnerId ? names.get(game.state.winnerId) : null;
  if (game.status === 'finished' && winner && !recorded[key]) {
    next = recordBluffGameEnd(next, { players: game.members.flatMap(m => m.name ? [m.name] : []), winner });
    recorded[key] = true;
  }
  return { gameStats: next, bluffRecordedEvents: next === stats ? ledger : recorded };
}
