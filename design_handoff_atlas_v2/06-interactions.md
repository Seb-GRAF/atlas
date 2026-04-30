# 06 — Interactions & Behavior

State machines, transitions, and behavioral details that aren't obvious from a static screenshot.

---

## 1. Selection state machine (desktop)

```
        ┌──────────────────┐
        │ NOTHING SELECTED │ ←── close button on detail panel
        └─────────┬────────┘     ───── ESC key
                  │ click pin / list row
                  ▼
        ┌──────────────────┐
        │ LISTING SELECTED │ ↔ pin click (other) / list row click (other)
        └──────────────────┘
                  │ click outside (map bg)
                  ▼
        ┌──────────────────┐
        │ NOTHING SELECTED │
        └──────────────────┘
```

- On select: detail panel slides in from right (140ms ease, opacity + 12px translateX). On deselect: reverse.
- Map auto-pans to center the selected pin if it's near a panel edge (offset ≈ 200px in viewport).
- Keyboard: `j/k` or `↓/↑` to navigate list selection; `Enter` no-op (already selected); `Esc` deselects.

## 2. Stage filter

- Clicking a stage segment in the top bar refilters the list panel and map pins instantly (no loading state if cached).
- The selected listing **persists** across stage switches if it's still in scope; otherwise it deselects silently.
- URL syncs: `?stage=triage`.

## 3. Scan flow (D2 → D3 → back to D1)

```
Scanner button click
  → POST /scan
  → top-bar dot turns ember + pulses
  → list panel adds spinner sub-row
  → scan progress card appears at top:96/left:432 (slides up 8px, opacity)
  → as sources complete, listings stream into the list

User options during scan:
  • "Annuler"            → DELETE /scan, revert UI to D1 immediately
  • "Continuer en       → dismiss the progress card; top-bar dot stays
     arrière-plan"         pulsing, sub-row stays in list panel
  • Close progress card  → equivalent to "Continuer en arrière-plan"

Scan completes:
  → top-bar dot returns to green (idle)
  → toast/inline notice: "{N} nouvelles annonces" with link to filter
  → list panel sub-row disappears
```

## 4. Photo carousel

- Hover (pointer device): nav arrows fade in (140ms). Image **does not** scale or translate.
- Click on left/right arrow: advance index, dot pagination updates.
- Touch: swipe left/right to advance.
- Dot click: jump to that index.
- `count` overlay shows current/total in mono.

**Critical:** no Ken Burns, no parallax, no hover-zoom. The image is calm; the controls move.

## 5. Status segmented control (detail panel)

Clicking a different stage:
- Optimistically updates local state
- `PATCH /listings/:id { status }`
- On error: revert + toast "Impossible de mettre à jour"
- The same listing's pill in the list panel updates live

## 6. Notes textarea

- Auto-saves on blur, debounced 800ms during typing
- No save button — silent persistence
- Visual ack: brief 200ms ember underline on save (no toast)

## 7. Pin / Heart actions

- Heart button on photo: toggles `pinned`. Filled state ember, unfilled ink-3 outline.
- Pinned listings sort to top of the list panel.

## 8. Settings drawer (D4)

- Opens from settings icon in top bar.
- Map dims with 32% scrim + 2px blur — keeps spatial context, prevents accidental clicks.
- Close: ✕ icon, ESC key, click on scrim, or "Annuler" button.
- "Enregistrer" runs validation:
  - Zones: ≥ 1 required
  - Loyer max ≤ Plafond
  - ≥ 1 source enabled
- On save: drawer slides out, list/map auto-refreshes for any zone changes.

## 9. Mobile bottom sheet (M3)

- Swipe down to dismiss → returns to M2 (map view)
- Swipe up from half to full snap point
- Tap on scrim (above sheet) to dismiss
- Tab bar hides while sheet is fully open (sheet is 76% so tab bar is covered anyway)

## 10. Mobile tab switch (M1 ↔ M2)

- Tabs use the **same selection state**. If user selects a pin in M2, switches to M1, the corresponding row is pre-scrolled into view and highlighted.
- Floating "Carte" pill in M1 = shortcut to M2 tab — same effect.

## 11. Loading skeletons

- **List panel rows:** 6 placeholder rows, photo bg `var(--atlas-soft)`, two text lines as `var(--atlas-line)` bars (60% / 40% width). No shimmer animation needed; static is fine.
- **Detail panel:** photo skeleton 4:3, two heading bars, three stat-cell skeletons.
- **Map:** show map immediately, defer pins until loaded. No spinner — the map itself is plenty of visual.

## 12. Empty states

| Context | Copy | CTA |
|---|---|---|
| No listings, never scanned | "Aucune annonce pour l'instant" | Lancer un scan |
| No listings, this stage | "Rien à {stage} pour l'instant" | (none) |
| Scan returned 0 new | "Aucune nouveauté depuis le dernier scan" | Voir toutes les annonces |
| Search returned 0 | "Aucun résultat pour « {q} »" | Effacer la recherche |

All centered, with the same 56×56 ember-tinted illustration tile. Body 13/400 ink-2 line-height 1.55, max-width 280px.

## 13. Error states

- API failure: toast at bottom-center, `var(--atlas-bad)` text + dot, paper bg with hairline halo, dismissible. Auto-dismiss after 5s.
- Scan source error: that row in the progress card shows red dot + "Erreur — réessayer" link.
- No internet: persistent banner at top of screen, ink bg, white text "Hors-ligne — les modifications seront synchronisées".

## 14. Keyboard shortcuts (desktop)

| Key | Action |
|---|---|
| `/` | Focus search |
| `j` / `↓` | Next listing in list |
| `k` / `↑` | Prev listing in list |
| `Enter` | Open selected listing's URL (= "Ouvrir l'annonce") |
| `Esc` | Deselect / close drawer / close detail |
| `s` | Open Scanner |
| `,` | Open settings drawer |
| `1`–`5` | Set selected listing's status |

Show shortcuts in a `?` modal (not designed in V2 — defer or use Mantine's `<Spotlight>` defaults).

## 15. Animations summary

| Trigger | Animation | Duration | Easing |
|---|---|---|---|
| Pin hover | none (deliberate) | — | — |
| Pin select | bg/color/scale 1→1.06 | 140ms | ease |
| List row hover | bg fade (transparent → soft 50%) | 140ms | ease |
| List row select | bg + selection shadow | 140ms | ease |
| Detail panel mount | opacity 0→1, translateX 12→0 | 180ms | ease-out |
| Drawer mount | translateX 100%→0 | 220ms | cubic-bezier(.2,.8,.2,1) |
| Bottom sheet mount | translateY 100%→0 | 260ms | cubic-bezier(.2,.8,.2,1) |
| Photo carousel | nav arrows fade | 140ms | ease |
| Photo dot pagination | width 4↔14 | 160ms | ease |
| Toggle thumb | margin-left | 160ms | ease |
| Scan dot pulse | opacity 1↔0.35 | 1.2s | ease-in-out infinite |
| Spinner | rotate 0→360 | 1s | linear infinite |

**No `transition: all`. No `filter: blur` transitions (jank).**

---

Next: [07-implementation-plan.md](./07-implementation-plan.md)
