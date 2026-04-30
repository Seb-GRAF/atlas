# Atlas — V2 Redesign Handoff

A complete implementation guide for the Atlas dashboard redesign (V2: map-hero direction, refined). Hand this folder to Claude Code or any developer to recreate the design in your real codebase.

---

## 1. About this handoff

The files in `design-files/` are **design references created in HTML/React with inline styles** — high-fidelity prototypes showing intended look and behavior. They are **not production code to copy directly.** Your task is to recreate these designs in the Atlas codebase using its established patterns and libraries (Mantine, your real router, your real data layer, your real map provider).

Treat the JSX as a **visual specification**, not a starting point. The token values, spacing, typography, photo treatment, hairline patterns, and component composition are the source of truth. The implementation details (`window.foo` globals, inline `style={{}}`, hardcoded data) are scaffolding that exists only to make the prototype run in a single HTML file.

## 2. Fidelity

**High-fidelity.** All colors, typography, spacing, radii, and interactions are intentional. Recreate pixel-perfectly using the codebase's existing libraries — but feel free to wrap them in Mantine primitives (`Paper`, `Group`, `Stack`, `SegmentedControl`, `Drawer`) where the abstraction matches.

## 3. What's in this handoff

```
design_handoff_atlas_v2/
├── README.md                       ← you are here (overview + roadmap)
├── 01-design-tokens.md             ← every color, font, radius, shadow
├── 02-primitives.md                ← shared atoms (GlassPanel, StatusPill, …)
├── 03-screens-desktop.md           ← desktop default, empty, scanning, settings drawer
├── 04-screens-mobile.md            ← mobile list, map, detail sheet
├── 05-data-model.md                ← Listing/Profile/Stage TypeScript types
├── 06-interactions.md              ← state machines, transitions, animations
├── 07-implementation-plan.md       ← suggested build order
└── design-files/                   ← original HTML/React prototypes
    ├── Atlas Redesign.html         ← entry point — open this to see all designs
    ├── atlas-data.jsx              ← seed data (mirrors expected API shape)
    ├── atlas-shared.jsx            ← shared atoms (map, photo carousel, status pill)
    ├── atlas-icons.jsx             ← custom 1.5px-stroke icon set
    ├── v2-refined.jsx              ← the V2 designs themselves (all 7 screens)
    ├── atlas-app.jsx               ← canvas app shell
    └── design-canvas.jsx           ← presentation-only artboard wrapper (ignore)
```

**Read order for an implementer:** README → 01-tokens → 02-primitives → 03/04-screens → 05-data → 06-interactions → 07-plan. Reference `design-files/v2-refined.jsx` whenever a doc says "see the source."

## 4. What we're building

A redesign of the Atlas apartment-tracker dashboard — a tool that scrapes Swiss listing sites (immobilier.ch, flatfox.ch, naef.ch, …) and surfaces them in a triage workflow. The redesign moves from a Mantine-default kanban-and-cards layout to a **map-hero layout** in the spirit of Airbnb / Apple Maps / Zillow:

- A full-bleed map fills the canvas
- A glass list panel floats on the left
- A glass detail panel floats on the right when a listing is selected
- A capsule top bar floats over the map (logo, search, stage filter, scan CTA)
- Mobile collapses to three primary screens: list / map / detail bottom sheet

Seven screens are designed:

| # | Screen | Purpose |
|---|---|---|
| D1 | Desktop · Default | Browse + select + act on listings |
| D2 | Desktop · Empty | First-run / no-results state with CTA to scan |
| D3 | Desktop · Scanning | Live progress while sources are being scraped |
| D4 | Desktop · Settings drawer | Edit profile, zones, budget, source toggles |
| M1 | Mobile · List | Photo-led row list, status filter chips |
| M2 | Mobile · Map | Full-bleed map with mini-card preview at bottom |
| M3 | Mobile · Detail | Bottom sheet with listing details |

## 5. The design system in one paragraph

Warm off-white background (`#f6f3ee`) instead of cold gray. Near-black ink (`#16140f`) instead of true black. **One** accent — a quiet ember orange — used sparingly for "new" markers, the primary CTA pulse dot, and the "À trier" status. Hairlines (`#ecdfd4`) in place of borders. Geist for UI text, Geist Mono with tabular-nums for prices/stats. Glass panels (blur 24–28, saturation 170%) over the map. Photos with rounded corners (10–18px), no hover-lift, dot pagination. Custom 1.5px-stroke icon set replaces Tabler/heroicons defaults. Status pills neutral by default, single tonal variant per state.

## 6. Suggested implementation plan (TL;DR)

1. **Tokens** — add the 14 design tokens to your Mantine theme (or `:root` CSS vars). See [01-design-tokens.md](./01-design-tokens.md).
2. **Primitives** — port 5 atoms: `GlassPanel`, `GlassPill`, `Hairline`, `StatusPill`, `SourceMono`. See [02-primitives.md](./02-primitives.md).
3. **Map wrapper** — wrap MapLibre/Mapbox/Leaflet in `<AtlasMap pins selected onSelect>`. The mockup uses an SVG placeholder; production needs vector tiles styled to match the warm palette.
4. **Slice 1: Desktop default screen** — list panel, detail panel, top bar, map controls. Stand up the data layer here.
5. **Slice 2: Desktop states** — empty, scanning, settings drawer.
6. **Slice 3: Mobile** — three screens reusing the same primitives.
7. **Polish** — animations, loading skeletons, error states.

Full details in [07-implementation-plan.md](./07-implementation-plan.md).

## 7. Open questions for the implementer

These weren't fully nailed down in design and should be confirmed before build:

- **Map provider.** MapLibre + custom vector style is the closest visual match. Mapbox is faster to set up but billed. Leaflet + Carto tiles is the cheap path. Pick one; the wrapper API is identical.
- **Geist licensing.** We used Geist (free, OFL) via Google Fonts. Confirm that's fine, or pick the closest alternative already in your font stack.
- **Real status taxonomy.** The mockup uses 5 stages (`triage / active / visits / files / done`) inferred from your existing kanban. Confirm these match your DB enum; rename if needed.
- **Scan trigger.** The mockup shows a "Scanner" button that opens a progress card. Confirm the backend endpoint, expected duration, and whether scans run sync (foreground card) or async (queue + notification).
- **Authentication / multi-user.** The mockup is single-user. If Atlas is multi-tenant the profile drawer needs a "switch profile" affordance.

## 8. Files to reference live

To see the designs running, open `design-files/Atlas Redesign.html` in a browser served from the folder root (any static server — `npx serve design-files`). All seven screens are visible on a pannable design canvas; click any artboard to focus it fullscreen.

---

**Questions while building?** The original design conversation is the source of truth for intent. The token values and spacing are intentional — when in doubt, match the prototype's pixel measurements exactly, then deviate only if the codebase forces it.
