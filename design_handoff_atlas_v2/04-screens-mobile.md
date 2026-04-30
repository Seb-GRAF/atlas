# 04 — Mobile Screens

Three screens at iPhone 14/15 dimensions: **390×844**. Status bar 44px, home indicator 5px. Tab bar 12px L/R margin from edges, 24px from bottom.

---

## M1 — Mobile · List

Default mobile screen. Photo-led row list with status filter chips on top. Floating "Carte" pill at bottom-center to switch to map view.

**Reference:** `V2MobileList`

### Layout

```
┌──────────────────────┐  ← 390 wide
│ 9:41          ●●● 60%│  status bar (44 high)
├──────────────────────┤
│ [🔍] [Vevey, Lutry…] [⊞●]│  top bar (10 padding, glass pills)
├──────────────────────┤
│ VEVEY & RIVIERA      │  eyebrow
│ 6 appartements  Récents▾│  heading + sort
│                      │
│ [À trier 3] [En cours 4] [Visites 1] …  ← horizontal scroll filter chips
│                      │
│ ┌──────────────────┐ │  list rows with full-width photos
│ │ [PHOTO 16:10]   ❤│ │
│ │ [NOUVEAU]        │ │
│ └──────────────────┘ │
│ VEVEY · immobilier   │
│ Appartement de 3.5…  │
│ 🛏 3.5  ⬜ 78 m²  🚆 32 min  2 180│
│ ────                  │  Hairline divider
│ ┌──────────────────┐ │
│ │ [PHOTO]          │ │
│ │ ...              │ │
│                      │
│       [🗺 Carte]      │  floating dark pill at bottom
│        ────          │  home indicator
└──────────────────────┘
```

### Top bar (mobile variant)

`display: flex; align-items: center; gap: 8; padding: 10 12; background: rgba(253,251,247,.86); backdrop-filter: blur(24px) saturate(170%); box-shadow: 0 1px 0 rgba(22,20,15,.06)` (a 1px shadow at bottom acts as the page-scroll boundary).

Three glass pills inline:
1. Search icon-only pill (15px icon)
2. Search field pill (`flex: 1`, placeholder "Vevey, Lutry…" in ink-3)
3. Filter icon pill (15px icon + 5×5 ember dot indicator showing active filters)

### Page header

`padding: 12 12 4` on `var(--atlas-bg)` (not glass — content scrolls under top bar).

- **Eyebrow** (zones / shortTitle): "VEVEY & RIVIERA"
- **Heading**: "{N} appartements" 17/500/-0.018em
- Right-aligned: small `bg: var(--atlas-soft)` pill "Plus récents ▾" (font 11.5)

### Status filter chips

Horizontal scroll row, `padding: 0 8 12`, gap 6.

Each chip: `padding: 7 12; border-radius: 999; font 12.5/500; white-space: nowrap`.
- Active: `bg: #16140f; color: #fff`
- Inactive: `bg: var(--atlas-paper); color: var(--atlas-ink-2); box-shadow: inset 0 0 0 1px var(--atlas-line)`
- Count appended in mono 10.5px, opacity 0.7 (active) or 0.55 (inactive)

### List rows

Stacked vertically inside a scrolling container `padding: 0 12 90` (the bottom 90 makes room for the floating Carte pill + home indicator).

Each row: `padding: 12 0; border-bottom: 1px solid var(--atlas-line-2)`. Inside:

```
1. PhotoFrame, aspect 16:10, radius 14, full row width
   - Heart button absolute top-right (32×32, white bg .92, blur)
   - "NOUVEAU" badge top-left if isNew (rgba(22,20,15,.7) bg, blur 8, white text 10.5/500/.08em uppercase, padding 4 9)
2. Title row: eyebrow + price right-aligned
   - Eyebrow: "{AREA} · {SOURCE-SHORT}" (11/.1em uppercase, ink-3)
   - Title: 14.5/500/-0.012em
   - Price: mono.tnum 16/500
3. Meta row: gap 14, font 12 ink-2, with icons (12px stroke 1.7):
   - 🛏 {rooms} pces
   - ⬜ {surfaceM2} m²
   - 🚆 {transitText}
```

### Floating "Carte" pill

`position: absolute; bottom: 24; left: 50%; transform: translateX(-50%); z-index: 5`.
Dark bg `#16140f`, white text 13.5/500, padding `10 18`, radius 999, gap 8.
Map icon (16px stroke 1.8) + "Carte". Shadow `0 14px 30px -10px rgba(22,20,15,.4)`.

### Home indicator

5×134, ink, radius 3, centered, 8px from bottom. (Standard iOS — keep it.)

---

## M2 — Mobile · Map

Full-bleed map. Floating search at top, filter chips, right-rail map controls, mini-card preview at bottom, glass tab bar.

**Reference:** `V2MobileMap`

### Layout

```
┌──────────────────────┐
│ 9:41          ●●● 60%│  ← floating status bar (over map)
│                      │
│  ┌──────────┐ ┌──┐   │  top floating: search + filter (top: 54)
│  │🔍 Vevey..│ │⚙ │   │
│  └──────────┘ └──┘   │
│  [À trier 3] [En…]…  │  filter chips (top: 102, scroll horizontal)
│                  ⌖   │
│        [pin]      ⊞  │  right-rail map controls (top: 156)
│   [pin]              │
│       [SELECTED]     │
│  [pin]               │
│           [pin]      │
│                      │
│ ┌──────────────────┐ │  bottom mini-card (bottom: 100)
│ │ ┌──┐ VEVEY       │ │  glass panel, 104×104 photo + meta
│ │ │📷│ Title…  ●━━ │ │  + dot pagination on right
│ │ └──┘ 2 180 CHF   │ │
│ └──────────────────┘ │
│  [List|Map|Triage]   │  tab bar (bottom: 24)
│        ────          │
└──────────────────────┘
```

### Top floating search bar

`position: absolute; top: 54; left: 12; right: 12; z-index: 6; display: flex; gap: 8`.
- Search pill: `flex: 1`, `padding: 8 12`, search icon + placeholder
- Filter icon pill: `padding: 8 10`

### Floating status bar

`position: absolute; top: 0; left: 0; right: 0; height: 44; z-index: 8; pointer-events: none`. Time + signal/wifi/battery icons. Color `var(--atlas-ink)` so it reads over the warm map.

### Filter chips

`position: absolute; top: 102; left: 0; right: 0; z-index: 5; padding: 0 12; display: flex; gap: 6; overflow-x: auto`.
Glass pills, `padding: 6 12; font: 12px`. Active: `background: rgba(22,20,15,.92); color: #fff`.

### Right-rail map controls

`position: absolute; right: 12; top: 156; display: flex; flex-direction: column; gap: 6; z-index: 5`.
Two buttons: Compass, Layers. Each 40×40, radius 12, glass bg `rgba(253,251,247,.94)`, blur 12.

### Bottom mini-card

Glass panel, `position: absolute; bottom: 100; left: 12; right: 12; z-index: 6; border-radius: 18; padding: 10`.

```
display: grid;
grid-template-columns: 104px 1fr;
gap: 12;
```

Left: 104×104 cover photo, radius 12.
Right column (vertical, gap 3, padding-top 2):
- Eyebrow: AREA
- Title: 13.5/500/-0.01em ellipsis
- Meta: 11.5/400 ink-3 — "rooms · m² · transit"
- Bottom row (gap 8, align-center, margin-top 4):
  - Price: mono.tnum 14/500
  - spacer
  - **Pagination dots**: shows ~4 dots (one per nearby listing); active dot is 14×4 ink, inactive 4×4 line. Lets user swipe through listings while map stays put.

### Tab bar (glass)

`position: absolute; bottom: 24; left: 12; right: 12; z-index: 7`.
Glass panel, `border-radius: 999; padding: 4`, `display: grid; grid-template-columns: 1fr 1fr 1fr`.

Three tabs: List (`📋`), Map (`🗺`), Triage (`⚡`). Each:
- Active: `bg: #16140f; color: #fff; border-radius: 999`
- Inactive: `bg: transparent; color: var(--atlas-ink-2)`
- `padding: 8 10; font 13/500; gap: 6 (icon + label)`

---

## M3 — Mobile · Detail

Map dimmed underneath (with a soft gradient). Listing details in a 76%-height bottom sheet that drags down to dismiss.

**Reference:** `V2MobileDetail`

### Layout

```
┌──────────────────────┐
│ 9:41          ●●● 60%│
│  [◀]              [⋯]│  back + more (top: 54)
│                      │
│       [map]          │  ← still visible behind sheet
│  ╔════════════════╗  │
│  ║       ━        ║  │  bottom sheet, radius 22 22 0 0
│  ║                ║  │  76% of frame height
│  ║  [PHOTO 4:3]   ║  │
│  ║                ║  │
│  ║ AREA · SOURCE  ║  │
│  ║ Title… 2 680   ║  │
│  ║ Address        ║  │
│  ║                ║  │
│  ║ [stat][stat][s]║  │  3-cell stat grid
│  ║                ║  │
│  ║ [Ff] flatfox  À│  │  source + status pill
│  ║                ║  │
│  ║ Description…   ║  │
│  ║                ║  │
│  ╠════════════════╣  │  Hairline
│  ║ [❤] [↗ Ouvrir l'…]║│  heart + primary action
│  ╚════════════════╝  │
│        ────          │  home indicator
└──────────────────────┘
```

### Map background

Map fills the frame, `position: absolute; inset: 0`. Above it: a fade overlay `linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,.18) 100%)` so the dark sheet content has lift.

### Top floating buttons

`position: absolute; top: 54; left/right: 12; z-index: 7`. Two glass pills with icons:
- Back (chevron rotated 180°), 16px stroke 1.8
- More dots, 16px stroke 1.8
Both `padding: 8`.

### Bottom sheet

`position: absolute; left: 0; right: 0; bottom: 0; z-index: 6; height: 76%; background: var(--atlas-paper); border-radius: 22 22 0 0; box-shadow: 0 -22px 50px -22px rgba(22,20,15,.32); display: flex; flex-direction: column; overflow: hidden`.

Inside, top to bottom:

1. **Drag handle** — centered 36×4 pill at `padding: 8 0 4`, color `rgba(22,20,15,.18)`.
2. **Scrollable body** — `padding: 8 16 0; flex: 1; overflow-y: auto`:
   - PhotoFrame 4:3, radius 16
   - Title block: padding `16 0 12`. Layout: flex space-between baseline.
     - Left: eyebrow + title (18/500/-0.018em) + address
     - Right: price (mono.tnum 22/500/-0.015em)
   - Stat grid (same trick as desktop, 3 cells)
   - Source row: source mono + name + status pill (right-aligned)
   - Description paragraph (13.5/400/1.55, ink-2)
3. **Hairline + footer** — `padding: 10 16` plus `env(safe-area-inset-bottom)`. Grid `auto 1fr; gap: 8`:
   - Heart button: 46×46, radius 999, paper-2 bg, hairline inset border
   - Primary "Ouvrir l'annonce" with external icon, dark bg, font 14/500

### Drag interaction (production)

In a real implementation: drag handle responds to vertical swipe; sheet snaps between half (~50%), full (76%), or dismiss (returns to map M2). Use `react-spring` or Framer Motion's `motion.div` with drag constraints, or Mantine's `<Drawer position="bottom">` with custom snap points.

---

## Mobile chrome reference

### Status bar (default, page-flow)

`height: 44; padding: 0 24; background: var(--atlas-bg); display: flex; align-items: center; justify-content: space-between; font: 14/600 var(--sans); color: var(--atlas-ink)`.

Left: `9:41` in mono.
Right: signal (16×10 filled), wifi (14×10 outlined), battery (22×10 outlined with 60% inner fill).

### Status bar (floating, over map)

Same layout but `position: absolute; top: 0; left: 0; right: 0; z-index: 8; pointer-events: none`.

### Home indicator

`position: absolute; left: 0; right: 0; bottom: 8; display: flex; justify-content: center; z-index: 9`. Inner: `width: 134; height: 5; border-radius: 3; background: var(--atlas-ink)`.

---

## Tab bar destination map

| Tab | Routes to |
|---|---|
| List | M1 (mobile list) — default landing |
| Map | M2 (mobile map) |
| Triage | M-Triage (separate flow — gestural swipe; not designed in V2 but already explored in `v-triage.jsx` if needed) |

The desktop has an equivalent stage-segmented control instead of tabs. They share the data filter, not the navigation model.

---

Next: [05-data-model.md](./05-data-model.md)
