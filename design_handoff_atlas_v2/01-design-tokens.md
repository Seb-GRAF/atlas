# 01 — Design Tokens

Every value the design depends on. Add these to your Mantine theme override (or `:root` CSS variables). All other docs reference these names.

## 1. Color

### Surfaces (warm neutrals)

| Token | Value | Usage |
|---|---|---|
| `--atlas-bg` | `#f6f3ee` | Page background. Warm off-white, **not** gray. |
| `--atlas-paper` | `#ffffff` | Top surface — selected list rows, modal/drawer panels, photo backgrounds before image loads. |
| `--atlas-paper-2` | `#fbf9f5` | Slightly tinted paper — stat-grid cells, input backgrounds. |
| `--atlas-soft` | `#efe9e0` | Recessed surface — segmented-control track, source-mono background, secondary-button hover. |

### Ink

| Token | Value | Usage |
|---|---|---|
| `--atlas-ink` | `#16140f` | Primary text, primary button bg, dark pin. **Never `#000`.** |
| `--atlas-ink-2` | `#4a463e` | Secondary text — body copy on cards, secondary-button text. |
| `--atlas-ink-3` | `#8a847a` | Tertiary text — labels, eyebrow text, metadata, placeholder. |
| `--atlas-ink-4` | `#b8b1a4` | Quaternary — disabled, very low-emphasis dividers. |

### Lines (hairlines, **not** borders)

| Token | Value | Usage |
|---|---|---|
| `--atlas-line` | `#ecdfd4` | Primary hairline. Replaces `#e5e7eb`-style cool borders. |
| `--atlas-line-2` | `#f1e7dd` | Even softer — between list rows on mobile. |

### Accent (single ember)

There is **one** accent. Don't add more.

| Token | Value | Usage |
|---|---|---|
| `--atlas-ember` | `oklch(58% 0.13 38)` ≈ `#b76e3a` | "Nouveau" markers, primary-CTA pulse dot, "À trier" pill text, scan progress bar. |
| `--atlas-ember-2` | `oklch(96% 0.03 60)` ≈ `#f7eee0` | Tinted backgrounds for ember elements (empty-state illustration tile, ember pill bg). |

### Semantic (used at most once each)

| Token | Value | Usage |
|---|---|---|
| `--atlas-good` | `oklch(48% 0.10 155)` ≈ `#3d7a4a` | "Visite prévue", scan source "done". |
| `--atlas-bad` | `oklch(52% 0.14 25)` ≈ `#b14933` | "Refus régie", "Écartée". |
| `--atlas-info` | `oklch(50% 0.06 230)` ≈ `#4d6b87` | "Dossier à envoyer / envoyé". |

### Map fills (warm mode — used when AtlasMap mode="warm")

| Element | Value |
|---|---|
| Land | `#f0e8db` |
| Lake | `#cfd9d6` |
| Road outline | `#ebe0d0` |
| Road fill | `#fff8ee` |
| Green areas | `#d8dfc4` (55% opacity for park overlay) |

If you use a real vector map provider, style its `land`, `water`, `road-primary`, `road-secondary`, `landuse-park` layers to match these.

---

## 2. Typography

### Families

```
--sans: "Geist", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
--mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
```

Load both from Google Fonts: `https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap`.

### Weights actually used

- `400` — body
- `500` — UI labels, button text, headings, prices ← the workhorse weight
- `600` — almost never (status bar time, monogram label)
- `700` — never

The design has **no bold body text** — emphasis comes from size + ink color, not weight.

### Type scale

Sizes are in `px` because the layouts are fixed-canvas. In the real app convert to `rem` (16 = 1rem).

| Role | Size | Weight | Letter-spacing | Notes |
|---|---|---|---|---|
| Hero price (detail panel) | 24 | 500 | -0.015em | mono, tabular-nums |
| Heading L | 18 | 500 | -0.018em | "Vevey & Riviera", "6 appartements" |
| Heading M | 17.5 | 500 | -0.018em | listing title in detail panel |
| Body L | 14.5 | 500 | -0.012em | mobile listing title |
| Body | 13.5 | 500 | -0.01em | desktop listing title in card |
| Body S | 13 | 400 | normal | secondary labels, button text |
| Body XS | 12.5 | 400 | normal | metadata, source labels |
| Caption | 12 | 400 | normal | row metadata (rooms · m² · transit) |
| Eyebrow | 11 | 500 | 0.12em uppercase | "VEVEY & RIVIERA", "PIÈCES", section headers |
| Pin label / chip | 11–12 | 500 / 600 | -0.005em | mono on map pins |
| Stat value | 14 | 500 | normal | mono, tabular-nums, in stat-grid cells |
| Status pill | 11.5 | 500 | -0.005em | |
| Tiny mono / counter | 10.5 | 500 | normal | mono, used for source counts (3/6) |

### Number formatting

**All prices and stats use `font-variant-numeric: tabular-nums` and Geist Mono.** This is non-negotiable — it keeps prices aligned in lists.

Format prices with `Intl.NumberFormat("fr-CH")` then append a smaller "CHF" suffix in `--atlas-ink-3`:

```jsx
<span className="mono tnum" style={{ fontSize: 14, fontWeight: 500 }}>
  {new Intl.NumberFormat("fr-CH").format(2680)}
  <span style={{ fontSize: 11, color: "var(--atlas-ink-3)", marginLeft: 3 }}>CHF</span>
</span>
```

---

## 3. Spacing

Not on a strict 4/8 grid — the design uses these specific values. Common values in **bold**.

```
2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 32
```

Most-used: **8** (gaps within a row), **12** (gaps between rows), **16/18** (panel padding), **22** (drawer padding).

### Panel padding standards

| Panel | Padding |
|---|---|
| Glass list panel header | `16px 18px 12px` |
| Glass list panel rows | `8px 8px 16px` (8 horizontal so cards sit flush, 16 bottom for breathing room) |
| Glass detail panel | `0 18px 16px` (no top — photo flush) |
| Settings drawer | `18px 20px` |
| Scan progress card | `18px 20px` |
| Mobile bottom sheet | `8px 16px 0` |

### Layout grid (desktop default screen)

The whole canvas is **1280×880**. Within it:

- Top bar: `16px` from top, `16px` from L/R edges, height `~46px` (pills are 36-tall but content is 32)
- List panel: `left: 16, top: 76, bottom: 16, width: 380`
- Detail panel: `right: 16, top: 76, bottom: 16, width: 400`
- Map controls (zoom/compass): `right: 432, bottom: 24` (positioned just left of detail panel)

### Layout grid (mobile)

Frame is **390×844** (iPhone 14/15). Status bar 44px, home indicator 5px. Tab bar floats `bottom: 24` with 12px L/R margins.

---

## 4. Radii

| Token | Value | Usage |
|---|---|---|
| `--r-sm` | `8px` | small inputs, tight inner cells |
| `--r-md` | `12px` | photo thumbnails (small), stat-grid container, scan-source dots |
| (none) | `10px` | inputs, source-monogram (used a lot — consider adding) |
| (none) | `14px` | photo carousel (large), list-card hit area |
| `--r-lg` | `18px` | glass panels (list panel, detail panel, drawer) |
| `--r-pill` | `999px` | pills, buttons, segmented controls, glass pills |
| (mobile sheet) | `22px 22px 0 0` | bottom sheet top corners only |

Photo radii: small thumb in list = `10px`; detail hero = `14px`; mobile detail hero = `16px`.

---

## 5. Shadows / elevation

Shadows are **warm-tinted** (using `rgba(22,20,15, ...)` — not pure black). Three levels.

```css
/* Level 1 — floating chip / pill (top bar items, map controls) */
box-shadow:
  0 8px 22px -10px rgba(22,20,15,.18),
  0 0 0 1px rgba(22,20,15,.04);

/* Level 2 — glass panel (list, detail, scan card) */
box-shadow:
  0 22px 50px -22px rgba(22,20,15,.30),
  0 0 0 1px rgba(22,20,15,.04);

/* Level 3 — primary button on map / floating CTA */
box-shadow:
  0 12px 26px -10px rgba(22,20,15,.4);
```

The `0 0 0 1px rgba(22,20,15,.04)` is a **hairline halo** — it gives the panel a crisp edge without a full border. Keep it.

### Map-pin shadow (selected vs. unselected)

```css
/* Unselected pin */
box-shadow:
  0 4px 14px rgba(22,20,15,.16),
  0 0 0 1px rgba(22,20,15,.06);

/* Selected pin (dark) — 2px white halo */
box-shadow:
  0 8px 24px rgba(22,20,15,.28),
  0 0 0 2px #fff;
```

---

## 6. Glass / blur surfaces

Three blur intensities, all with saturation boost.

| Surface | Background | Backdrop filter |
|---|---|---|
| Glass pill (small) | `rgba(253,251,247,.88)` | `blur(16px) saturate(160%)` |
| Glass base (top bar) | `rgba(253,251,247,.86)` | `blur(24px) saturate(170%)` |
| Glass panel (list/detail) | `rgba(253,251,247,.94)` | `blur(28px) saturate(170%)` |

Always include `-webkit-backdrop-filter` for Safari. Always include the hairline halo shadow above.

---

## 7. Motion

| Use | Duration | Easing |
|---|---|---|
| Hover state changes (color, bg) | 140ms | `ease` |
| Pin selection scale (1 → 1.06) | 140ms | `ease` |
| Photo dot pagination width grow | 160ms | `ease` |
| Toggle thumb slide | 160ms | `ease` |
| Scan progress bar | (no transition — driven by state) | — |
| Scan source pulse | 1s infinite | `ease-in-out` |
| Spinner | 1s linear infinite | linear |
| Pulse dot on Scan CTA | 1.2s infinite | `ease-in-out` |

```css
@keyframes v2spin { to { transform: rotate(360deg); } }
@keyframes v2pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
```

**Never** use:
- `transition: all` (kills perf, animates unintended properties)
- Hover lift on photos (explicit pet peeve — photos do **not** scale or translate on hover; only the action buttons fade in)
- Easing curves longer than 200ms for pointer interactions (feels laggy)

---

## 8. Iconography

Custom 1.5px-stroke icon set in `design-files/atlas-icons.jsx`. **Don't use Tabler or Heroicons defaults** — their stroke weight is 2px which reads heavier than this design wants.

If you can't keep the custom set, the closest match is:
- **Lucide** with `strokeWidth={1.5}` (good fallback)
- **Phosphor "Light"** weight (also good)

Icons used (all from `Icons.*` in atlas-icons.jsx): `Search, Filter, ChevronDown, Chevron, Settings, Heart, External, Close, X, Plus, Check, Pin, Bed, Square, Drive, Train, Compass, Layers, Map, List, Bolt, Sparkle, More, Photo`.

---

## 9. Tabular numerals — required

Every number in the UI (price, m², distance, count) **must** use:

```css
font-family: var(--mono);
font-variant-numeric: tabular-nums;
font-feature-settings: "tnum" 1;
```

The `.mono.tnum` helper classes in `Atlas Redesign.html` do exactly this. In the real app, expose them as a `<Mono>` or `<Tabular>` component, or apply to `[data-mono]`.
