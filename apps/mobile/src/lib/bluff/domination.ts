import type { Card, Rank, Suit } from '../../types/hand';
import { RANKS, SUITS, cardKey } from '../../types/hand';
import type { Claim, ClaimCategory } from './claims';
import { RANK_VALUE, claimStrength, enumerateAllClaims, isStrictlyHigher } from './claims';
import { claimHolds, findHigherClaim, straightRanks } from './validator';

// Board-aware announcement rule: the face-up middle cards are common knowledge, so an
// announcement the board makes VACUOUS (the board alone already proves it) or DOMINATED
// (any cards realizing it, combined with the board, always prove something strictly
// higher) is not a real announcement — e.g. « quinte au 7 » with an 8 face up (4-5-6-7
// plus the visible 8 is always quinte au 8), « paire de 8 » over a visible 5-5 (8-8 plus
// the board's 5-5 is always two pair), anything ≤ brelan de 2 on a 2-2-2 board.
//
// Face-DOWN middle cards never restrict announcements: nobody knows them, so they can't
// make an announcement dishonest. Only `state.board` (face-up) feeds this module.
//
// Exactness: a claim's minimal witnesses are the only worlds that matter — every pool
// where the claim holds contains board ∪ (some minimal witness), and claims are monotone
// (extra cards only ever ADD higher claims). So "every minimal union proves something
// higher" ⟺ "every possible pool proves something higher". The enumeration is bounded;
// past the cap we FAIL OPEN (allow) — the rule may miss an exotic domination but never
// forbids a legitimate announcement.

const ENUM_CAP = 4000;

/** Suits available for an extra card of `rank` (the board's copies are reused, never duplicated). */
function freeSuits(rank: Rank, board: Card[]): Suit[] {
  const taken = new Set(board.filter((c) => c.rank === rank).map((c) => c.suit));
  return SUITS.filter((s) => !taken.has(s));
}

function* suitChoices(rank: Rank, suits: Suit[], need: number, start = 0): Generator<Card[]> {
  if (need === 0) {
    yield [];
    return;
  }
  for (let i = start; i <= suits.length - need; i++) {
    for (const rest of suitChoices(rank, suits, need - 1, i + 1)) {
      yield [{ rank, suit: suits[i] }, ...rest];
    }
  }
}

/** Extras completing an n-of-a-kind of `rank` on top of the board's copies. */
function* ofAKindExtras(rank: Rank, n: number, board: Card[]): Generator<Card[]> {
  const have = board.filter((c) => c.rank === rank).length;
  yield* suitChoices(rank, freeSuits(rank, board), Math.max(0, n - have));
}

/** All minimal sets of extra cards that, unioned with the board, realize the claim. */
function* witnessExtras(claim: Claim, board: Card[]): Generator<Card[]> {
  switch (claim.category) {
    case 'pair':
      yield* ofAKindExtras(claim.rank, 2, board);
      return;
    case 'trips':
      yield* ofAKindExtras(claim.rank, 3, board);
      return;
    case 'quads':
      yield* ofAKindExtras(claim.rank, 4, board);
      return;
    case 'twoPair':
      for (const high of ofAKindExtras(claim.high, 2, board)) {
        for (const low of ofAKindExtras(claim.low, 2, board)) yield [...high, ...low];
      }
      return;
    case 'fullHouse':
      for (const trips of ofAKindExtras(claim.trips, 3, board)) {
        for (const pair of ofAKindExtras(claim.pair, 2, board)) yield [...trips, ...pair];
      }
      return;
    case 'straight': {
      // One card per rank missing from the board (any rank already face up is reused).
      const missing = straightRanks(claim.high).filter((r) => !board.some((c) => c.rank === r));
      yield* rankProduct(missing, board);
      return;
    }
    case 'flush': {
      // Only witnesses whose top card is exactly the announced high can be free: a
      // higher same-suit card (on the board or in the witness) IS a higher flush.
      for (const suit of SUITS) {
        if (board.some((c) => c.suit === suit && RANK_VALUE[c.rank] > RANK_VALUE[claim.high])) continue;
        const hasHigh = board.some((c) => c.suit === suit && c.rank === claim.high);
        const below = board.filter((c) => c.suit === suit && RANK_VALUE[c.rank] < RANK_VALUE[claim.high]).length;
        const needed = 5 - below - (hasHigh ? 1 : 0);
        const highExtra: Card[] = hasHigh ? [] : [{ rank: claim.high, suit }];
        const fillers = Math.max(0, needed - highExtra.length);
        const candidates = RANKS.filter(
          (r) => RANK_VALUE[r] < RANK_VALUE[claim.high] && !board.some((c) => c.suit === suit && c.rank === r),
        );
        for (const combo of rankCombos(candidates, fillers)) {
          yield [...highExtra, ...combo.map((rank) => ({ rank, suit }))];
        }
      }
      return;
    }
    case 'straightFlush': {
      for (const suit of SUITS) {
        const extras = straightRanks(claim.high)
          .filter((r) => !board.some((c) => c.suit === suit && c.rank === r))
          .map((rank) => ({ rank, suit }));
        yield extras;
      }
      return;
    }
    case 'royalFlush':
      return; // exempt — handled before enumeration
  }
}

/** Cartesian product of suit choices for a list of board-absent ranks. */
function* rankProduct(ranks: Rank[], board: Card[], index = 0): Generator<Card[]> {
  if (index >= ranks.length) {
    yield [];
    return;
  }
  // Least-loaded suits first: the first leaf tried is the one most likely to be free.
  const load = new Map(SUITS.map((s) => [s, board.filter((c) => c.suit === s).length]));
  const suits = [...freeSuits(ranks[index], board)].sort((a, b) => load.get(a)! - load.get(b)!);
  for (const suit of suits) {
    for (const rest of rankProduct(ranks, board, index + 1)) {
      yield [{ rank: ranks[index], suit }, ...rest];
    }
  }
}

function* rankCombos(candidates: Rank[], k: number, start = 0): Generator<Rank[]> {
  if (k === 0) {
    yield [];
    return;
  }
  for (let i = start; i <= candidates.length - k; i++) {
    for (const rest of rankCombos(candidates, k - 1, i + 1)) {
      yield [candidates[i], ...rest];
    }
  }
}

/** Whether the face-up board makes announcing `claim` vacuous or dominated. */
export function isClaimForbiddenByBoard(claim: Claim, board: Card[]): boolean {
  if (claim.category === 'royalFlush') return false; // top of the ladder — always announceable
  if (board.length === 0) return false;
  // Vacuous: the board alone already proves the claim (announcing what everyone sees).
  if (claimHolds(claim, board)) return true;
  // Cheap floor exit: the board alone proves something strictly higher.
  if (findHigherClaim(claim, board)) return true;
  // Dominated: every minimal realization, unioned with the board, proves something higher.
  let leaves = 0;
  for (const extras of witnessExtras(claim, board)) {
    if (++leaves > ENUM_CAP) return false; // fail open — never forbid what we can't disprove
    if (findHigherClaim(claim, [...board, ...extras]) === null) return false;
  }
  return true;
}

// The full allowed-claim scan runs once per (board, bidding phase) — memoize the
// forbidden set per board (the board is frozen for a whole round of bidding).
const forbiddenMemo = new Map<string, Set<number>>();

function forbiddenStrengths(board: Card[]): Set<number> {
  const key = board
    .map(cardKey)
    .sort()
    .join(',');
  let cached = forbiddenMemo.get(key);
  if (!cached) {
    cached = new Set(
      enumerateAllClaims()
        .filter((c) => isClaimForbiddenByBoard(c, board))
        .map(claimStrength),
    );
    forbiddenMemo.set(key, cached);
    if (forbiddenMemo.size > 32) {
      forbiddenMemo.delete(forbiddenMemo.keys().next().value!);
    }
  }
  return cached;
}

/** Every claim that both outbids `current` and survives the board rule, ascending. */
export function allowedClaimsOnBoard(current: Claim | null, board: Card[]): Claim[] {
  const forbidden = forbiddenStrengths(board);
  return enumerateAllClaims().filter(
    (c) => isStrictlyHigher(c, current) && !forbidden.has(claimStrength(c)),
  );
}

/** Board-aware replacement for categoryHasHigherClaim — drives the picker's category chips. */
export function categoryHasAllowedClaim(
  category: ClaimCategory,
  current: Claim | null,
  board: Card[],
): boolean {
  return allowedClaimsOnBoard(current, board).some((c) => c.category === category);
}

function primaryOf(claim: Claim): Rank | null {
  switch (claim.category) {
    case 'pair':
    case 'trips':
    case 'quads':
      return claim.rank;
    case 'twoPair':
      return claim.low; // low pair is picked first — table convention
    case 'fullHouse':
      return claim.trips;
    case 'straight':
    case 'flush':
    case 'straightFlush':
      return claim.high;
    case 'royalFlush':
      return null;
  }
}

/** Board-aware replacement for allowedPrimaryRanks. */
export function allowedPrimaryRanksOnBoard(
  category: ClaimCategory,
  current: Claim | null,
  board: Card[],
): Set<Rank> {
  const ranks = new Set<Rank>();
  for (const claim of allowedClaimsOnBoard(current, board)) {
    if (claim.category !== category) continue;
    const primary = primaryOf(claim);
    if (primary) ranks.add(primary);
  }
  return ranks;
}

/** Board-aware replacement for allowedSecondaryRanks (twoPair high / fullHouse pair). */
export function allowedSecondaryRanksOnBoard(
  category: 'twoPair' | 'fullHouse',
  primary: Rank,
  current: Claim | null,
  board: Card[],
): Set<Rank> {
  const ranks = new Set<Rank>();
  for (const claim of allowedClaimsOnBoard(current, board)) {
    if (claim.category !== category) continue;
    if (claim.category === 'twoPair' && claim.low === primary) ranks.add(claim.high);
    else if (claim.category === 'fullHouse' && claim.trips === primary) ranks.add(claim.pair);
  }
  return ranks;
}
