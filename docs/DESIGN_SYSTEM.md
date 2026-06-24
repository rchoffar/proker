# Proker Design System

> Deep glassmorphism on dark. Gold accents. Living cards. Inspired by the reference bento-grid dashboard — adapted to the premium aesthetic of high-stakes poker.

---

## 1. Design Philosophy

The reference dashboard image defines a specific visual language:

- **Glassmorphism cards** floating on a blurred background — depth through transparency, not shadows alone
- **Bento grid layout** — cards of variable size live on a spatial canvas, each widget a self-contained unit
- **Data-first typography** — large, bold numbers. Small, quiet labels. The data is the hero
- **Living interface** — numbers animate in, charts draw, cards have micro-interactions
- **Contrast as hierarchy** — dark cards and light-tinted glass cards coexist, creating rhythm

For Proker on dark mode, this translates to: a deep space-black canvas with gold-lit glassmorphism cards that feel like chips on a felt table.

---

## 2. Color Tokens

```
// Background layers
--color-bg-base:          #0A0A0F    // Near-black — the canvas
--color-bg-elevated:      #111118    // Slightly lifted surface
--color-bg-overlay:       #1A1A25    // Modal, sheet backgrounds

// Glass cards
--color-glass-default:    rgba(255, 255, 255, 0.06)   // Standard card fill
--color-glass-hover:      rgba(255, 255, 255, 0.09)   // On press/active
--color-glass-strong:     rgba(255, 255, 255, 0.12)   // Highlighted card
--color-glass-border:     rgba(255, 255, 255, 0.08)   // Card border
--color-glass-border-gold: rgba(255, 215, 0, 0.20)   // Gold-tinted border (featured cards)

// Accent — Gold
--color-gold-primary:     #FFD700   // Primary CTA, wins, highlights
--color-gold-soft:        #E6C200   // Muted gold for secondary elements
--color-gold-glow:        rgba(255, 215, 0, 0.15)  // Ambient glow behind gold elements

// Semantic
--color-profit:           #00C878   // Positive result, profit
--color-loss:             #FF4757   // Negative result, loss
--color-warning:          #FF9F43   // Caution (ruin risk, etc.)
--color-neutral:          #8A8A9A   // Even / no change

// Text
--color-text-primary:     #FFFFFF   // Main text
--color-text-secondary:   #8A8A9A   // Labels, metadata
--color-text-tertiary:    #5A5A6E   // Disabled, hints
--color-text-inverse:     #0A0A0F   // Text on gold/light backgrounds
```

---

## 3. Typography

Font: **Inter** (via `@expo-google-fonts/inter`)

| Token | Size | Weight | Use |
|---|---|---|---|
| `display-xl` | 48sp | 800 | Hero numbers (bankroll, big stat) |
| `display-lg` | 36sp | 700 | Dashboard metric cards |
| `display-md` | 28sp | 700 | Section headers |
| `heading-lg` | 22sp | 600 | Card titles |
| `heading-md` | 18sp | 600 | Screen titles |
| `heading-sm` | 16sp | 600 | Sub-section labels |
| `body-lg` | 16sp | 400 | Body text |
| `body-md` | 14sp | 400 | Lists, descriptions |
| `body-sm` | 13sp | 400 | Metadata, timestamps |
| `label-lg` | 12sp | 600 | Tags, chips (uppercase) |
| `label-sm` | 10sp | 500 | Micro labels |

**Rules:**
- Numbers always use tabular figures (`fontVariant: ['tabular-nums']`)
- Profit/loss numbers always bold (`font-weight: 700`)
- Labels and metadata in `text-secondary` color
- Never more than 3 type sizes on one screen

---

## 4. Spacing System

Base unit: **4px**

| Token | Value | Use |
|---|---|---|
| `space-1` | 4px | Tight internal padding |
| `space-2` | 8px | Icon-to-text gap |
| `space-3` | 12px | Small card padding |
| `space-4` | 16px | Standard padding |
| `space-5` | 20px | Section separation |
| `space-6` | 24px | Card padding (standard) |
| `space-8` | 32px | Large section gap |
| `space-10` | 40px | Screen-level vertical rhythm |
| `space-12` | 48px | Header / hero spacing |

---

## 5. Border Radius

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 8px | Tags, chips, badges |
| `radius-md` | 12px | Inputs, small cards |
| `radius-lg` | 16px | Standard cards |
| `radius-xl` | 20px | Large cards, modals |
| `radius-2xl` | 24px | Hero cards |
| `radius-full` | 9999px | Pills, circular elements |

---

## 6. Glassmorphism — Implementation Guide

### Standard Glass Card

```
Background: rgba(255, 255, 255, 0.06)
Border: 1px solid rgba(255, 255, 255, 0.08)
BorderRadius: 16–20px
Blur: expo-blur BlurView, intensity 20–30, tint "dark"
Shadow: {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.3,
  shadowRadius: 24,
  elevation: 8
}
```

### Gold-featured Card (premium / highlight)

```
Background: rgba(255, 215, 0, 0.06)
Border: 1px solid rgba(255, 215, 0, 0.20)
Inner glow: subtle radial gradient from rgba(255,215,0,0.08) to transparent
```

### Dark Opaque Card (for contrast rhythm)

```
Background: #111118
Border: 1px solid rgba(255, 255, 255, 0.06)
No blur needed
Use for: stats with high data density, chart containers
```

### Card Anatomy

```
┌─────────────────────────────────┐
│  [Icon/Label]     [Tag/Badge]   │  ← Header row: 12px padding top
│                                 │
│  [Metric / Main Content]        │  ← Hero content
│                                 │
│  [Sub-label / trend indicator]  │  ← Footer: secondary info
└─────────────────────────────────┘
  ← 16–24px horizontal padding →
```

---

## 7. Animation Principles

The app is **"living"** — UI elements breathe, transition, and react.

### Hierarchy of animations

| Priority | When | Duration | Easing |
|---|---|---|---|
| P1 — Entry | Screen/card mount | 300–500ms | spring(damping: 15) |
| P2 — Number | Metric value change | 600–800ms | ease-out |
| P3 — Micro | Button press, tap | 80–150ms | ease-in-out |
| P4 — Chart | Line/bar draw | 800–1200ms | ease-in-out |
| P5 — Gesture | Drag, swipe | Real-time | spring |

### Core animation patterns

**Stagger entry** — Cards animate in sequentially (50ms delay each) on first load. Use `Moti`'s `AnimatePresence`.

**Number counters** — Bankroll and stats count up from 0 on first view. Use `react-native-reanimated` shared values + `useAnimatedProps`.

**Card press** — Scale down to 0.97 on press with a spring. Adds tactility.

**Chart line draw** — Path is drawn from left to right using SVG strokeDashoffset animation.

**Tab transition** — Fade + slight vertical translate (4px up) between tab screens.

**Gold shimmer** — Gold-accented cards have a subtle periodic shimmer animation (looping, very soft).

### Rules
- Never animate more than 3 elements simultaneously (performance + clarity)
- All animations respect `useReduceMotionAccessibility`
- Gesture-driven animations run on the UI thread (Reanimated worklets)

---

## 8. Chart Style Guide

Library: **Victory Native XL** (Skia-based, smooth, customizable)

### Profit Curve (Dashboard + Tracker)

```
Type: Area chart (line + gradient fill)
Line color: profit (green) if positive trend, loss (red) if negative
Fill: gradient from line color (20% opacity at top) to transparent (0% at bottom)
Grid lines: rgba(255,255,255,0.06), horizontal only
Axis labels: text-tertiary color, label-sm size
No axis borders
Animated draw on mount
```

### Bar Chart (Session comparison)

```
Type: Bar chart
Bar color: profit (#00C878) or loss (#FF4757) based on value
Bar radius: 4px rounded top
Background bars: rgba(255,255,255,0.04) full-height guide bars
Animated scale-up from 0 on mount
```

### Donut / Gauge (ROI, Ruin Risk)

```
Type: Donut / arc
Track color: rgba(255,255,255,0.08)
Fill color: gold for neutral, green for positive, red for danger
Animated arc sweep on mount
Center label: large metric + small unit
```

---

## 9. Navigation Design

### Bottom Tab Bar

```
Style: Floating pill — not full-width bar
Position: Fixed, 16px from screen bottom, centered
Shape: Pill (border-radius: 999px)
Background: rgba(20, 20, 30, 0.92) + blur
Border: 1px solid rgba(255,255,255,0.10)
Height: 64px
Padding: 16px horizontal

Active tab: Gold dot indicator below icon + icon tint gold
Inactive tab: Icon tint text-tertiary
Tab label: Hidden by default (icon-only, cleaner), shown on active

Shadow: glow from rgba(0,0,0,0.5)
```

### Modals & Sheets

```
Sheet (add session, filters): slides up from bottom
  - Handle bar at top
  - Background: bg-overlay
  - Backdrop: rgba(0,0,0,0.6) blur

Full-screen modal (flex cards, hand replayer):
  - Slides in from bottom
  - Dark gradient background
```

---

## 10. Iconography

Library: **Lucide React Native**

- Size: 20px (inline), 24px (nav), 32px (featured/hero)
- Stroke width: 1.5px (clean, not chunky)
- Color: inherit from context (text-secondary for decorative, gold for active)

---

## 11. Component Inventory (V1)

| Component | Variants |
|---|---|
| `GlassCard` | default, gold-featured, dark-opaque |
| `MetricCard` | with chart, without chart, compact |
| `StatBadge` | positive, negative, neutral |
| `TabBar` | (single variant, floating pill) |
| `Button` | primary (gold), secondary (glass), ghost, destructive |
| `Input` | default, with icon, search |
| `SessionRow` | tournament, cash-game |
| `ProfitChart` | area, bar |
| `DonutGauge` | percentage, risk |
| `BottomSheet` | default |
| `AnimatedNumber` | counter, currency |
| `Avatar` | with badge, without |

---

## 12. Design Reference — Image Analysis

The source reference (Russian productivity dashboard) establishes these patterns that we adapt for Proker:

| Reference pattern | Proker adaptation |
|---|---|
| Light pearl background | Deep space-black #0A0A0F |
| White frosted glass cards | Dark-tinted glass cards (rgba white, very low opacity) |
| Black accent for active elements | Gold #FFD700 for active/highlighted states |
| Monochrome charts | Semantic color charts (green profit / red loss) |
| Mixed card sizes in bento grid | Dashboard bento: 2-col grid, some full-width |
| Floating pill navigation | Same — floating pill bottom tab bar |
| Large metric numbers | Same — hero numbers, quiet labels |
| Minimal decorative elements | Same — data is the decoration |
| Cards with embedded mini-charts | Same — every metric card can have a sparkline |
