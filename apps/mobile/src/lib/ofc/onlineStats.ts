import type { OfcGameDetail, OfcHistoryEntry } from '../../../../../packages/ofc/http';
import { recordOfcGameEnd, recordOfcHand } from '../gameStats';
import type { GameStatsState } from '../gameStats';

export function applyOfcOnlineStats(stats: GameStatsState, ledger: Record<string, true>, game: OfcGameDetail, history: OfcHistoryEntry[]) {
  let next = stats;
  const recorded = { ...ledger };
  const names = new Map(game.members.map(m => [m.playerId, m.name]));
  for (const hand of history) {
    const key = `${game.id}:hand:${hand.handNumber}`;
    if (!hand.result || hand.status !== 'completed' || recorded[key]) continue;
    next = recordOfcHand(next, { perPlayer: Object.values(hand.result.perPlayer).flatMap(p => {
      const name = names.get(p.playerId);
      return name ? [{ name, fouled: p.fouled, fantasyNext: p.fantasyNext }] : [];
    }) });
    recorded[key] = true;
  }
  const gameKey = `${game.id}:end`;
  const winner = game.state?.winnerId ? names.get(game.state.winnerId) : null;
  if (game.status === 'finished' && winner && !recorded[gameKey]) {
    next = recordOfcGameEnd(next, { players: game.members.flatMap(m => m.name ? [m.name] : []), winner });
    recorded[gameKey] = true;
  }
  return { gameStats: next, ofcRecordedEvents: next === stats ? ledger : recorded };
}
