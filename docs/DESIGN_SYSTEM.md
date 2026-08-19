# UPK Design System

> "Frosted Glass" — a light, bright, near-monochrome bento aesthetic. Frosted-glass cards float
> over a softly-lit environment background. Charcoal glass cards alternate with light glass cards
> for rhythm. **Green is the only chromatic color**, reserved for money / primary / positive.
> Supersedes the earlier dark, gold-accented direction (see `DECISIONS.md` DS-001/DS-002 for the
> history of that change).

---

## 1. Design Philosophy

- **Frosted-glass cards** float over a bright, layered-gradient environment that shows through the blur
- **Bento grid layout** — cards of variable size, each widget self-contained
- **Data-first typography** — big thin display titles (Jost), bold tabular numbers (Geist), quiet uppercase labels
- **One accent color** — emerald green, used only for money, positive results, and primary actions. Loss is red. Everything else is neutral ink-grey on translucent white or charcoal
- **Living interface** — numbers count up, gauges sweep, charts draw in, cards stagger on entry

---

## 2. Color Tokens

Source of truth: `apps/mobile/src/design-system/theme.ts`.

```ts
colors = {
  accent:        '#0E9E62',  // deep emerald — text/icons/CTA on LIGHT surfaces
  accentBright:  '#17E58A',  // vivid emerald — text/curves/glow on DARK/charcoal surfaces
  accentTint:    'rgba(23, 229, 138, 0.14)',
  accentGlow:    'rgba(23, 229, 138, 0.22)',

  loss: '#E5484D',

  textPrimary:   '#23252B',
  textSecondary: '#5A5E68',
  textTertiary:  '#8A8F99',
  hairline:      'rgba(30, 34, 46, 0.10)',

  onDarkPrimary:   '#FFFFFF',
  onDarkSecondary: 'rgba(255, 255, 255, 0.50)',
  onDarkTertiary:  'rgba(255, 255, 255, 0.35)',
  onDarkHairline:  'rgba(255, 255, 255, 0.10)',

  surface: {
    lightGlassBg: 'rgba(255, 255, 255, 0.55)',
    lightGlassBorder: 'rgba(255, 255, 255, 0.70)',
    darkGlassBorder: 'rgba(255, 255, 255, 0.09)',
    fieldBg: 'rgba(255, 255, 255, 0.60)',
    fieldBorder: 'rgba(255, 255, 255, 0.85)',
    sheetBg: 'rgba(247, 247, 249, 0.97)',
  },
}
```

**Rule:** never introduce a second hue. If something needs emphasis and it isn't money, use
weight/size/contrast, not color.

---

## 3. Surfaces & Environment

```
Light glass (default card):
  background rgba(255,255,255,0.55), border rgba(255,255,255,0.70) 1px, radius 22
  BlurView intensity 28 tint "light" (iOS); flat rgba(247,247,249,0.94) fallback (Android)
  shadow #323848 @12% opacity, y10, blur radius 26

Charcoal glass (hero / featured / rhythm):
  LinearGradient #20222A → #101116, border rgba(255,255,255,0.09) 1px, radius 26
  shadow #141620 @28% opacity, y14, blur radius 34
  no blur needed — opaque gradient reads the same on iOS and Android

Field (nested inputs inside cards/sheets):
  background rgba(255,255,255,0.60), border rgba(255,255,255,0.85) 1px, radius 16

Sheet (bottom sheets):
  background rgba(247,247,249,0.97), BlurView intensity 40 tint "light", radius 34 top-corners-only
```

**Environment background** (`src/components/ui/EnvironmentBackground.tsx`) — a full-screen layered
gradient rendered exactly **once**, at `app/_layout.tsx` behind the root `Stack` (so it covers the
tab group and the pushed routes alike), never per-screen. Every screen's own background must be
transparent so it shows through. Built with a `react-native-skia` `Canvas` (warm top-left, cool
top-right, warm floor bottom radial gradients over a linear base
`#D7E0E9 → #E9E6DE → #DCCFBE`) since RN has no native radial-gradient primitive. Mounting it more
than once (e.g. once per screen group) causes a visible flash on first navigation to each
duplicate — each mount is a fresh Skia canvas that has to compile its gradient shaders — see
`DECISIONS.md` DS-007 Addendum 2.

---

## 4. Typography

Two families: **Jost 300** (thin) for display titles only, **Geist** for everything else. Numbers
use tabular figures.

```
apps/mobile/app/_layout.tsx loads:
  @expo-google-fonts/jost   → Jost_300Light
  @expo-google-fonts/geist  → Geist_400Regular … Geist_800ExtraBold
```

| Token | Family / weight | Size | Use |
|---|---|---|---|
| `fontFamily.display` | Jost 300 | `fontSize.display` (56) | Screen titles |
| — (sheet title) | Jost 300 | `fontSize.displaySheet` (32) | Bottom-sheet titles |
| `fontFamily.extrabold` | Geist 800 | `fontSize.display`/`'4xl'` (46) | Hero numbers |
| `fontFamily.extrabold` | Geist 800 | `fontSize['2xl']` (28) | Metric values, gauge center labels |
| `fontFamily.bold`/`semibold` | Geist 700/600 | `fontSize.base`–`lg` | Card/row titles, amounts |
| `fontFamily.semibold` UPPERCASE | Geist 600 | `fontSize.xs` (10), tracked | Section labels (`SectionLabel`), metadata |
| `fontFamily.regular`/`medium` | Geist 400/500 | `fontSize.sm`–`base` | Body, descriptions |

Numbers: `fontVariant: ['tabular-nums']`.

---

## 5. Spacing, Radius, Blur

```
SPACING (px): 4 · 8 · 12 · 16 · 20 · 24 · 32   (theme.ts: xs·sm·md·base·lg·xl·2xl)
RADIUS  (px): field 16 (md) · card 22 (xl) · hero/dark card 26 (2xl) · icon tile 12 (sm) · pill/chip 9999 (full)
BLUR:         light cards 28 · sheets 40 · nav pill 24
SHADOW:       shadow.light {y10, r26, #323848@12%} · shadow.dark {y14, r34, #141620@28%}
```

---

## 6. Motion

- Card/screen entry: `Animated.View` with `FadeInDown.delay(n).springify().damping(18).stiffness(140)`, staggered ~60ms per section. On the 5 **tab** screens, replays on every focus via `key={animKey}` from `src/hooks/useFocusAnimKey.ts` — but only if at least 1000ms passed since the last replay, so a fast tab switch never interrupts a still-running stagger (see `DECISIONS.md` DS-007 Addendum 6; a version without this guard caused "starts, cuts off, restarts" on quick switching). Pushed screens (`app/tracker.tsx`, `app/festival/[id].tsx`) don't use this hook — they mount fresh on every visit, so a plain mount-time animation is correct there.
- Number counters: `AnimatedNumber` — count up 600–900ms ease-out cubic.
- Gauge/chart sweep: 800ms ease-out, respecting `useReducedMotion()` (see `MetricGauge`, `BarChart`).
- Bottom sheets: slide 380ms `cubic-bezier(.22,1,.36,1)`, backdrop fade 200ms; tap backdrop or ✕ to dismiss.
- Press: scale 0.97 (existing `activeOpacity`/spring patterns, unchanged).

---

## 7. Charts

Library: **Victory Native XL** (`src/components/charts/`), plus plain-`View` bars for the small weekly-volume chart (simpler than a Skia bar chart for a 4–5 bucket display).

- **`AreaChart`** (rename/restyle of the old `ProfitChart`) — accent line + accent→transparent gradient fill (via `@shopify/react-native-skia` `LinearGradient` inside the Victory `Area`), 3 faint gridlines (`hairline`/`onDarkHairline`), no axes. `tone: 'light'|'dark'` picks `accent` vs `accentBright`; `color` prop overrides (e.g. `loss` when the trend is negative).
- **`BarChart`** — weekly volume, plain animated `View` bars (Reanimated height %), rounded top corners, current-period bar = accent, others `#2B2E37`.
- **`MetricGauge`** — SVG donut (react-native-svg `Circle` + Reanimated `strokeDashoffset`), track `hairline`, fill `accent` (positive) or `#2B2E37` (neutral), rounded linecap, center label. ROI's sweep fraction is clamped to `min(abs(value),100)/100`; the center label still shows the raw signed value.

---

## 8. Navigation

### Floating tab bar (`src/components/ui/FloatingTabBar.tsx`)

```
Floating charcoal pill, centered, ~20px from bottom, height 68, radius 9999
Blur 24 tint dark (iOS) + charcoal tint overlay; border rgba(255,255,255,0.12)
5 icon-only tabs (as of the 2026-07-02 festival-first pivot, DECISIONS.md DS-007):
  Dashboard, Festivals, Planning, Degen Hub, Profil
Active: white icon on a light-tinted inner pill + 4px dot below
Inactive: rgba(255,255,255,0.50) icon
```

The component itself (`FloatingTabBar.tsx`) is generic over tab count/width — going from 4 to 5
tabs needed no changes to it, only to the `Tabs.Screen` list in `app/(tabs)/_layout.tsx`.

**No FAB anymore** (removed 2026-07-02, DS-007 addendum): the pill used to end in a white circular
"add session" button (`onAddPress` prop, `Plus` icon) trailing the tab row. It's gone — the pill is
now just the 5 tab buttons, full-width. Session creation moved to contextual CTAs instead (Dashboard
festival hero, tournament detail) — see `SPEC.md` §2.

### Bottom sheets (`src/components/ui/BottomSheet.tsx`)

Custom primitive: RN `Modal` (`transparent`, `animationType="none"`) + Reanimated-driven
`translateY`/backdrop-opacity, matching the slide/fade timing above. No gesture-handler
drag-to-dismiss (not required by the design; see `DECISIONS.md` for why). Used by `AddSessionSheet`
and the rebuilt `FilterSheet`. The two read-only detail modals (`SessionDetailModal`,
`StakeDetailModal`) are re-themed to the light palette but still use a plain `Modal` — swapping
their chrome to `BottomSheet` is a follow-up, not yet done.

---

## 9. Iconography

Library: **Lucide React Native**, stroke ~1.5–1.9px, color inherited from context (`textSecondary`
decorative, `accent`/`accentBright` active/money).

---

## 10. Component Inventory

| Component | Path | Notes |
|---|---|---|
| `EnvironmentBackground` | `ui/EnvironmentBackground.tsx` | Full-screen gradient, mounted exactly once at `app/_layout.tsx` (root) |
| `GlassCard` | `ui/GlassCard.tsx` | `variant: 'light' \| 'dark'` |
| `GlowBlob` | `ui/GlowBlob.tsx` | Soft radial glow overlay, shared by the profit hero and `CoupDeCoeurCard` |
| `SectionLabel` | `ui/SectionLabel.tsx` | Uppercase tracked label |
| `MetricGauge` | `ui/MetricGauge.tsx` | Donut/arc gauge |
| `StatBadge` | `ui/StatBadge.tsx` | Trend chip, `tone: 'light'\|'dark'` |
| `AnimatedNumber` | `ui/AnimatedNumber.tsx` | Count-up number |
| `FloatingTabBar` | `ui/FloatingTabBar.tsx` | Nav chrome, icon-only (no FAB — removed DS-007) |
| `BottomSheet` | `ui/BottomSheet.tsx` | Shared sheet primitive |
| `SegmentedControl` | `ui/SegmentedControl.tsx` | Generic 2–3 option switcher |
| `PickerField` / `SearchCreateList` | `ui/PickerField.tsx` | Tap-to-expand search+create picker |
| `BuyInField` | `ui/BuyInField.tsx` | Editable presets vs read-only inferred |
| `Stepper` | `ui/Stepper.tsx` | 36px circular +/- control |
| `AmountInput` | `ui/AmountInput.tsx` | Money text field |
| `AreaChart` / `BarChart` | `charts/` | See §7 |
| `SessionRow` / `StakeRow` | `tracker/` | Sessions list rows (`app/tracker.tsx`) |
| `AddSessionSheet` | `tracker/AddSessionSheet.tsx` | Single adaptive sheet (Tournoi/Cash/Staking); also accepts `initialFestival` to pre-scope without a tournament (Dashboard hero CTA) |
| `TournamentDetailModal` | `finder/TournamentDetailModal.tsx` | Shared read-only tournament sheet, opened from Festivals, Festival detail, Planning, Dashboard |
| `FestivalCard` | `finder/FestivalCard.tsx` | Festival list row, `full`/`mini` variants (replaces the old `TournamentCard`) |
| `FestivalFilterSheet` / `MultiFilterChipGroup` | `finder/` | Continent/country/buy-in are multi-select (checkbox); organizer stays single-select via the older `FilterChipGroup` (replaces the old tournament-scoped `FilterSheet`) |
| `CoupDeCoeurCard` | `tournaments/CoupDeCoeurCard.tsx` | Kept for `TournamentDetailModal`'s "featured" framing; no longer used as a Dashboard/Festivals hero (see `FestivalHeroCard`) |
| `BlindStructureTable` | `tournaments/BlindStructureTable.tsx` | Level-by-level SB/BB/ante/duration table, shown on a festival's Main Event card |
| `FestivalHeroCard` | `dashboard/FestivalHeroCard.tsx` | Dashboard's current/most-recently-liked festival hero, dark variant, two CTAs (view tournaments / log a result) |
| `MonthCalendar` | `planning/MonthCalendar.tsx` | Custom month grid for the Planning tab (ADR-012) |
| `GameTile` | `degen/GameTile.tsx` | Non-interactive Degen Hub tile with a "Bientôt disponible" `Pill` |
| `LikeButton` | `ui/LikeButton.tsx` | Toggleable heart icon, `tone: 'light'\|'dark'`, spring bounce on toggle — used for both festival and tournament likes |
| `Pill` | `ui/Pill.tsx` | Generic small rounded badge, `tone: 'neutral'\|'accent'` |

---

## 11. Provenance

This system replaced the original dark/gold glassmorphism direction in a full redesign, following a
design handoff (`Proker Dashboard.dc.html` interactive reference + token spec). See `DECISIONS.md`
DS-001/DS-002 (superseded) and the new DS-005/DS-006 entries for the reasoning, and ADR-011 for the
`BottomSheet` build choice.
