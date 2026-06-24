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
| 2 | Results Tracker (Tournament + Cash Game) | **In scope** |
| 3 | Tournament Finder | Deferred |
| 4 | Ruin Risk Calculator | Deferred |
| 5 | Degen Hub (3 mini-games) | Deferred |
| 6 | Virality Engine (Flex Cards, Hand Replayer) | Deferred |
| 7 | GTO Quiz & Gamification | V2 |

---

## Feature Specs

### 1. Dashboard / Home

The bento-grid overview screen. Gives the player a complete at-a-glance view of their poker life.

**Cards / widgets on the dashboard:**
- Total bankroll (current)
- Net profit (this month / all time toggle)
- ROI (this month / all time)
- Hourly rate
- Sessions played (this month)
- Last session recap (venue, result, duration)
- Performance chart (last 30 days, profit curve)
- Quick action buttons: Log Session, Find Tournament, Open Degen Hub

**UX principles:**
- Cards are interactive — tap to drill into the detail screen
- Animated number counters on load
- Pull-to-refresh animation
- Positive/negative states have distinct visual treatments (gold for profits, red for losses)

---

### 2. Results Tracker

**2a. Tournament Tracker**

Fields per session entry:
- Tournament name / venue
- Date
- Buy-in amount
- Number of re-entries (default: 0)
- Result: Cashed / Did not cash
- Cash-out amount (if cashed)
- Duration (hours)
- Notes (optional, free text)
- Position (optional)
- Total players (optional, for ITM% calculation)

**2b. Cash Game Tracker**

Fields per session entry:
- Venue / location
- Date
- Game type: NLH / PLO / Other
- Stakes (e.g. 2/5, 5/10)
- Buy-in amount
- Cash-out amount
- Duration (hours)
- Notes (optional)

**Computed statistics (auto-generated):**
- Net profit (all time + per period)
- ROI % = ((Cash-out - Total invested) / Total invested) × 100
- Hourly rate = Net profit / Total hours
- Total sessions played
- ITM % (in-the-money rate) for tournaments
- Biggest win / worst loss
- Average buy-in
- Performance by venue
- Performance by game type (cash vs tournament)
- Monthly P&L chart

**Session list view:**
- Chronological list with filters (type, venue, date range)
- Each row: date, venue, game type, result (+ or -), profit/loss amount
- Color-coded: green for positive, red for negative

---

### 3. Tournament Finder (Deferred — Spec for future)

- World tournament database (mocked JSON with ~50 tournaments)
- Filters: country, city, date range, buy-in range
- Algorithmic score (0–100): weighted avg of structure quality, rake %, venue prestige
- Detail page: tournament info, schedule, venue map, booking CTA (Travel affiliation)
- Sponsored slots displayed differently (labeled "Sponsored")

---

### 4. Ruin Risk Calculator (Deferred)

Inputs:
- Total bankroll (€/$)
- Average buy-in (ABI)
- Estimated ROI %

Outputs:
- Ruin risk % (formula: Kelly criterion / Monte Carlo approximation)
- Recommended max buy-in for "safe" play
- Visual gauge showing risk level (green / orange / red)

---

### 5. Degen Hub — 3 Mini-Games (Deferred)

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

### 6. Virality Engine (Deferred)

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
| Track | Chart icon | Session list + add session |
| Finder | Map/search icon | Tournament finder |
| Degen | Cards/dice icon | Degen Hub |
| Profile | Person icon | Profile + settings + bankroll |

**Navigation rules:**
- Tab bar always visible (no hiding on scroll for key screens)
- Add session: modal sheet (slides up) from any screen
- Tournament detail: push navigation
- Flex Card generation: full-screen modal

---

## Data Models (V1 JSON)

### User Profile

```typescript
interface User {
  id: string;
  name: string;
  avatar?: string;
  currency: 'EUR' | 'USD' | 'GBP';
  bankroll: number;
  createdAt: string; // ISO date
  settings: UserSettings;
}

interface UserSettings {
  language: 'fr' | 'en';
  theme: 'dark'; // dark only for now
  notifications: boolean;
}
```

### Session (Tournament or Cash Game)

```typescript
type SessionType = 'tournament' | 'cash';

interface BaseSession {
  id: string;
  type: SessionType;
  date: string; // ISO date
  venue: string;
  buyIn: number;
  cashOut: number;
  durationHours: number;
  notes?: string;
  createdAt: string;
}

interface TournamentSession extends BaseSession {
  type: 'tournament';
  tournamentName?: string;
  reEntries: number;
  totalInvested: number; // buyIn + (buyIn * reEntries)
  cashed: boolean;
  position?: number;
  totalPlayers?: number;
}

interface CashGameSession extends BaseSession {
  type: 'cash';
  gameType: 'NLH' | 'PLO' | 'other';
  stakes: string; // e.g. "2/5", "5/10"
}

type Session = TournamentSession | CashGameSession;
```

### Tournament (Finder — mocked)

```typescript
interface Tournament {
  id: string;
  name: string;
  casino: string;
  city: string;
  country: string;
  countryCode: string; // ISO 3166-1 alpha-2
  startDate: string;
  endDate: string;
  buyIn: number;
  currency: string;
  guaranteed?: number; // guaranteed prize pool
  score: number; // 0-100 algorithmic score
  scoreBreakdown: {
    structure: number; // 0-100
    rake: number; // 0-100 (inverted: lower rake = higher score)
    venue: number; // 0-100
  };
  tags: string[]; // e.g. ['deep stack', 'high roller', 'festival']
  sponsored: boolean;
  bookingUrl?: string;
  imageUrl?: string;
}
```

### Bankroll Snapshot (for chart)

```typescript
interface BankrollSnapshot {
  date: string; // ISO date
  amount: number;
}
```

### App Store (root JSON structure)

```typescript
interface AppStore {
  user: User;
  sessions: Session[];
  bankrollHistory: BankrollSnapshot[];
  tournaments: Tournament[]; // mocked data
  lastUpdated: string;
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
