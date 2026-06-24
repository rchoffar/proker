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

## ADR-009 — Fonts: Inter via @expo-google-fonts

**Date:** 2026-06-24
**Status:** Decided

**Decision:** Inter font family loaded via `@expo-google-fonts/inter`.

**Why:**
- Inter is designed for screens — excellent legibility at all sizes
- Tabular number variant (`Inter_400Regular_Italic` etc.) for financial data
- Expo Google Fonts handles loading and fallback gracefully

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

## Design Decisions

### DS-001 — Dark theme only in V1

One theme to build, one to perfect. Light theme deferred to V2.

### DS-002 — Gold (#FFD700) as primary accent, not neon green

Gold reads as premium, WSOP-trophy, status. More aligned with professional player identity than neon green which reads "crypto/gaming."

Green is reserved semantically for profit, red for loss. This keeps color meaning clear.

### DS-003 — Floating pill tab bar, not full-width

Full-width tab bars are Android-legacy. The floating pill reads modern, matches the glassmorphism card vocabulary, and gives the UI more spatial depth.

### DS-004 — Bento grid on Dashboard, list on detail screens

Dashboard = spatial, widget-based, scannable. Tracker / Finder = list, sortable, filterable. Different information architectures for different jobs-to-be-done.
