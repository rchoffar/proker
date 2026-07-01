# Proker — Architecture Decision Records

> Decisions made during collaborative build sessions. Each ADR captures what was decided, why, and what was ruled out.

---

## ADR-001 — Mobile Framework: Expo SDK + Expo Router

**Date:** 2026-06-24
**Status:** Decided

**Decision:** Use Expo SDK 52 with Expo Router v4 (file-based routing).

**Why:**
- Expo Router gives file-system-based routing (like Next.js) — screens map directly to files, navigation is predictable
- Expo SDK handles all native module setup (camera roll, blur, fonts, storage) without bare React Native config overhead
- Faster iteration: Expo Go / dev build for instant reload
- EAS Build for production — both iOS and Android from one codebase

**Ruled out:**
- Bare React Native: more control but significant setup overhead for no V1 benefit
- React Native CLI only: no file-based routing, more manual navigation wiring

---

## ADR-002 — Styling: NativeWind v4 + Custom Design Tokens

**Date:** 2026-06-24
**Status:** Decided

**Decision:** Use NativeWind v4 (Tailwind CSS for React Native) as the utility layer, with a custom `theme.ts` file for all Proker design tokens.

**Why:**
- NativeWind v4 is built for Expo and uses the new React Native StyleSheet under the hood — production-safe
- Tailwind utility classes make component development fast and readable
- Custom design tokens (`proker-gold`, `proker-glass`, etc.) extend Tailwind config
- Glassmorphism effects (blur) handled separately via `expo-blur` BlurView — NativeWind controls layout, expo-blur controls the glass effect

**Ruled out:**
- Tamagui: powerful but heavy config, adds complexity
- Unistyles v2: excellent theming but less community support for Expo
- Plain StyleSheet only: verbose, no theming utility

---

## ADR-003 — Animations: Reanimated 3 + Moti

**Date:** 2026-06-24
**Status:** Decided

**Decision:** React Native Reanimated 3 as the core animation engine, Moti as the declarative layer on top.

**Why:**
- Reanimated 3 runs animations on the UI thread — 60/120fps on device, never janks
- Moti provides a declarative API (`animate`, `from`, `transition`) that maps to Reanimated under the hood — much less boilerplate for standard animations
- For complex gestures (swipe-to-delete, drag) we use Reanimated directly with `useAnimatedGestureHandler`
- Number counter animations: custom hook using Reanimated `useSharedValue` + `withTiming`

**Ruled out:**
- React Native Animated (built-in): runs on JS thread by default, can cause drops on heavy UIs
- Lottie: good for icon/illustration animations but too heavy for UI-wide animations
- Framer Motion: web only

---

## ADR-004 — Charts: Victory Native XL

**Date:** 2026-06-24
**Status:** Decided

**Decision:** Victory Native XL for all data visualizations.

**Why:**
- Built on react-native-skia — uses GPU, silky smooth animations
- Supports area, bar, line, candlestick, scatter out of the box
- Fully customizable: colors, gradients, labels, grid
- Dark theme friendly — full control over every visual element
- Active maintenance (NativeWind/Shopify ecosystem)

**Ruled out:**
- React Native Charts Kit: older, SVG-based, less performant, limited customization
- Gifted Charts: good but less control over animation quality
- Victory Native (classic, non-XL): older SVG version, less smooth
- Building from scratch with react-native-skia: maximum control but weeks of work

---

## ADR-005 — State Management: Zustand

**Date:** 2026-06-24
**Status:** Decided

**Decision:** Zustand for global state management.

**Why:**
- Zero boilerplate compared to Redux — a store is just a hook
- Perfect for this app's data shape: one root store with user, sessions, settings
- Supports slices (separate stores that can be combined)
- DevTools available via Zustand middleware

**Ruled out:**
- Redux Toolkit: good but overkill for this app's state complexity
- React Context + useReducer: fine for small state but becomes messy as the app grows
- Jotai: excellent but more fragmented; Zustand's single-store model maps better to this app

---

## ADR-006 — Local Storage: MMKV (via react-native-mmkv)

**Date:** 2026-06-24
**Status:** Decided

**Decision:** react-native-mmkv for persisting the app store to disk.

**Why:**
- MMKV is 10–30x faster than AsyncStorage (used by Meta in production)
- Synchronous reads — no async/await waterfall on app boot
- Works with Zustand via a persistence middleware adapter
- Compatible with Expo custom dev builds

**Ruled out:**
- AsyncStorage: slow, async-only, not encrypted
- expo-sqlite: good for relational data but overkill for V1 flat JSON — easy to migrate to later
- expo-file-system + JSON: manual, error-prone

---

## ADR-007 — Internationalization: i18next + react-i18next + expo-localization

**Date:** 2026-06-24
**Status:** Decided

**Decision:** i18next ecosystem for French + English support from day 1.

**Why:**
- i18next is the industry standard, with plural forms, interpolation, namespaces
- react-i18next hooks (`useTranslation`) make it ergonomic in components
- expo-localization detects device locale on first launch
- Currency formatting: `Intl.NumberFormat` (built into JS runtime) — respects locale for separators

**Translation key convention:**
```
screen.component.element
// e.g.:
dashboard.metrics.bankroll_label = "Bankroll"
tracker.session.buy_in_label = "Buy-in"
```

---

## ADR-008 — Icons: Lucide React Native

**Date:** 2026-06-24
**Status:** Decided

**Decision:** Lucide React Native for all icons.

**Why:**
- Clean, consistent, 1.5px stroke weight (matches the minimal aesthetic)
- 1000+ icons, all in one package
- Tree-shakeable — only imported icons are bundled
- Easy to tint with color prop

**Ruled out:**
- Expo Vector Icons (Ionicons/MaterialIcons): less consistent style, heavier
- Custom SVG icons: extra work for no design differentiation in V1

---

## ADR-009 — Fonts: Jost + Geist via @expo-google-fonts

**Date:** 2026-06-24 (superseded 2026-07-01)
**Status:** Decided (revised)

**Original decision:** Inter font family loaded via `@expo-google-fonts/inter`.

**Revised decision:** Jost 300 (thin, display titles only) + Geist 400–800 (everything else),
loaded via `@expo-google-fonts/jost` and `@expo-google-fonts/geist`.

**Why the change:**
- The "Frosted Glass" redesign (see DS-005/DS-006) calls for a distinct, elegant thin display face
  for screen/sheet titles, paired with a cleaner grotesque for body/numbers — Inter alone didn't
  give enough typographic contrast for the new hierarchy
- Both font packages are on the same `@expo-google-fonts/*` distribution as Inter was, so the
  loading mechanism (`useFonts` in `app/_layout.tsx`) is unchanged, just the font families passed to it
- Geist's tabular figures work the same way Inter's did for financial data

---

## ADR-010 — Data Strategy: Local JSON → MMKV, No Backend in V1

**Date:** 2026-06-24
**Status:** Decided

**Decision:** All user data stored locally. Mock tournament/finder data in static JSON files.

**Why:**
- No backend = no auth, no API keys, no latency, no cost in V1
- Fast to iterate on data models — just edit the JSON
- Migration path is clear: when we add a backend, Zustand store structure stays the same, only the persistence layer changes (MMKV → API calls)

**Mock data files:**
- `src/data/mock-tournaments.json` — ~50 tournament entries
- `src/data/mock-sessions.json` — ~30 historical sessions for demo
- `src/data/mock-user.json` — default user profile

---

## ADR-011 — Bottom sheets: custom `BottomSheet` primitive, not a third-party library

**Date:** 2026-07-01
**Status:** Decided

**Decision:** Build a small custom `BottomSheet` component (`src/components/ui/BottomSheet.tsx`)
using RN's `Modal` (`transparent`, `animationType="none"`) plus Reanimated-driven
`translateY`/backdrop-opacity animation, rather than adopting `@gorhom/bottom-sheet` or a similar
library. No gesture-handler pan-to-dismiss — only tap-backdrop / tap-✕ dismissal, per the design
spec's actual interaction requirements.

**Why:**
- The design spec's sheet requirements (380ms slide, 200ms backdrop fade, tap-to-dismiss, adaptive
  height via inner scroll) are fully satisfiable without a gesture-driven drag handle
- The codebase already used plain `Modal` for every sheet/detail-view before this redesign
  (`AddSessionModal`, `FilterSheet`, `TournamentDetailModal` all did) — a custom primitive keeps
  that convention and avoids a new dependency for a "nice to have" (drag-to-dismiss) that wasn't
  actually requested
- `react-native-reanimated` (ADR-003) and `expo-blur` (already used by `GlassCard`) are the only
  dependencies needed; `react-native-gesture-handler` is already installed for tab/list gestures
  elsewhere but isn't pulled into this component
- Pan-to-dismiss is a documented, low-risk follow-up (`// TODO(pan-to-dismiss)` in the component)
  if ever wanted — the primitive already centralizes the `translateY` shared value a gesture would
  drive

**Ruled out:**
- `@gorhom/bottom-sheet`: full-featured (snap points, gesture handling, keyboard avoidance) but a
  new dependency for functionality the design doesn't call for
- Keeping the old per-screen `Modal` + `BlurView` boilerplate duplicated across `AddSessionSheet`
  and `FilterSheet`: would have meant re-implementing the same slide/fade timing twice

---

## Design Decisions

### DS-001 — Dark theme only in V1 *(superseded by DS-005, 2026-07-01)*

~~One theme to build, one to perfect. Light theme deferred to V2.~~ Superseded by a full redesign
to a light "Frosted Glass" system — see DS-005.

### DS-002 — Gold (#FFD700) as primary accent, not neon green *(superseded by DS-006, 2026-07-01)*

~~Gold reads as premium, WSOP-trophy, status. More aligned with professional player identity than
neon green which reads "crypto/gaming."~~ Superseded — see DS-006. The "green reserved for
profit, red for loss" principle carries forward unchanged; only the *primary/CTA* accent moved
from gold to emerald.

### DS-005 — Light "Frosted Glass" theme, not dark

**Date:** 2026-07-01

A design handoff (external, `design_handoff_proker_glass` package) specified a full visual/UX
redesign: a bright, layered-gradient environment with frosted-glass cards, replacing the deep-black
canvas from DS-001. Implemented across every screen (`docs/DESIGN_SYSTEM.md` §2–3). Dark surfaces
still exist (charcoal `GlassCard` `variant="dark"`) but only as a *rhythm* device against the light
background, not as the app's base theme.

**Why:** User-directed redesign to match the provided handoff. The bento-grid / floating-pill-nav /
data-first-typography principles from the original design philosophy carry forward unchanged —
only the light/dark polarity and the color language (DS-006) changed.

### DS-006 — Single emerald accent (#0E9E62 / #17E58A), not gold

Replaces DS-002. The redesign's rule is stricter than before: there is now exactly **one**
chromatic color in the whole app — emerald green — reserved for money, positive results, and
primary actions/CTAs. Loss is red, everything else is neutral ink-grey. This meant removing every
other incidental brand color found in the pre-redesign code (gold `#FFD700`, an indigo `#6366F1`
used for the Staking row/pill, and a 3-color buy-in-tier coding in the Tournament Finder) in favor
of neutral treatments, per the "near-monochrome" principle.

### DS-003 — Floating pill tab bar, not full-width

Full-width tab bars are Android-legacy. The floating pill reads modern, matches the glassmorphism card vocabulary, and gives the UI more spatial depth.

### DS-004 — Bento grid on Dashboard, list on detail screens

Dashboard = spatial, widget-based, scannable. Tracker / Finder = list, sortable, filterable. Different information architectures for different jobs-to-be-done.
