# Proker — Product Specification

> Poker ecosystem app for professional players. All data is mocked locally in JSON for V1. External APIs and database integration deferred to later phases.

---

## App Identity

| Field | Value |
|---|---|
| Name | Proker |
| Tagline | Play smarter. Track everything. |
| Languages | French + English (i18n from day 1) |
| Platforms | iOS (primary), Android |
| Tech | React Native + Expo |

---

## Feature Roadmap

### V1 — Mock (current build)

Priority order reflects the brief:

| # | Feature | Status |
|---|---|---|
| 1 | Dashboard / Home | **In scope** |
| 2 | Results Tracker (Tournament + Cash Game + Staking) | **In scope** |
| 3 | Tournament Finder | **In scope** |
| 4 | Profile / Settings | **In scope** |
| 5 | Ruin Risk Calculator | Deferred |
| 6 | Degen Hub (3 mini-games) | Deferred — no tab; was tried as a placeholder 5th tab during the redesign, then removed to match the handoff's 4-tab bar exactly |
| 7 | Virality Engine (Flex Cards, Hand Replayer) | Deferred |
| 8 | GTO Quiz & Gamification | V2 |

Tournament Finder and Profile were originally scoped as deferred but were built out during the
"Frosted Glass" redesign (2026-07-01) — see `DECISIONS.md` DS-005/DS-006 and the updated specs below.

---

## Feature Specs

### 1. Dashboard / Home

The bento-grid overview screen. Gives the player a complete at-a-glance view of their poker life.
Layout as of the "Frosted Glass" redesign (`app/(tabs)/index.tsx`):

**Cards / widgets on the dashboard, top to bottom:**
- Header: "Dashboard" title + avatar (initials)
- **Profit hero** (charcoal card): net poker profit (all-time), month-over-month delta chip, sparkline off `bankrollHistory`
- **Gauges row**: ROI (90 days) and ITM % (90 days) donut gauges
- **Volume card**: hours played this month, split by week (bar chart)
- **Évolution card**: 30-day profit curve
- **Prochains tournois**: one pinned "Coup de cœur" featured tournament + up to 2 plain upcoming rows, drawn from `tournaments` with a `startDate`

**UX principles:**
- Cards are interactive — tap to drill into the detail screen
- Animated number counters and gauge/chart sweep-in on load
- Positive/negative states use the single accent color (green) for positive, red for negative — no third color

The previous 2×2 metric grid + single sponsored-tournament card + last-session card layout was
replaced wholesale by the above during the redesign.

---

### 2. Results Tracker (Sessions)

**2a. Tournament session**

Fields: festival, tournament (buy-in inferred from the tournament catalog when an existing one is
picked, editable-with-presets otherwise), re-entries, optional backing (multi-backer % split, with
or without buy-in contribution), result (Éliminé / ITM — see the "ITM, not Cashé" copy note below),
cash-out + position (when ITM), duration.

**2b. Cash session**

Fields: venue (searchable/creatable, shares the Festival picker's field component), game type
(NLH/PLO), stakes (1/2, 2/5, 5/10, 10/20 chips), buy-in, optional backing, cash-out, duration.

**2c. Staking** — backing *another* player (a separate `Stake` record, not a `Session`): player
(searchable/creatable), optional festival/tournament, mise (buy-in share), percentage, status
(En attente / Éliminé / ITM) with their cash-out and computed return once settled.

All three are entered through a single adaptive **Add-session sheet**
(`src/components/tracker/AddSessionSheet.tsx`) with a Tournoi/Cash/Staking segmented control —
not a multi-step wizard. Live "Résultat net" recomputes on every field change.

**Computed statistics (auto-generated, `src/lib/stats.ts` + `useAppStore`):**
- Net profit — all-time and windowed (e.g. 90 days, used by the Dashboard gauges and the Sessions
  summary strip)
- ROI %, hourly rate, ITM % (tournaments), biggest win/loss
- Weekly volume buckets (Dashboard "Volume" card)
- Bankroll history (running total, used by the profit-curve charts)
- All money math is backing-aware (`sessionNetValues` nets out backer shares before computing your profit/invested)

**Session list view** (`app/(tabs)/tracker.tsx`): grouped by month, single-select filter chips
(Tout/Tournoi/Cash/Staking), each row shows a type icon tile, `"<name> · <type>"` title,
`"<venue> · <detail>"` subtitle, and the amount (accent if ≥0, red if <0). Detail modals use "ITM"
rather than "Cashé" for the result label.

---

### 3. Tournament Finder

Search + filterable list of the tournament catalog (`tournaments` in the store, currently mocked
in `src/data/mock.ts`). Filters: buy-in range, country, organizer, festival (single-select chip
groups in a bottom sheet). A tournament can optionally carry `startDate`, `guaranteed` (prize pool),
and `featured` — when `featured` is set and no filter/search is active, it's pinned as a "Coup de
cœur" card above the rest of the list. There is no scoring/ranking concept (an early spec draft
proposed one; it was never implemented and the "no score" note in the 2026-07-01 redesign handoff
just confirms that). Tapping a tournament opens its detail (buy-in, player count, your session
history against it) with an "Ajouter une session" CTA that opens the Add-session sheet pre-seeded
with that tournament.

---

### 4. Profile

Identity card (avatar + name), stats strip (ROI, total sessions, total volume), and a Réglages list:
Devise (display-only), Langue (tap to toggle fr/en — updates both the store and `i18next`),
Notifications (toggle, persisted), Thème (static "Clair" — no dark mode exists), and a relocated
"reset persisted data" debug action.

---

### 5. Ruin Risk Calculator (Deferred)

Inputs:
- Total bankroll (€/$)
- Average buy-in (ABI)
- Estimated ROI %

Outputs:
- Ruin risk % (formula: Kelly criterion / Monte Carlo approximation)
- Recommended max buy-in for "safe" play
- Visual gauge showing risk level (green / orange / red)

---

### 6. Degen Hub — 3 Mini-Games (Deferred)

**5a. Cards Roulette**
- Input: list of player names at the table
- Animated spinning wheel
- Output: one player designated to pay the bill

**5b. The Flash (Flip)**
- Select: Hold'em or Omaha
- Input: player names (2–6)
- Animated card dealing: hole cards + board
- Lowest hand pays

**5c. Last Longer**
- Create a Last Longer bet: entry fee, players
- Track eliminations as they happen (manual tap "X is out")
- Auto-calculate payout to last survivor

---

### 7. Virality Engine (Deferred)

**6a. Flex Cards**
- After logging a session, offer "Share this result"
- Generates a Story-format visual: profit, curve, venue, Proker logo
- Export as image to camera roll / share sheet

**6b. Hand Replayer**
- Input: pre-flop cards, board (flop/turn/river), actions
- Visual output: clean hand history card
- Export as image

---

## Navigation Architecture

**Tab bar (bottom, floating pill):**

| Tab | Icon | Screen |
|---|---|---|
| Home | Dashboard icon | Dashboard / bento overview |
| Track | Chart icon | Session list |
| Finder | Map/search icon | Tournament finder |
| Profile | Person icon | Profile + settings |

Plus a white circular **FAB** rendered as the trailing item inside the same floating pill (not a
separate tab/route) — opens the Add-session sheet from any tab.

**Navigation rules:**
- Tab bar (and its FAB) always visible (no hiding on scroll for key screens)
- Add session: bottom sheet (slides up) from any screen, via the tab bar's FAB
- Tournament detail: push navigation
- Flex Card generation: full-screen modal

---

## Data Models (V1 JSON)

Source of truth: `apps/mobile/src/types/index.ts`. This section mirrors it (condensed) rather than
the earlier, no-longer-accurate draft this doc originally shipped with (no `bankroll` field on
`User`, no tournament `score`/`casino`/`city` fields — those were never implemented).

```typescript
interface User {
  id: string;
  name: string;
  avatar?: string;
  createdAt: string; // ISO date
  settings: { language: 'fr' | 'en'; currency: 'EUR' | 'USD' | 'GBP'; notifications: boolean };
}

interface Player { id: string; name: string; notes?: string; }
interface Country { id: string; name: string; code: string; }
interface Organizer { id: string; name: string; }
interface Festival { id: string; name: string; location?: string; countryId?: string; organizerId?: string; }

interface Tournament {
  id: string;
  festivalId: string;
  name: string;
  buyIn: number;
  totalPlayers?: number;
  startDate?: string;   // ISO date, when known — powers Dashboard "Prochains tournois"
  guaranteed?: number;  // guaranteed prize pool
  featured?: boolean;   // "Coup de cœur" pin (Dashboard + Finder)
}

// Backing: another player's cut of YOUR session (multi-backer split supported)
interface Backing { playerId: string; profitShare: number; buyInShare: number; }

interface BaseSession {
  id: string; type: 'tournament' | 'cash'; date: string; venue: string;
  buyIn: number; cashOut: number; durationHours: number;
  backings?: Backing[]; notes?: string; createdAt: string;
}
interface TournamentSession extends BaseSession {
  type: 'tournament'; tournamentId: string; reEntries: number; cashed: boolean; position?: number;
}
interface CashSession extends BaseSession {
  type: 'cash'; gameType: 'NLH' | 'PLO' | 'other'; stakes: string; // e.g. "2/5"
}
type Session = TournamentSession | CashSession;

// Staking: YOU backing another player — a separate top-level record, not a Session
interface Stake {
  id: string; date: string; playerId: string; festivalId?: string; tournamentId?: string;
  buyIn: number; percentage: number; settled: boolean; cashed?: boolean; theirCashout?: number;
  notes?: string; createdAt: string;
}

interface BankrollSnapshot { date: string; amount: number; }

interface ComputedStats {
  totalProfit: number; totalInvested: number; roi: number; hourlyRate: number;
  totalSessions: number; totalHours: number; biggestWin: number; biggestLoss: number;
  itmRate: number; thisMonthProfit: number; thisMonthSessions: number;
}
```

`src/lib/stats.ts` also exposes `computeWindowedStats(sessions, stakes, windowDays)` (same shape as
`ComputedStats`, restricted to a rolling window — e.g. 90 days for the Dashboard gauges) and
`computeWeeklyVolume(sessions, monthKey)` for the Dashboard's weekly volume bars. Neither is stored
in Zustand state; both are pure functions memoized at the call site.

### App Store (Zustand + MMKV — `src/store/useAppStore.ts`)

```typescript
interface AppStore {
  user: User;
  sessions: Session[];
  stakes: Stake[];
  bankrollHistory: BankrollSnapshot[]; // derived, not persisted
  stats: ComputedStats;                 // derived, not persisted
  festivals: Festival[];
  tournaments: Tournament[];
  players: Player[];
  countries: Country[];
  organizers: Organizer[];
}
```

---

## i18n Strategy

- Library: `i18next` + `react-i18next` + `expo-localization`
- Translation files: `src/i18n/fr.json` and `src/i18n/en.json`
- Auto-detect device language on first launch
- User can override in settings
- All user-facing strings go through translation keys (no hardcoded strings)
- Currency formatting uses `Intl.NumberFormat` respecting user's locale

---

## AI Integration (Development tooling, not in-app for V1)

Claude is used as a development partner, not an in-app feature in V1. This means:
- Architecture decisions documented collaboratively
- Data models reviewed by Claude
- Component design system generated with Claude guidance
- Mock data generated by Claude
- All spec and design decisions tracked in `docs/`
