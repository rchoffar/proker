# Ultimate Poker Kit (UPK) — Product Specification

> Poker ecosystem app for professional players. All data is mocked locally in JSON for V1. External APIs and database integration deferred to later phases.

---

## App Identity

| Field | Value |
|---|---|
| Name | Ultimate Poker Kit (UPK) |
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
| 2 | Festivals (finder + detail, formerly "Tournament Finder") | **In scope — now the primary feature** |
| 3 | Planning / Calendar | **In scope** |
| 4 | Degen Hub (4 mini-games, placeholder) | **In scope as a placeholder tab** — game logic deferred |
| 5 | Results Tracker (Tournament + Cash Game + Staking) | **In scope — demoted to secondary** |
| 6 | Profile / Settings | **In scope** |
| 7 | Ruin Risk Calculator | Deferred |
| 8 | Virality Engine (Flex Cards, Hand Replayer) | Deferred |
| 9 | GTO Quiz & Gamification | V2 |

Tournament Finder and Profile were originally scoped as deferred but were built out during the
"Frosted Glass" redesign (2026-07-01) — see `DECISIONS.md` DS-005/DS-006 and the updated specs below.

**2026-07-02 — Festival-first pivot:** the Results Tracker was the de facto primary feature; it's
now secondary. The primary feature is discovering and following a personal **festival** calendar —
festivals (multi-day events) are the browsable entity, tournaments are only reached by drilling into
a festival. See ADR-012/DS-007 in `DECISIONS.md` for the full reasoning and what changed.

---

## Feature Specs

### 1. Dashboard / Home

Festival-discovery-first overview (`app/(tabs)/index.tsx`), as of the 2026-07-02 festival-first
pivot. The stats-heavy bento layout from the "Frosted Glass" redesign moved to Profile (§4) — the
Dashboard's job is now "what festival am I following, what's next, what else is out there."

**Sections, top to bottom:**
- Header: "Dashboard" title + avatar (initials)
- **Festival hero**: the liked festival currently in progress (today falls within
  `[startDate, endDate]`), or failing that the most-recently-liked one (last element of
  `likedFestivalIds` — the array is append-only on like, see §"App Store" below). Shows name,
  location/organizer, date range, a like toggle, a primary CTA to the festival detail screen, and a
  secondary CTA that opens the Add-session sheet pre-scoped to that festival (no tournament chosen
  yet). Empty state (no liked festivals) invites the user to browse Festivals instead
- **Vos festivals à venir**: liked festivals with a future `startDate`, excluding the hero one,
  compact rows (`FestivalCard variant="mini"`) — hidden entirely if empty
- **Découvrir**: up to 5 upcoming festivals the user hasn't liked yet, sorted by date, same compact
  card, like-heart as the primary affordance; a "Voir tous les festivals →" link to the Festivals tab
- **Mes sessions** card (bottom, deliberately low-priority): compact row (icon + session count +
  chevron) that pushes the Tracker screen (`app/tracker.tsx`)

**UX principles:**
- Cards are interactive — tap to drill into festival detail; the heart toggles a like in place
- Animated entrance stagger (`FadeInDown`, ~60ms per section), unchanged from the prior redesign
- Positive/negative states use the single accent color (green) for positive, red for negative — no third color

The previous stats bento (profit hero, ROI/ITM gauges, volume, evolution, "Prochains tournois") was
relocated to Profile — see §4.

---

### 2. Results Tracker (Sessions) — secondary feature

Since the 2026-07-02 pivot, the Tracker is no longer a tab. It lives at `app/tracker.tsx` (a pushed
Stack route, outside the `(tabs)` group, with its own back-chevron header) and is reached from the
Dashboard's "Mes sessions" card, the bottom-most card on the Dashboard by design (see §1). Its
internal behavior (editing an existing session, filters, month grouping) is otherwise identical to
before the pivot.

**No global FAB anymore** (removed 2026-07-02, see `DECISIONS.md` DS-007 addendum) — a new session
is now always started from a specific context: a tournament's "Ajouter une session" CTA
(`TournamentDetailModal`, reachable from Festivals, Festival detail, or Planning) or a liked
festival's "Enregistrer un résultat" CTA (Dashboard hero). There is currently **no entry point for a
fully ad-hoc session** (e.g. a cash game with no festival) — flagged as an open gap, not yet
resolved.

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

### 3. Festivals (formerly "Tournament Finder") — primary feature

Search + filterable list of **festivals** (`festivals` in the store, mocked in `src/data/mock.ts`),
not tournaments — tournaments are only reached by drilling into a festival. Screen:
`app/(tabs)/festivals.tsx`; detail: `app/festival/[id].tsx` (pushed route, not a sheet, since it has
several rich sections and its own drill-down into tournament detail).

**Filters** (`FestivalFilterSheet`, a bottom sheet): continent, country, and buy-in range are
**multi-select** checkbox chip groups (`MultiFilterChipGroup`) — picking several countries or buy-in
bands ORs within a dimension and ANDs across dimensions. Country options narrow to the selected
continent(s). Organizer stayed **single-select** (one organizer per festival today, low value in
letting users pick several). `Country` gained a `continent` field to power the continent filter.
A festival matches a buy-in range if *any* of its tournaments falls in that range.

**Festival card** (`FestivalCard`, `full`/`mini` variants): name, location, date badge, buy-in
range + tournament count, a like-heart (`LikeButton`) that toggles `likedFestivalIds`.

**Festival detail**: date range, an info card, derived stats (smallest/largest buy-in tournament in
the festival, tournament count — computed on the fly, not stored), a **Main Event** card when one
tournament has `isMainEvent: true` — buy-in plus its full blind structure
(`BlindStructureTable`: starting stack, level duration, and a level-by-level SB/BB/ante/duration
table), and the full tournament list with a like-heart per tournament
(`likedTournamentIds`). Tapping any tournament (main event or list) opens the existing
`TournamentDetailModal` unchanged, with its "Ajouter une session" CTA pre-seeding the Add-session
sheet.

There is no scoring/ranking concept for either festivals or tournaments (an early spec draft
proposed one for tournaments; never implemented).

---

### 4. Planning / Calendar

New tab (`app/(tabs)/planning.tsx`), custom month-grid calendar (`MonthCalendar`, no third-party
calendar library — see ADR-012) plotting both liked festivals (start date, and end date when
different) and liked tournaments on their dates. Prev/next month paging, tap-to-select a day to
list just that day's items below the grid, or the whole visible month's items when nothing is
selected. Tapping a festival marker pushes the festival detail screen; tapping a tournament marker
opens `TournamentDetailModal` locally (no navigation away, since Planning already has the data it
needs and this avoids stacking a 3rd sheet level).

---

### 5. Profile

Identity card (avatar + name) unchanged. Below it, the stats bento that used to open the Dashboard
now lives here: profit hero (all-time net profit, month delta, 14-day sparkline), ROI/ITM (90-day)
gauges, monthly volume bar chart, 30-day evolution curve. The old flat ROI/Sessions/Volume stat
strip was removed as redundant once the richer blocks were added (it repeated ROI and added little).
Réglages list unchanged: Devise (display-only), Langue (tap to toggle fr/en — updates both the store
and `i18next`), Notifications (toggle, persisted), Thème (tap to toggle light/dark via
`useTheme().toggleScheme` — dark mode exists app-wide, contrary to an earlier draft of this doc),
and "Réinitialiser les données" (destructive, confirmation alert).

---

### 6. Ruin Risk Calculator (Deferred)

Inputs:
- Total bankroll (€/$)
- Average buy-in (ABI)
- Estimated ROI %

Outputs:
- Ruin risk % (formula: Kelly criterion / Monte Carlo approximation)
- Recommended max buy-in for "safe" play
- Visual gauge showing risk level (green / orange / red)

---

### 7. Degen Hub — 4 Mini-Games (placeholder tab, game logic deferred)

New tab (`app/(tabs)/degen.tsx`) shipped as a 2×2 grid of non-interactive `GameTile` cards, each with
a "Bientôt disponible" `Pill` badge — no game logic implemented yet, just the nav slot and visual
placeholder. The 3 originally-specced games were expanded to 4 per a later product decision:

**7a. Flip**
- Select: Hold'em or Omaha
- Input: player names (2–6)
- Animated card dealing: hole cards + board
- Lowest hand pays

**7b. Bluff**
- Bluff-or-fold mini-game between players at the table (mechanics TBD)

**7c. Roulette**
- Input: list of player names at the table
- Animated spinning wheel
- Output: one player designated to pay the bill

**7d. The Last Longer**
- Create a Last Longer bet: entry fee, players
- Track eliminations as they happen (manual tap "X is out")
- Auto-calculate payout to last survivor

---

### 8. Virality Engine (Deferred)

**8a. Flex Cards**
- After logging a session, offer "Share this result"
- Generates a Story-format visual: profit, curve, venue, UPK logo
- Export as image to camera roll / share sheet

**8b. Hand Replayer**
- Input: pre-flop cards, board (flop/turn/river), actions
- Visual output: clean hand history card
- Export as image

---

## Navigation Architecture

**Tab bar (bottom, floating pill), as of the 2026-07-02 festival-first pivot:**

| Tab | Icon | Screen |
|---|---|---|
| Dashboard | Dashboard icon | Festival-discovery overview |
| Festivals | Search icon | Festival list + filters |
| Planning | Calendar icon | Liked festivals/tournaments on a calendar |
| Degen Hub | Dice icon | 4 placeholder mini-game tiles |
| Profile | Person icon | Stats + settings |

The global **FAB** that used to sit inside the tab bar pill was removed (2026-07-02, see
`DECISIONS.md` DS-007 addendum) — the tab bar is now icon-only, no trailing action button.

**Pushed (non-tab) routes:**

| Route | From | Notes |
|---|---|---|
| `app/tracker.tsx` | Dashboard "Mes sessions" card | Sessions list; own back-chevron header since it's no longer a tab root |
| `app/festival/[id].tsx` | Festivals list, Dashboard festival cards, Planning markers | Festival detail — dates, derived stats, Main Event + blind structure, tournament list |

**Navigation rules:**
- Tab bar always visible (no hiding on scroll for key screens); no FAB anymore
- Add session: bottom sheet (slides up), opened only from a specific context — the Dashboard
  festival hero's secondary CTA, or a tournament detail's CTA — not from a global button
- Festival detail: push navigation. Tournament detail: bottom sheet (`TournamentDetailModal`),
  opened from Festivals, Festival detail, Planning, or the Dashboard
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

type Continent = 'Europe' | 'North America' | 'South America' | 'Asia' | 'Africa' | 'Oceania';
interface Country { id: string; name: string; code: string; continent: Continent; }
interface Organizer { id: string; name: string; }

interface Festival {
  id: string; name: string; location?: string; countryId?: string; organizerId?: string;
  startDate?: string; // ISO date, festival start
  endDate?: string;   // ISO date, festival end
}

interface BlindLevel {
  level: number; smallBlind: number; bigBlind: number; ante: number; durationMinutes: number;
}
interface BlindStructure {
  startingStack: number;
  levelDurationMinutes: number; // display/typical value, not authoritative — see per-level durationMinutes
  levels: BlindLevel[];
}

interface Tournament {
  id: string;
  festivalId: string;
  name: string;
  buyIn: number;
  totalPlayers?: number;
  startDate?: string;   // ISO date, when known
  guaranteed?: number;  // guaranteed prize pool
  featured?: boolean;   // "Coup de cœur" pin (used by `TournamentDetailModal` callers)
  isMainEvent?: boolean;        // explicit flag — the festival's flagship event
  blindStructure?: BlindStructure; // populated for main-event tournaments only
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
`ComputedStats`, restricted to a rolling window — e.g. 90 days for the Profile gauges) and
`computeWeeklyVolume(sessions, monthKey)` for the Profile's weekly volume bars (both moved from the
Dashboard in the 2026-07-02 pivot). Neither is stored in Zustand state; both are pure functions
memoized at the call site.

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
  likedFestivalIds: string[];    // append-only on like; last element = most recently liked
  likedTournamentIds: string[];
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
