# 02 — Primitives

The five components every screen depends on. Build these once, then composition becomes ~150 lines per screen.

All examples assume Mantine + CSS modules or styled-components. Adapt as needed.

---

## 1. `<GlassPanel>`

The blurred floating cards (list panel, detail panel, settings drawer, scan progress).

### Spec

| Prop | Default |
|---|---|
| Background | `rgba(253,251,247,.94)` |
| Backdrop filter | `blur(28px) saturate(170%)` |
| Border radius | `18px` |
| Shadow | `0 22px 50px -22px rgba(22,20,15,.30), 0 0 0 1px rgba(22,20,15,.04)` |

Variants: `panel` (default — list/detail), `card` (the scan progress card — same blur, smaller radius/shadow).

### Reference

```jsx
function GlassPanel({ children, ...rest }) {
  return (
    <div style={{
      background: "rgba(253,251,247,.94)",
      backdropFilter: "blur(28px) saturate(170%)",
      WebkitBackdropFilter: "blur(28px) saturate(170%)",
      borderRadius: 18,
      boxShadow: "0 22px 50px -22px rgba(22,20,15,.30), 0 0 0 1px rgba(22,20,15,.04)",
    }} {...rest}>{children}</div>
  );
}
```

In Mantine: extend `<Paper>` with these style props.

---

## 2. `<GlassPill>`

Small floating control — top-bar items, map controls, mobile floating buttons.

### Spec

| Prop | Default |
|---|---|
| Background | `rgba(253,251,247,.88)` |
| Backdrop filter | `blur(16px) saturate(160%)` |
| Padding | `8px 12px` (some variants `6px 12px` or `8px 10px` for icon-only) |
| Border radius | `999px` |
| Shadow | `0 8px 22px -10px rgba(22,20,15,.18), 0 0 0 1px rgba(22,20,15,.04)` |
| Font size | `13px` |
| Color | `var(--atlas-ink)` |
| Display | `inline-flex; align-items:center; gap:8px;` |

### Reference

```jsx
function GlassPill({ children, padding = "8px 12px", ...rest }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding, borderRadius: 999,
      background: "rgba(253,251,247,.88)",
      backdropFilter: "blur(16px) saturate(160%)",
      WebkitBackdropFilter: "blur(16px) saturate(160%)",
      boxShadow: "0 8px 22px -10px rgba(22,20,15,.18), 0 0 0 1px rgba(22,20,15,.04)",
      fontSize: 13, color: "var(--atlas-ink)",
    }} {...rest}>{children}</div>
  );
}
```

---

## 3. `<Hairline>`

Replaces every horizontal border. **Always** use a `Hairline` instead of `border-bottom: 1px solid #ccc`.

```jsx
function Hairline({ vertical = false }) {
  return (
    <div style={{
      background: "var(--atlas-line)",
      width: vertical ? 1 : "100%",
      height: vertical ? "100%" : 1,
    }}/>
  );
}
```

---

## 4. `<StatusPill>`

Small status indicator with a colored dot. Neutral by default; one tonal variant per status.

### Status → tone mapping

| Status (FR) | Tone | Bg | Fg |
|---|---|---|---|
| À trier | `ember` | `--atlas-ember-2` | `--atlas-ember` |
| À contacter | `neutral` | `--atlas-soft` | `--atlas-ink-2` |
| Visite prévue | `good` | `oklch(96% 0.04 155)` | `--atlas-good` |
| Dossier à envoyer / envoyé | `info` | `oklch(96% 0.02 230)` | `--atlas-info` |
| Refus régie / Écartée | `bad` | `oklch(96% 0.03 25)` | `--atlas-bad` |
| anything else | `neutral` | `--atlas-soft` | `--atlas-ink-2` |

### Spec

- Padding `3px 9px`, radius `999`, font `11.5/500`
- Leading dot: 5×5 circle, same color as text, `opacity:0.4` for neutral, `1` for tonal
- `display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;`

See `design-files/atlas-shared.jsx` lines ~140–165 for the full implementation.

---

## 5. `<SourceMono>`

Two-letter monogram representing the listing source — replaces colored chip-soup with a quiet typographic mark.

### Glyph table

| Source | Glyph |
|---|---|
| `immobilier.ch` | `Im` |
| `flatfox.ch` | `Ff` |
| `naef.ch` | `Na` |
| `bernard-nicod` | `Bn` |
| `Retraites Populaires` | `Rp` |
| `anibis.ch` | `An` |
| (fallback) | `··` |

### Spec

- Square: 22×22 default, 26 in larger contexts
- Border radius: `6px`
- Background: `var(--atlas-soft)` (or transparent + 1px hairline border for "dim" variant)
- Color: `var(--atlas-ink-2)`
- Font: Geist Mono, 10px, weight 500
- Center-aligned

```jsx
const SOURCE_GLYPH = { /* table above */ };

function SourceMono({ source, size = 22, dim = false }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size, height: size, borderRadius: 6,
      background: dim ? "transparent" : "var(--atlas-soft)",
      border: dim ? "1px solid var(--atlas-line)" : "none",
      color: "var(--atlas-ink-2)",
      fontFamily: "var(--mono)",
      fontSize: size <= 22 ? 10 : 11,
      fontWeight: 500,
    }}>{SOURCE_GLYPH[source] || "··"}</span>
  );
}
```

---

## 6. `<PhotoFrame>` (carousel)

Used in detail panel, list rows, mobile detail. **Critical: no hover lift.** The image does not scale on hover. Only nav arrows fade in.

### Spec

- Aspect ratio prop (default `4/3`)
- Border radius prop (default `10`)
- Background `var(--atlas-soft)` (visible while loading)
- `overflow: hidden`
- Cursor: `zoom-in` if `onOpen` provided, else `default`

### Overlays

- **Photo count badge** top-right (only if >1 image): `rgba(22,20,15,.55)` bg, `blur(6px)`, mono font 11px white, 3px 8px padding, radius 999. Shows `📷 1/3`.
- **Dot pagination** bottom-center: dots are 4×4 circles, `rgba(255,255,255,.55)` inactive, current is 14×4 pill `rgba(255,255,255,.95)`. 4px gap. `transition: width 160ms ease`.
- **Nav arrows** (visible on hover only, only if >1 image): 28×28 circles, `rgba(255,255,255,.92)` bg, dark icon, shadow `0 4px 12px rgba(0,0,0,.16)`, positioned 8px from L/R edge, vertically centered.

See `design-files/atlas-shared.jsx` `PhotoFrame` lines ~190–245.

---

## 7. `<AtlasMap>` — the big one

The map is the design's hero. The mockup uses an SVG placeholder; production needs real map tiles.

### Recommended provider: MapLibre GL + custom vector style

Why: free, open-source, supports custom styling, matches the warm-toned Apple/Airbnb feel best.

### Required wrapper API

```ts
type Pin = {
  id: string;
  lat: number;
  lon: number;
  totalChf: number;   // shown on the pin itself
};

type AtlasMapProps = {
  pins: Pin[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  showWorkplace?: boolean;  // default true — shows the dark "Travail · EPFL" pin
  workplaceLabel?: string;  // default "Travail · EPFL"
  workplace?: { lat: number; lon: number };
  initialBounds?: [[number, number], [number, number]];
  mode?: "warm" | "cool";   // default "warm"
};
```

### Pin styling (this is the visual signature — get it right)

- **Default pin**: white background, dark ink text, mono font 12px weight 600, padding `5px 10px`, radius `999`, shadow `0 4px 14px rgba(22,20,15,.16), 0 0 0 1px rgba(22,20,15,.06)`. Shows the listing price formatted with `Intl.NumberFormat("fr-CH")`.
- **Selected pin**: ink background (`#16140f`), white text, scale `1.06`, shadow `0 8px 24px rgba(22,20,15,.28), 0 0 0 2px #fff` (the 2px white halo is the trick — it makes it pop on any backdrop).
- Transition `transform 140ms, background 140ms, color 140ms, box-shadow 140ms ease`.
- White-space: `nowrap`, cursor: `pointer`.

### Workplace pin

A separate dark pill positioned at the workplace coordinates — **non-interactive** (pointer-events: none). Shows `Travail · EPFL` (or whatever label). Positioned with `transform: translate(-50%, -100%)` so it points down at its anchor. Bg `#16140f`, white text, padding `4px 8px`, radius `999`, font 11/500.

### Map style — values to feed your provider

These are the warm-mode fills the mockup uses; replicate them in the vector style:

| Layer | Hex |
|---|---|
| Background / land | `#f0e8db` |
| Water (lake) | `#cfd9d6` |
| Park / green | `#d8dfc4` |
| Major road outline | `#ebe0d0` |
| Major road fill | `#fff8ee` |
| Minor road | `#fff8ee` (very thin) |
| Labels | hide at low zoom; if shown, `--atlas-ink-2` for places, `--atlas-ink-3` for streets |

Don't show country/region labels at the dashboard zoom level — they add noise.

### Interaction

- Click on pin → `onSelect(id)`
- Click on map background → optional: deselect (`onSelect(null)`)
- Pan/zoom: standard provider gestures
- Two-finger zoom on mobile only — disable scroll-wheel zoom on desktop without modifier (it hijacks page scroll)

---

## 8. Map controls (zoom, compass, layers)

A vertical stack of 4 buttons, positioned `right: 432, bottom: 24` on desktop (clears the detail panel) or in the mobile right-rail.

### Spec per button

- 38×38 (desktop) / 40×40 (mobile)
- Border radius `12`
- Background `rgba(255,255,255,.94)`
- Backdrop filter `blur(12px)`
- Shadow `0 8px 18px -10px rgba(22,20,15,.25), 0 0 0 1px rgba(22,20,15,.04)`
- Center the icon (15–16px size, 1.6 stroke)

Buttons (top to bottom): `+`, `−`, `Compass` (icon), `Layers` (icon). The `+/−` use mono font 16px instead of an icon — that's intentional.

---

## 9. Buttons

### Primary (dark on light)

```css
background: #16140f;
color: #ffffff;
border-radius: 999px;
padding: 10px 18px;          /* mobile primary action 0 18 with 46px row height */
font-size: 13px;
font-weight: 500;
box-shadow: 0 12px 26px -10px rgba(22,20,15,.4);
display: inline-flex;
align-items: center;
gap: 8px;
```

Variant: "Scanner" CTA includes a 6×6 status dot before the text.

### Secondary (paper on light)

```css
background: var(--atlas-paper);
box-shadow: inset 0 0 0 1px var(--atlas-line);  /* hairline as border */
color: var(--atlas-ink-2);
border-radius: 999px;
padding: 10px 14px;
font-size: 13px;
font-weight: 500;
```

### Ghost / icon button

- Round 32–34 px, bg `var(--atlas-soft)` or transparent, no shadow
- Icon centered

---

## 10. Inputs / textarea

```css
padding: 10px 12px;
border-radius: 10px;
background: var(--atlas-paper);
box-shadow: inset 0 0 0 1px var(--atlas-line);
font-family: var(--sans);
font-size: 13.5px;
color: var(--atlas-ink);
outline: none;
```

Focus state: bump the inset shadow to `inset 0 0 0 1.5px var(--atlas-ink)` (no glow halo).

Textarea: same + `resize: none; min-height: 70px;`.

---

## 11. Segmented control

Used for the status switcher in the detail panel and stage filter in top bar.

### Spec

- Outer track: `padding: 3px; border-radius: 10px; background: var(--atlas-soft);`
- Items: `padding: 6px 8px; border-radius: 8px; font-size: 11.5/500;`
- Active item: `background: #16140f; color: #fff;`
- Inactive: `background: transparent; color: var(--atlas-ink-2);`
- Equal-width via `display: grid; grid-template-columns: repeat(N, 1fr); gap: 4px`

Mantine's `<SegmentedControl>` is a good base — override colors via theme.

---

## 12. Toggle switch

```jsx
<span style={{
  width: 32, height: 18, borderRadius: 999, padding: 2,
  background: on ? "#16140f" : "rgba(22,20,15,.18)",
  display: "inline-flex", alignItems: "center",
}}>
  <span style={{
    width: 14, height: 14, borderRadius: 999, background: "#fff",
    marginLeft: on ? 14 : 0, transition: "margin 160ms ease",
  }}/>
</span>
```

Mantine's `<Switch>` works if you override the colors and sizes.

---

## 13. List card (desktop list panel row)

The single hardest-to-eyeball component — exact spec:

```
Outer button:
  display: block; width: 100%; text-align: left;
  padding: 8px;
  border-radius: 14px;
  background: selected ? #fff : transparent;
  box-shadow (selected): 0 6px 18px -10px rgba(22,20,15,.25), 0 0 0 1px rgba(22,20,15,.06);
  transition: background 140ms, box-shadow 140ms;

Inner grid:
  display: grid;
  grid-template-columns: 92px 1fr;
  gap: 12px;
  align-items: stretch;

Photo (left column):
  aspect-ratio: 1;
  border-radius: 10px;
  background: cover image;
  Pin overlay (if pinned): absolute top:6, left:6, 22×22 circle, ink bg, white pin icon

Right column (vertical stack, gap 3):
  Eyebrow row (gap 6, align-center):
    AREA in eyebrow style (11/500/.06em uppercase, ink-3)
    if isNew: 4×4 ember dot + "NOUVEAU" label (11px ember, .06em uppercase)

  Title: 13.5/500/-0.01em, ellipsis, single line

  Meta: 12px ink-3 — "{rooms} pces · {surfaceM2} m² · {transitText}"

  Bottom row (gap 8, align-center, margin-top 4):
    Price: mono.tnum 14/500
    "CHF" suffix: 11px ink-3
    spacer (flex 1)
    Published label: 11px ink-3
```

---

## Naming convention

Suggest: `<Atlas*>` prefix in the real codebase to avoid collision with Mantine — `<AtlasGlassPanel>`, `<AtlasStatusPill>`, etc. Or namespace under a folder: `src/atlas/components/`.

---

Next: see [03-screens-desktop.md](./03-screens-desktop.md) for how these compose into the four desktop screens.
