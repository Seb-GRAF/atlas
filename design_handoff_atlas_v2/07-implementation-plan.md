# 07 — Implementation Plan

A suggested order of operations for an engineer (or Claude Code) to build this in your real codebase. Optimized for **early visual feedback** and **minimum thrash** on the data layer.

---

## Phase 0 — Setup (½ day)

1. Create a feature branch: `feat/atlas-v2-redesign`.
2. Add Geist + Geist Mono via your font pipeline (Google Fonts CSS, self-host, or Fontsource).
3. Add design tokens to your theme. Two paths:
   - **Mantine theme override** — extend `colors`, `fontFamily`, `radius`, `shadows`. Add custom CSS variables in your global stylesheet for tokens that don't map (`--atlas-line`, `--atlas-soft`, etc.).
   - **CSS-only** — drop the `:root` block from `Atlas Redesign.html` lines 11–37 into your global CSS.
4. Add the keyframes (`v2spin`, `v2pulse`) globally.
5. Add `.mono` and `.tnum` utility classes (or expose a `<Mono>` component).

**Done when:** A test page using `var(--atlas-bg)` background and Geist text renders correctly.

---

## Phase 1 — Primitives (1 day)

Build, in order:

1. `<Hairline>` — trivial, do first.
2. `<GlassPill>` — used in many places.
3. `<GlassPanel>` — same DNA as pill, larger.
4. `<SourceMono>` — small, isolated.
5. `<StatusPill>` — small, isolated.
6. `<PhotoFrame>` — port from `atlas-shared.jsx` lines 190–245. Watch the no-hover-lift rule.
7. Buttons: primary, secondary, ghost, icon. (Or override Mantine defaults via theme.)
8. Inputs / textarea / segmented control / toggle.

**Verification:** build a Storybook page or simple `/atlas/playground` route showing each primitive in isolation. Visually compare against the same primitive in the prototype.

---

## Phase 2 — Map wrapper (1–2 days)

The single biggest decision in this build. Pick a provider:

| Option | Pros | Cons |
|---|---|---|
| **MapLibre GL** + custom style | Closest visual match, free, full control | 2–3h of style work |
| **Mapbox GL** | Easy setup, great defaults | Paid past free tier |
| **Leaflet + CartoDB tiles** | Cheapest, lightweight | Hardest to match the warm style |

**Recommended: MapLibre GL.**

### Build steps

1. Install `maplibre-gl` and CSS.
2. Create `<AtlasMap>` wrapper with the API in [02-primitives.md §7](./02-primitives.md).
3. Pass a custom vector style. Easiest path: fork [Stadia Alidade Smooth](https://maps.stadiamaps.com/) or [Maptiler Bright](https://www.maptiler.com/) and recolor to the warm palette. Layers to override:
   - `background` → `#f0e8db`
   - `water` → `#cfd9d6`
   - `landuse-park` → `#d8dfc4`
   - `road-primary` outline → `#ebe0d0`, fill → `#fff8ee`
   - hide all `country-label`, `state-label`, and most place labels at zoom < 12
4. Render listing pins as React-portal markers, not native map markers. This way the pin is a real React component (with hover, click, transitions) and styled in CSS.
5. Render workplace pin separately (non-interactive).

**Verification:** Provide pins for 3 mock listings; clicking a pin fires `onSelect` with id; selected state visually flips bg and adds halo.

---

## Phase 3 — Slice 1: Desktop default (D1) (2–3 days)

This is your data-layer-defining slice. Don't try to ship multiple screens before the data flows here.

### Tasks

1. Stand up TypeScript types from [05-data-model.md](./05-data-model.md).
2. Add data fetching:
   - `useListings({ stage, zone })` — returns `Listing[]`
   - `useListing(id)` — returns selected `Listing`
   - `useProfile()` — returns `Profile`
3. Add URL state: `?stage=&listing=&zone=`. Use your router's query-param hooks.
4. Build `<TopBar>`:
   - Logo pill, search pill (placeholder for now), stage segmented control, settings icon, Scanner button.
5. Build `<ListPanel>`:
   - Header (eyebrow zones, count, sort, generated-at)
   - Hairline
   - List rows (use the spec in [02-primitives.md §13](./02-primitives.md))
   - Selection state from URL
6. Build `<DetailPanel>`:
   - PhotoFrame
   - Title block + price
   - Stat grid
   - Source row + status pill
   - Status segmented control (binds to `PATCH /listings/:id`)
   - Notes textarea
   - Action buttons (primary opens listing URL in new tab; secondary calls dismiss endpoint)
   - Footer metadata
7. Build `<MapControls>` (4 buttons stacked, fixed position).
8. Wire the map to receive listings as pins, selectedId from URL.

**Verification:** Browser opens to D1 with real data. Click a pin → URL updates → detail panel opens with that listing. Stage filter works. Pricing/dates render as French Swiss.

---

## Phase 4 — Slice 2: Desktop states (D2/D3/D4) (2 days)

Now that primitives + data layer exist, these compose quickly.

1. **D2 (Empty)** — render when `useListings()` returns 0 + scan never run. Reuse `<ListPanel>` shell, swap body.
2. **D3 (Scanning)** — add scan state to global store. Render `<ScanProgressCard>` overlay. Add SSE/polling for scan updates.
3. **D4 (Settings drawer)** — open from settings icon. Reuse Mantine's `<Drawer position="right" size={480}>` and theme it. Build form (zones chips, budget cards, source toggles). Connect save to `PATCH /profile`.

**Verification:** All four desktop states reachable from the running app.

---

## Phase 5 — Slice 3: Mobile (2 days)

Three screens reusing every primitive built so far.

1. Add a responsive breakpoint at 768px. Below that, render `<MobileShell>` instead of desktop layout.
2. **M1 (List)** — top bar (mobile variant), header, filter chips, photo-led rows, floating Carte pill.
3. **M2 (Map)** — full-bleed map, floating top bar, filter chips, right-rail controls, mini-card swipe deck, glass tab bar.
4. **M3 (Detail sheet)** — bottom sheet over map. Use Mantine `<Drawer position="bottom">` with snap points, or a library like `react-spring-bottom-sheet`.

**Verification:** Test at 390×844 in Chrome devtools. All three screens reachable via tab bar. Selection state persists across tab switches.

---

## Phase 6 — Polish (1–2 days)

1. Loading skeletons (see [06-interactions.md §11](./06-interactions.md)).
2. Empty/error states across all screens.
3. Animations (mount transitions, panel slide-in/out).
4. Keyboard shortcuts (j/k navigation, /, Esc, s, ,, 1–5).
5. Dark mode (deferred — designs not yet made; add a TODO).
6. Accessibility:
   - Ensure all pills/buttons have `aria-label`s
   - Stat grid is decorative — don't break it into a `<table>`; use `aria-hidden="true"` on the icons and put the labels first
   - Status pills: include the status text, not just color
   - Map: pins should be focusable and respond to Enter/Space
   - Test with VoiceOver / NVDA at least once
7. Performance:
   - Virtualize the list panel rows if listings ever exceed ~50
   - Debounce list panel scroll events
   - Map: cluster pins at low zoom (use `Supercluster` or MapLibre's built-in clustering)

---

## Phase 7 — QA + ship (½ day)

1. Cross-browser: Chrome, Safari, Firefox. Watch `backdrop-filter` in Safari (needs `-webkit-` prefix — already in spec).
2. Photo URLs: confirm CDN serves `?w=900&q=70&auto=format` or equivalent.
3. Lighthouse pass (perf > 80, a11y > 95).
4. Production preview link to designer for sign-off against this handoff.

---

## Total estimate

**~10–12 working days for a single developer** familiar with the codebase, Mantine, and React. A team of two can parallelize Phase 3/4 against Phase 5 to cut to ~7 days.

---

## What to defer (don't block ship on these)

- **Triage swipe screen** (designed earlier in the prototype, not part of V2). Can ship without; the existing list/detail can take the place.
- **Dark mode** — not designed yet, requires a separate token pass.
- **Off-market workflow** — `Retraites Populaires` listings have a `stage: "off_market"` flag. Treat as a normal listing for V1 of the redesign; differentiated UI later.
- **Multi-profile switcher** — assume single user for now. Add affordance only when multi-tenancy is a real requirement.

---

## Reference index

- [README](./README.md) — overview
- [01 — Tokens](./01-design-tokens.md)
- [02 — Primitives](./02-primitives.md)
- [03 — Desktop screens](./03-screens-desktop.md)
- [04 — Mobile screens](./04-screens-mobile.md)
- [05 — Data model](./05-data-model.md)
- [06 — Interactions](./06-interactions.md)
- 07 — You are here

Source files in `design-files/`:
- `Atlas Redesign.html` — entry; open this in a browser to see all 7 screens
- `v2-refined.jsx` — the V2 designs
- `atlas-shared.jsx` — shared atoms (map, photo, status pill, source mono)
- `atlas-icons.jsx` — icon set
- `atlas-data.jsx` — seed data matching the data model

---

**Final note:** when stuck, the prototype is the source of truth. Reproduce its pixel measurements, then deviate only when the codebase forces it. The values in these docs are extracted **from** the prototype — they're not aspirational.
