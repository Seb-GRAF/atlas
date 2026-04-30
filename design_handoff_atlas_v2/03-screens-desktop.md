# 03 — Desktop Screens

Four screens. All share the same 1280×880 canvas, the same map background, and the same primitives. They differ only in which floating panels are present and what's in them.

For each screen below: layout grid → what's in each region → reference file/lines.

---

## D1 — Desktop · Default

The hero state. User is browsing listings; one is selected; detail panel is open on the right.

**Reference:** `design-files/v2-refined.jsx` → `V2RefinedDesktop`

### Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│  [Logo] [Search]                              [Stages] [⚙] [● Scanner]    │  ← top bar (top: 16, L/R: 16)
│                                                                            │
│  ┌──────────────┐                                  ┌────────────────────┐ │
│  │              │                                  │                    │ │
│  │  LIST PANEL  │              MAP                 │   DETAIL PANEL     │ │
│  │  (380 wide)  │   (full canvas, behind all)     │   (400 wide)       │ │
│  │              │                                  │                    │ │
│  │              │              [+/−/⌖/⊞]          │                    │ │
│  │              │              (right: 432)        │                    │ │
│  └──────────────┘                                  └────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

### Top bar (z-index 5)

A horizontal flex row at `top: 16, left: 16, right: 16`, gap `10`:

1. **Logo pill** — `GlassPill`. Contains: 22×22 dark square with white "A" mono, "Atlas" wordmark (500), 1×16 vertical hairline, profile dropdown ("Vevey & Riviera ▾").
2. **Search pill** — `GlassPill` with `padding: 6px 12px`, `flex: 1, max-width: 380`. Contains: search icon (15px, stroke 1.6), placeholder "Vevey, Lutry, Pully…" in ink-3, mono "/" key hint at right (11px, hairline border, radius 4).
3. Spacer (`flex: 1`).
4. **Stage segmented control** — `GlassPill` with `padding: 4, gap: 0`. Inside: 3 buttons (`À trier`, `En cours`, `Visites`), each `padding: 6px 12px, font 12.5/500, radius 999`. Active button: dark bg, white text. Each shows count: e.g. "À trier `3`" with the count in mono 10.5px, opacity 0.6.
5. **Settings icon button** — `GlassPill, padding: 8px 10px`, settings icon 15px.
6. **Primary "Scanner" button** — dark bg, padding `8px 14px`, radius 999. Inside: 6×6 status dot (green when idle: `oklch(78% 0.12 150)`, ember when scanning + pulse animation), then "Scanner" or "Scan en cours…".

### List panel (z-index 4)

Glass panel, `position: absolute; left: 16; top: 76; bottom: 16; width: 380; border-radius: 18`.

```
┌───────────────────────────────────────┐
│ VEVEY · LA TOUR-DE-PEILZ · MONTREUX +4│  ← eyebrow zones (11/500/.12em uppercase, ink-3)
│ 6 appartements             Trier ▾    │  ← H L (18/500) on left, sort dropdown on right
│                            maj. il y a 12 min  ← 10.5px ink-3 below sort
├───────────────────────────────────────┤  ← Hairline
│ ┌──┐ VEVEY · NOUVEAU                  │
│ │📷│ Appartement de 3.5 pces avec…    │  ← list card (see 02-primitives §13)
│ └──┘ 3.5 pces · 78 m² · 32 min        │
│      2 180 CHF             il y a 2 h │
│ ┌──┐ LA TOUR-DE-PEILZ · NOUVEAU       │
│ │📷│ Lumineux 4 pces avec vue lac     │
│ ...                                    │
└───────────────────────────────────────┘
```

Header padding: `16 18 12`. Below the hairline, the row container has `padding: 8 8 16` and `overflow-y: auto`. Selected row (one of them) has white bg + selection shadow.

### Detail panel (z-index 4)

Glass panel, `position: absolute; right: 16; top: 76; bottom: 16; width: 400; border-radius: 18`.

```
┌────────────────────────────────────────┐
│ ┌────────────────────────────────────┐ │  padding: 14
│ │                                    │ │
│ │      LISTING PHOTO (4:3)        ❤  │ │  PhotoFrame, radius 14; ❤ button absolute top-right
│ │                                    │ │
│ └────────────────────────────────────┘ │
│                                        │
│ LA TOUR-DE-PEILZ · flatfox     2 680   │  eyebrow + hero price (mono 24/500)
│ Lumineux 4 pces avec vue lac           │  H M (17.5/500/-0.018)
│ Ch. de la Rouvenettaz 6                │  12.5 ink-3
│                                        │
│ ┌─────────┬─────────┬──────────────┐   │  stat grid: 3 cells
│ │🛏 PIÈCES│⬜ SURFACE│🚗 TRAJET     │   │  hairline gaps via box-shadow trick
│ │  4      │ 96 m²   │ 22 min       │   │  mono.tnum 14/500
│ └─────────┴─────────┴──────────────┘   │
│ ────                                   │  Hairline
│ [Ff] flatfox.ch          [À trier]     │  source mono + name + status pill
│                                        │
│ STATUT                                 │  eyebrow
│ [À trier|À contacter|Visite|Dossier]   │  segmented control (4 cols)
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ Notes — prochains pas, contact…    │ │  textarea
│ └────────────────────────────────────┘ │
│                                        │
│ [↗ Ouvrir l'annonce]   [✕ Écarter]     │  primary + secondary, grid 1fr auto
│                                        │
│ Vu il y a 5 h          MAJ il y a 12m  │  footer 11px ink-3, space-between
└────────────────────────────────────────┘
```

**Stat grid trick.** Three cells with hairline dividers between them, no outer border. Use:

```css
.statGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;                        /* gaps reveal the bg */
  background: var(--atlas-line);   /* the hairlines */
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 0 0 1px var(--atlas-line);  /* outer hairline */
}
.statCell { background: var(--atlas-paper-2); padding: 10px 12px; }
```

### Map controls

Vertical stack at `right: 432, bottom: 24`. See [02-primitives.md §8](./02-primitives.md).

### Map content

- All 6 listings rendered as pins
- Selected pin: `ff-44102` (La Tour-de-Peilz, 2 680)
- Workplace pin: EPFL, Lausanne (~46.520, 6.567)

---

## D2 — Desktop · Empty state

Pre-scan welcome. Map is empty (no pins, just the map). List panel is replaced by an empty-state card.

**Reference:** `V2EmptyState`

### What changes from D1

- List panel header shows "0 appartement" instead of count
- List panel body becomes a centered empty-state with:
  - 56×56 ember-tinted tile (bg `var(--atlas-ember-2)`, ember icon `Sparkle`, radius 16)
  - Heading "Aucune annonce pour l'instant" (16/500/-0.015em)
  - Body copy "Lance un premier scan sur les **{N} communes** de ton profil — ça prend généralement moins d'une minute." (13/400, ink-2, line-height 1.55, max-width 280, centered)
  - Primary CTA "Lancer un scan" with green status dot
  - Source roster footer: "Sources actives · immobilier.ch, flatfox.ch, naef.ch +3" (11.5/400, ink-3)
- List panel footer: small settings link "Régler les zones, le budget et les sources" + chevron, padded `12 18`
- Map: no pins, just the workplace pin
- Floating hint over the map (centered): glass pill with compass icon + "Carte centrée sur Vevey" (10×16 px, fontsize 13)
- Detail panel: not rendered

---

## D3 — Desktop · Scanning

Scan in progress. Listings already start populating; a progress card overlays the map showing per-source status.

**Reference:** `V2ScanningState`

### What changes from D1

- Top bar Scanner button shows ember pulsing dot + "Scan en cours…"
- List panel header has a progress sub-row below the hairline:
  - 14×14 spinner (border 2px transparent, top-color ember, `v2spin` 1s linear infinite)
  - "Recherche · flatfox.ch" (12.5px ink-2)
  - mono "3/6" right-aligned (ink-3)
- A **Scan progress card** appears at `top: 96, left: 432, width: 360`:

```
┌──────────────────────────────────────┐
│ ⟳ Scan en cours          3 / 6 sources │  18×18 spinner + heading + mono count
│                                      │
│ ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  (52% bar)     │  4px height, ember fill, soft track
│                                      │
│ ✓ immobilier.ch         3 nouvelles  │  14×14 dots: done=good fg, run=ember, queue=line
│ ● flatfox.ch            en cours     │
│ ● naef.ch               en cours     │
│ ○ bernard-nicod         en file      │
│ ○ Retraites Pop.        en file      │
│ ○ anibis.ch             en file      │
│                                      │
│ [Annuler]  [Continuer en arrière-plan] │  two equal buttons
└──────────────────────────────────────┘
```

- Source dot states:
  - **done**: 14×14 circle, bg `var(--atlas-good)`, white check icon (9px stroke 2.5)
  - **running**: bg `var(--atlas-ember-2)` (tinted), inner 5×5 ember dot pulsing
  - **queued**: bg `var(--atlas-line)`, no inner dot
- Right-side text: done shows count in mono+good; running/queued in plain text ink-3

---

## D4 — Desktop · Settings drawer

Profile editor. Map dimmed in the background; list panel still visible; detail panel is replaced by a wider drawer.

**Reference:** `V2DetailDrawer`

### What changes from D1

- A 32% dark scrim covers the map: `position: absolute; inset: 0; background: rgba(22,20,15,.32); backdrop-filter: blur(2px); z-index: 3`
- Detail panel is replaced by a **Settings drawer**, `width: 480` (wider than detail), `top: 16; right: 16; bottom: 16; z-index: 6`:

```
┌────────────────────────────────────────────┐
│ PROFIL                              [✕]    │  eyebrow + close button (32×32 round)
│ Vevey & Riviera                            │  H L
├────────────────────────────────────────────┤  Hairline
│ TITRE                                      │  field label (eyebrow)
│ ┌────────────────────────────────────────┐ │
│ │ Vevey & Riviera                        │ │  input
│ └────────────────────────────────────────┘ │
│                                            │
│ LIEU DE TRAVAIL                            │
│ ┌────────────────────────────────────────┐ │
│ │ ⌖ EPFL, Lausanne                       │ │  display-only with icon
│ └────────────────────────────────────────┘ │
│                                            │
│ ZONES SURVEILLÉES                          │
│ [Vevey ✕] [La Tour-de-Peilz ✕] [Montreux ✕]│  removable chips
│ [Lutry ✕] [Pully ✕] [Cully ✕] [Blonay ✕]   │
│ [+ Ajouter]                                │  outlined "add" chip
│                                            │
│ BUDGET                                     │
│ ┌──────────┬──────────┐                    │
│ │LOYER MAX │ PLAFOND  │                    │  two cards
│ │2 500 CHF │3 000 CHF │                    │  mono 16/500
│ └──────────┴──────────┘                    │
│                                            │
│ SOURCES                                    │
│ [Im] immobilier.ch              [●━○]      │  source mono + name + toggle
│ [Ff] flatfox.ch                 [●━○]      │
│ [Na] naef.ch                    [●━○]      │
│ [Bn] bernard-nicod              [●━○]      │
│ [Rp] Retraites Populaires       [●━○]      │
│ [An] anibis.ch                  [○━●]      │  toggle off (last one)
├────────────────────────────────────────────┤  Hairline
│                  [Annuler]  [Enregistrer]  │  ghost + primary, right-aligned
└────────────────────────────────────────────┘
```

Drawer body: `padding: 18 20`, `display: flex; flex-direction: column; gap: 22`. Each field group has an eyebrow label (11/500/.08em uppercase, ink-3, margin-bottom 6) above the control.

**Removable chip:** `padding: 5px 4px 5px 10px` (less right pad to make room for the X), bg `var(--atlas-soft)`, font 12.5, with an 18×18 round X-button at the end (bg `rgba(22,20,15,.06)`, X icon 10px stroke 2).

**Add chip:** transparent bg, `inset 0 0 0 1px var(--atlas-line)` (hairline border), color `--atlas-ink-2`, plus icon + "Ajouter".

**Source row:** `padding: 8 4`, gap 10, source mono dim variant, name 13px, toggle right-aligned.

**Footer:** `padding: 12 20`, ghost "Annuler" (transparent bg, ink-2) + primary "Enregistrer" (dark bg, white).

---

## Z-index map

```
1   map
3   map dim scrim (D4 only)
4   list panel, detail panel
4   scan progress card (D3)
5   top bar
6   settings drawer (D4)
```

---

Next: [04-screens-mobile.md](./04-screens-mobile.md)
