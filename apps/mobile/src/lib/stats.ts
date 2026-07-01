import type { Session, Stake, TournamentSession, ComputedStats, BankrollSnapshot } from '../types';

export function sessionNetValues(session: Session): { invested: number; profit: number } {
  const bs = session.backings ?? [];
  const totalBuyIn = session.type === 'tournament'
    ? (session.reEntries + 1) * session.buyIn
    : session.buyIn;
  // what you actually pay after backer contributions
  const yourInvested = totalBuyIn - bs.reduce((sum, b) => sum + (b.buyInShare / 100) * totalBuyIn, 0);
  // what you actually receive after paying out backers
  const yourCashout = session.cashOut - bs.reduce((sum, b) => sum + (b.profitShare / 100) * session.cashOut, 0);
  return { invested: yourInvested, profit: yourCashout - yourInvested };
}

export function getSessionProfit(session: Session): number {
  return sessionNetValues(session).profit;
}

export function getSessionInvested(session: Session): number {
  return sessionNetValues(session).invested;
}

export function getStakeProfit(stake: Stake): number {
  if (!stake.settled) return 0;
  const invested = (stake.percentage / 100) * stake.buyIn;
  const myReturn = stake.cashed ? (stake.percentage / 100) * (stake.theirCashout ?? 0) : 0;
  return myReturn - invested;
}

/**
 * Same math as the store's all-time stats, but restricted to items within `windowDays`
 * of now (pass Infinity for all-time). "This month" figures always use the real current
 * month regardless of the window, matching the dashboard's separate monthly card.
 */
export function computeWindowedStats(sessions: Session[], stakes: Stake[], windowDays: number): ComputedStats {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const cutoff = Number.isFinite(windowDays)
    ? new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)
    : null;
  const inWindow = (dateIso: string) => !cutoff || new Date(dateIso) >= cutoff;

  let totalProfit = 0;
  let totalInvested = 0;
  let totalHours = 0;
  let biggestWin = 0;
  let biggestLoss = 0;
  let tournamentsCashed = 0;
  let totalTournaments = 0;
  let thisMonthProfit = 0;
  let thisMonthSessions = 0;

  for (const s of sessions) {
    if (!inWindow(s.date)) continue;
    const profit = getSessionProfit(s);
    const invested = getSessionInvested(s);
    totalProfit += profit;
    totalInvested += invested;
    totalHours += s.durationHours;
    if (profit > biggestWin) biggestWin = profit;
    if (profit < biggestLoss) biggestLoss = profit;
    if (s.type === 'tournament') {
      totalTournaments++;
      if ((s as TournamentSession).cashed) tournamentsCashed++;
    }
    if (s.date.startsWith(thisMonth)) {
      thisMonthProfit += profit;
      thisMonthSessions++;
    }
  }

  for (const stake of stakes) {
    if (!stake.settled || !inWindow(stake.date)) continue;
    const invested = (stake.percentage / 100) * stake.buyIn;
    const profit = getStakeProfit(stake);
    totalProfit += profit;
    totalInvested += invested;
    if (profit > biggestWin) biggestWin = profit;
    if (profit < biggestLoss) biggestLoss = profit;
    if (stake.date.startsWith(thisMonth)) {
      thisMonthProfit += profit;
    }
  }

  return {
    totalProfit,
    totalInvested,
    roi: totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0,
    hourlyRate: totalHours > 0 ? totalProfit / totalHours : 0,
    totalSessions: sessions.filter((s) => inWindow(s.date)).length,
    totalHours,
    biggestWin,
    biggestLoss,
    itmRate: totalTournaments > 0 ? (tournamentsCashed / totalTournaments) * 100 : 0,
    thisMonthProfit,
    thisMonthSessions,
  };
}

type HistoryEntry = { date: string; profit: number };

export function computeBankrollHistory(sessions: Session[], stakes: Stake[]): BankrollSnapshot[] {
  const entries: HistoryEntry[] = [
    ...sessions.map((s) => ({ date: s.date.slice(0, 10), profit: getSessionProfit(s) })),
    ...stakes
      .filter((s) => s.settled)
      .map((s) => ({ date: s.date.slice(0, 10), profit: getStakeProfit(s) })),
  ];
  if (entries.length === 0) return [];
  entries.sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  return entries.map((e) => ({ date: e.date, amount: (running += e.profit) }));
}

export interface WeeklyVolumeBucket {
  label: string;
  hours: number;
  isCurrent: boolean;
}

function isoWeekOfMonth(date: Date): number {
  return Math.ceil(date.getDate() / 7);
}

/** Buckets a given month's sessions by week-of-month (S1..S5), summing durationHours. */
export function computeWeeklyVolume(sessions: Session[], monthKey: string): WeeklyVolumeBucket[] {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentWeek = currentMonthKey === monthKey ? isoWeekOfMonth(now) : -1;

  const monthSessions = sessions.filter((s) => s.date.startsWith(monthKey));
  const weekCount = Math.max(4, ...monthSessions.map((s) => isoWeekOfMonth(new Date(s.date))), currentWeek);

  const buckets: WeeklyVolumeBucket[] = Array.from({ length: weekCount }, (_, i) => ({
    label: `S${i + 1}`,
    hours: 0,
    isCurrent: i + 1 === currentWeek,
  }));

  for (const s of monthSessions) {
    const week = isoWeekOfMonth(new Date(s.date));
    if (buckets[week - 1]) buckets[week - 1].hours += s.durationHours;
  }

  return buckets;
}
