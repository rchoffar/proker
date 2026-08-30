# UPK (ex-Proker) — Architecture Decision Records

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
**Status:** Partially superseded by ADR-013 (auth + users DB on the Fly API; tracker/festival data still local)

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

## ADR-012 — Planning calendar: custom `MonthCalendar`, not a third-party library

**Date:** 2026-07-02
**Status:** Decided

**Decision:** Build a small custom month-grid component (`src/components/planning/MonthCalendar.tsx`)
from plain `View`/`Text`/`TouchableOpacity` and the existing design tokens, rather than adding
`react-native-calendars` or a similar package for the new Planning tab.

**Why:**
- The feature surface is narrow: a 7-column month grid, up to a couple of dots per day (festival vs
  tournament markers), prev/next month paging, tap-to-select — well within a couple hundred lines
  against primitives already in the codebase
- A generic calendar library brings its own theming/marking API and usually its own date-formatting
  helpers, which would fight the app's existing hand-rolled `src/lib/format.ts` helpers rather than
  compose with them, and would need heavy prop overrides to match the glassmorphism visual language
- No swipe-gesture month transitions "for free" this way (tap-chevron paging only) — an accepted
  trade-off; `react-native-gesture-handler` is already installed if swipe paging is wanted later

**Ruled out:**
- `react-native-calendars`: full-featured (week/agenda views, marking strategies) but a new
  dependency and a second date-formatting paradigm for a feature this small

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

Full-width tab bars are Android-legacy. The floating pill reads modern, matches the glassmorphism card vocabulary, and gives the UI more spatial depth. Now hosts 5 tabs (see DS-007) — the component was already generic over tab count, so this needed no rework.

### DS-004 — Bento grid on Dashboard, list on detail screens *(superseded by DS-007, 2026-07-02)*

~~Dashboard = spatial, widget-based, scannable. Tracker / Finder = list, sortable, filterable.~~
Superseded — see DS-007. The stats bento moved to Profile; the Dashboard is now a stack of
festival-discovery cards (still scannable, just not a grid). The underlying principle — different
information architectures for different jobs-to-be-done — carries forward.

### DS-007 — Festival-first pivot: Tracker demoted, Festivals/Planning/Degen Hub promoted

**Date:** 2026-07-02

**Decision:** The Results Tracker is no longer a tab (moved to a pushed route, `app/tracker.tsx`,
reachable from a Dashboard card, placed last/bottom-most on the Dashboard by design). The primary
browsable entity across the app becomes **Festival** (a multi-day event), not Tournament —
tournaments are only ever reached by drilling into a festival. Tab bar becomes Dashboard →
Festivals → Planning → Degen Hub → Profile. Users can like both festivals and tournaments
(`likedFestivalIds`/`likedTournamentIds`), which powers the new Dashboard and Planning screens.
Stats-heavy cards (profit hero, ROI/ITM gauges, volume, evolution) moved from Dashboard to Profile.
`Festival` gained `startDate`/`endDate`, `Country` gained `continent`, `Tournament` gained
`isMainEvent` + a full `blindStructure`. The Degen Hub placeholder tab — tried once during the
"Frosted Glass" redesign and dropped to match that handoff's 4-tab bar exactly (see the old DS-003
note, now removed) — is reinstated as a real 5th tab, expanded from 3 to 4 games (Flip, Bluff,
Roulette, The Last Longer), shipped as non-interactive "Bientôt disponible" tiles.

**Addendum (same date):** the tab bar's global **FAB** ("+" button, opened the Add-session sheet
from any screen) was also removed. Session creation is now always contextual — a tournament
detail's "Ajouter une session" CTA, or the Dashboard festival hero's "Enregistrer un résultat" CTA —
there is currently no ad-hoc/no-context entry point.

**Addendum 2 (same date) — `EnvironmentBackground` mounting:** the pushed routes
(`app/tracker.tsx`, `app/festival/[id].tsx`) initially rendered on a plain black background instead
of the app's gradient, because that component was only ever mounted inside `(tabs)/_layout.tsx`.
First fix: mounted it a second and third time, directly in each pushed screen. That introduced a
new problem — a visible flash every time either screen was opened, because each mount is a fresh
`react-native-skia` `Canvas` that has to compile its gradient shaders from scratch (the tabs'
long-lived instance never re-flashes because it's never remounted). Fix: mount
`EnvironmentBackground` exactly **once**, at the root (`app/_layout.tsx`, behind the root `Stack`,
above `(tabs)`), and removed it from `(tabs)/_layout.tsx`/`tracker.tsx`/`festival/[id].tsx`. This was
tried first and abandoned (see the removed "ruled out" note below) after appearing to render
washed-out — that was a misdiagnosis: the "washed-out" screenshot was this same shader-compile flash
caught mid-frame, not a real layering bug. Re-tested with a longer wait before capturing and the
root-mounted version renders identically to the per-screen version, with the added benefit that the
one-time shader compile now happens once at cold start instead of once per screen group.

**Addendum 3 (same date) — entrance-animation replay trick doesn't belong on pushed screens:**
after the flash above was fixed, a second, unrelated symptom remained — the entrance stagger
animation on `app/tracker.tsx` visibly restarted right after playing once. Root cause: `tracker.tsx`
was moved verbatim from `(tabs)/tracker.tsx` (see the main decision above), including its
`const [animKey, setAnimKey] = useState(0)` + `useFocusEffect(() => setAnimKey(k => k+1))` +
`<View key={animKey}>` combo. That pattern exists so a **tab** screen (mounted once, kept alive,
merely hidden/shown on tab switches) replays its `FadeInDown` stagger every time it regains focus —
necessary there because focus, not mount, is the only signal a tab switch gives you. `tracker.tsx`
is no longer a tab; it's a `Stack` route that fully mounts on every visit and unmounts on back. Its
initial mount already plays the entrance animation once — but `useFocusEffect` then fires almost
immediately after (a freshly pushed screen becomes focused right away), bumping `animKey` and
forcing every child to remount and replay from scratch, which reads as "starts, cuts off, restarts."
Fix: removed the `animKey`/`useFocusEffect` replay mechanism from `tracker.tsx` entirely — a plain
mount-time animation is correct for a screen that always mounts fresh. `app/festival/[id].tsx` never
had this pattern (built fresh, not copy-pasted from a tab screen) and isn't affected. The tab screens
(`app/(tabs)/index.tsx`, `festivals.tsx`, `planning.tsx`, `degen.tsx`, `profile.tsx`) keep the
pattern — it's correct there.

**Addendum 4 (same date, first attempt — later found wrong, kept for the record) — theorized
double-fire on return:** based on the "starts, cuts off, restarts" report, guessed that a tab
screen's parent Stack route ("(tabs)") blurring/refocusing when a sibling route (`tracker`,
`festival/[id]`) is pushed/popped might cause **two** `useFocusEffect` calls for one logical return.
Shipped a debounced replacement hook, `src/hooks/useFocusAnimKey.ts` (ignore a second focus firing
within 300ms), across all 5 tab screens. The user reported the issue was still present afterwards.

**Addendum 5 (same date) — instrumented and disproved Addendum 4; found and removed the real
cause:** rather than guess again, added timestamped `console.log` diagnostics (mount/unmount/focus/
blur, each tagged per screen) plus an automated navigation sequence (`setTimeout`-driven
`router.push`/tab switch, no manual taps needed) and read the results via
`xcrun simctl spawn <device> log stream` — React Native's `console.log` mirrors to the iOS system
log, which is capturable without a connected JS debugger. Two independent runs (Dashboard → push
`tracker` → back; Dashboard → switch to `festivals` tab → back) both showed **exactly one** focus
event and **exactly one** `animKey` bump on return — proving Addendum 4's premise false; there is no
duplicate-focus bug. A follow-up test temporarily changed the header's animation to a slow, linear
3-second fade and burst-captured screenshots (correlated to the log timestamps on the same clock) to
watch the return-replay in slow motion: it was a single, smooth, monotonic fade with no dip or reset
partway through. The `animKey` mechanism was completely exonerated.

That still left the original report unexplained by anything reproducible in a scripted test — until
the user clarified the repro was **switching tabs at normal speed**, not waiting seconds between
switches as every automated test had done. The actual mechanism: `animKey`'s `key={animKey}` remount
discards and restarts whatever entrance animation is currently in flight. With a comfortable pause
between visits (as in every one of the automated tests above) the previous play has long finished, so
the restart is invisible — there's nothing running to interrupt. Switch tabs quickly, before the
~400-600ms spring stagger has settled, and the in-progress animation is yanked out from under itself
and restarted, which is exactly "starts, cuts off, restarts." This isn't a coding error in the
`animKey` mechanism (proven clean above) — it's an inherent fragility of "replay the entrance
animation every time a tab regains focus," which by Addendum's 3 and 4's evidence had already caused
two other rounds of real, distinct bugs. First fix: removed the mechanism entirely — deleted
`src/hooks/useFocusAnimKey.ts`, dropped `key={animKey}` from all 5 tab screens, entrance stagger
plays once on first-ever mount and never again.

**Lesson (still holds):** don't theorize a second fix on top of an unverified first one. The
debounce in Addendum 4 was plausible-sounding but never checked against real navigation event logs;
instrumenting the actual app (tagged console logs surfaced via `simctl log stream`, no debugger
attach required) took one iteration to falsify it and find the real mechanism, versus two rounds of
guessing.

**Addendum 6 (same date) — replay restored, gated by a settle-time guard instead of removed:**
the user preferred the visual replay-on-return and asked for it back — removing it fixed the bug but
also removed something they liked. The bug was never "replaying is bad," it was "replaying can
interrupt a still-running replay." So `useFocusAnimKey` returns, rewritten to fix that specific
failure mode instead of avoiding it by not replaying at all: it records `Date.now()` on every bump
and only bumps again if more than `MIN_REPLAY_GAP_MS` (1000ms — the longest stagger delay across
tab screens, 360ms on Profile, plus ~600ms for a damping:18/stiffness:140 spring to settle, with
margin) has passed since the last one. A comfortable-speed tab switch (the common case) replays the
full stagger exactly as before. A rapid back-and-forth switch, faster than the previous play could
finish, simply skips the replay for that visit — the in-flight animation is left alone to finish
undisturbed instead of being cut off. All 5 tab screens use `useFocusAnimKey()`/`key={animKey}`
again; `app/tracker.tsx`/`app/festival/[id].tsx` still don't (Addendum 3 reasoning is unaffected —
they mount fresh every visit, so they never needed a replay-on-focus trigger in the first place).

**Why:** User feedback that the Tracker had become the de facto primary feature by default, while
the actual job-to-be-done was finding and following festivals; most Dashboard stats weren't
pertinent often enough to earn the home screen and are more at home as a Profile deep-dive. The FAB
was removed as a further simplification once contextual add-session entry points existed everywhere
that mattered.

**Ruled out:**
- Keeping Tournament as the primary browsable entity with Festival as secondary metadata: rejected
  per explicit product direction — festivals (not individual tournaments) are what players plan
  their travel/bankroll around
- A single combined Festivals+Tracker tab: rejected as it would re-create the same "everything
  crammed into one screen" problem the pivot was meant to fix
- Mounting `EnvironmentBackground` per screen group (tabs, tracker, festival detail) instead of once
  at the root: this was the intermediate fix for the black-background bug above, but it causes a
  Skia shader-recompile flash on every first visit to a pushed screen — superseded by the single
  root mount, see Addendum 2

---

## ADR-013 — Auth: self-hosted Google/Apple sign-in on the Fly relay + SQLite users DB

**Date:** 2026-08-18
**Status:** Decided (partially supersedes ADR-010's "no backend / no auth")

**Decision:** The app is gated behind a login screen (Sign in with Apple + Google, iOS only for
now). The existing Fly.io relay (`apps/api`, app `proker-bluff-relay`) grows a small HTTP API:
it verifies the provider identity token server-side (`jose` + remote JWKS, audience = iOS client
ID / bundle ID), upserts a `users` row in SQLite (`better-sqlite3`, WAL, file on a 1 GB Fly
volume `proker_data` mounted at `/data`), and issues its own stateless HS256 session JWT
(~180 days, `AUTH_JWT_SECRET` Fly secret). Endpoints: `POST /auth/google`, `POST /auth/apple`,
`GET /me`, `PATCH /me { pseudo }`. Mobile side: `useAuthStore` (zustand + MMKV cache of the
profile, token in `expo-secure-store` only), `Stack.Protected` guards in the root layout
(login → choose-pseudo → app), native modules `expo-apple-authentication` +
`@react-native-google-signin/google-signin`. The account pseudo replaces the mock name /
"Moi" everywhere (profile, dashboard avatar, hand-replayer hero, Bluff prefill).

**Why:**
- User accounts (email + pseudo) are the first server-side data; everything else (sessions,
  stakes, festivals) stays local per ADR-010's migration path
- Self-hosted beats Supabase/Firebase here: the Fly app already exists, four endpoints and one
  table don't justify a third-party dependency, and data stays on our infra
- SQLite-on-volume beats managed Postgres: essentially free, zero ops, and the single-machine
  constraint already exists for the socket.io rooms
- Stateless JWT beats a sessions table: survives scale-to-zero restarts with no DB lookup,
  logout is client-side token deletion

**Ruled out:**
- Managed auth (Supabase/Firebase/Clerk): less code but a new external dependency + dashboard
- Fly Managed Postgres: ~$5+/month and overkill for one users table
- expo-auth-session for Google: browser-bounce UX; the dev-client already tolerates native modules
- Syncing pseudo into `useAppStore.user.name`: dual-writes invite drift; display sites read
  `authUser.pseudo ?? user.name` instead

**Operational notes:** Dockerfile moved to `node:22-bookworm-slim` (better-sqlite3 prebuilt glibc
binary). `db.close()` added to the SIGINT/SIGTERM handler so the WAL checkpoints before Fly stops
the machine. Rotating `AUTH_JWT_SECRET` signs everyone out. Apple only sends the email claim on
first authorization — the upsert `COALESCE`s and the client forwards `credential.email`.
App Store follow-up: account deletion (guideline 5.1.1(v)) is required before shipping sign-in
to production — `DELETE /me` is not implemented yet.

**Addendum (2026-08-18) — rename Proker → Ultimate Poker Kit (UPK), done BEFORE any external
resource was created:** display name "UPK" (home screen) / "Ultimate Poker Kit" (login wordmark,
share cards), bundle identifier & Android package `fr.proker.app` → `fr.upk.app`
(`APPLE_BUNDLE_ID` default updated to match), Fly app `proker-bluff-relay` → `upk-api`
(new app — Fly can't rename; the old one can be destroyed once `upk-api` is deployed), volume
`upk_data`, DB `/data/upk.db`, packages `@upk/api` / `@upk/shared-types`. Deliberately kept:
slug/scheme `proker` (EAS project binding, invisible deep-link scheme) and all local persistence
keys (`proker` MMKV ids, `proker-app-store`/`proker-auth-store`, `proker-session-token`) —
renaming those would wipe local data/log users out for zero user-visible benefit. Since the
Google OAuth client, Apple Sign-In capability, and Fly volume/secrets had not been created yet,
nothing external was invalidated. Auth screens were also migrated to a new `auth` i18n namespace
(they predated the i18n mandate).

---

## ADR-014 — Every render path goes through `redactFor`

**Date:** 2026-08-30
**Status:** Decided

**Decision:** Bluff and OFC Pass & Play render from `RedactedState` / `RedactedOfcState`, the same
choke point the online host and every guest already use, rather than reading the raw engine state.
The viewer is the player about to act — `state.turnId` for bluff, `ofcLocalActorId(state)` for OFC
(Fantasy Land arrangers first, then the normal rotation). Everything both modes derive from that
state — who is acting, which actions are legal, what the caption says, what goes in each seat —
moved into two react-free modules, `src/lib/bluff/view.ts` and `src/lib/ofc/view.ts`, which return
i18n **keys and params rather than strings** so `src/lib` stays free of react and i18n (the
`bluff/labels.ts` convention) and the keys stay literal unions that `t()` can still type-check.

Where the modes genuinely differ, the difference is a named option rather than a hidden branch:
`rotateToViewer` (online seats you at the bottom; a shared phone must not move the seats) and
`addressViewerAsYou` (online says "your turn"; a shared phone names the player out loud).

OFC needs **two** redactions on a shared phone, and this is the part most likely to be got wrong
later: the strip is redacted for `TABLE_VIEWER` because it may only show what the room may see,
while the actor's role is decided by fields `redactFor` strips from everyone else — their `hand`,
and in pineapple their `pending.cards` — so it has to be read from the actor's own view. Asking a
table-redacted view "who is acting" always answers "nobody". `ofcSeatData` takes both and draws
every card from the table one.

**Why:**
- The redaction rules *are* the game's secrecy rules. Duplicating them in a screen means a second,
  untested copy that can drift — and the drifted copy is the one that shows a player's hand on a
  shared phone. OFC already did this for its felt with the `@table` sentinel; this generalises it.
- `redactFor` hands the viewer their **own** hand in every phase, by design: the device needs those
  cards for the private zone. So the naive seat mapping — forwarding `p.hand` — puts the acting
  player's hand face-up on the table everyone is looking at. That rule now lives in exactly one
  tested function per game (`bluffSeatData`, `ofcSeatData`), and both tests were verified to fail
  when the naive version is put back.
- It makes the visibility rules unit-testable for the first time. They are pure functions over a
  redacted state, so they run under the existing node-only vitest setup with no RN test harness.

**Ruled out:**
- A `useBluffLocal` conforming to the existing `BluffOnlineCommon` interface so one tree renders
  both modes: six of its ten fields are dead locally (`status`, `code`, `members`, `hostId`,
  `errorMsg`, `closedReason`, `leave`), and `myId` would be silently redefined from "this device"
  to "whose turn it is" — which drives seat rotation and the `(you)` suffix, so three behaviours
  would go wrong in a way the compiler cannot catch. The honest shared contract is
  `{ view, viewerId }` plus the two presentation flags above.
- One `<GameScene mode>` component for both games: bluff is an oval felt with a card fan, OFC a
  scrolling seat strip with a placement board. They share chrome, not structure — and the chrome is
  already shared (`GamePlayHeader`, `HandoffLock`, `NoPlayersScreen`, `GameOverActions`,
  `gameSurface.ts`, all under `src/components/games/`).
- Leaving Pass & Play on the raw state: the status quo, in which the same visibility predicate is
  written twice per game in four places.

**Note:** `GamePlayScreen`-style chrome extraction needs no ADR of its own — it is the same pattern
as `GameSetupScreen`, which has none. `flip` and `roulette` deliberately take only `GamePlayHeader`:
they are theme-aware (transparent background over the root `EnvironmentBackground`), while bluff and
OFC paint the fixed dark `SCREEN_BG` in both colour schemes.
