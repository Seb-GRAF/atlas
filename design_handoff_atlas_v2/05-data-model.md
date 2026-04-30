# 05 — Data Model

TypeScript types matching the seed data in `design-files/atlas-data.jsx`. Use these as the contract between your real API and the redesigned UI.

---

## `Listing`

```ts
type ListingStatus =
  | "À trier"
  | "À contacter"
  | "Visite prévue"
  | "Dossier à envoyer"
  | "Dossier envoyé"
  | "Refus régie"
  | "Écartée";

type ListingSource =
  | "immobilier.ch"
  | "flatfox.ch"
  | "naef.ch"
  | "bernard-nicod"
  | "Retraites Populaires"
  | "anibis.ch";

type Listing = {
  id: string;                     // stable, source-prefixed: "ff-44102"
  title: string;                  // FR; first user-visible line on the card
  area: string;                   // commune name: "La Tour-de-Peilz"
  address: string;                // full street address

  rooms: number;                  // 1.5, 2.5, 3, 3.5, 4, 4.5
  surfaceM2: number;              // integer m²
  totalChf: number;               // monthly rent inc. charges, integer CHF

  source: ListingSource;
  pinned: boolean;                // user-pinned to top of list
  isNew: boolean;                 // < 24h old AND user hasn't seen it yet
  status: ListingStatus;          // workflow stage
  stage?: "off_market";           // optional special tag

  // Display strings (computed server-side; UI doesn't recompute)
  publishedLabel: string;         // "il y a 2 h", "hier", "il y a 3 j"
  publishedShort: string;         // "2 h", "1 j", "3 j" (used in detail footer)
  transitText: string;            // "32 min en train"
  driveText: string;              // "22 min" (without unit — unit comes from label)
  distanceText: string;           // "16.1 km"

  // Geo
  lat: number;
  lon: number;

  // Photos: 1–N URLs, ordered. First is the cover.
  images: string[];
};
```

### Notes

- All display dates and distances are **pre-formatted strings**, not raw numbers. This is intentional — the UI shouldn't compute "il y a 2h" because the source-of-truth for "now" is server-time, not client-time. If you change to client-side formatting, do it consistently and use `Intl.RelativeTimeFormat("fr-CH")`.
- Prices are CHF integers — never decimal. Format display with `Intl.NumberFormat("fr-CH").format(n)`.
- `images` URLs in the mockup are Unsplash placeholders. Production: your scraper's CDN.

---

## `Profile`

```ts
type Profile = {
  shortTitle: string;             // "Vevey & Riviera" — header label
  zones: string[];                // communes monitored: ["Vevey", "Lutry", …]
  workplace: string;              // human-readable: "EPFL, Lausanne"
  workplaceCoords?: { lat: number; lon: number };
  newCount: number;               // listings marked "isNew" today
  generatedAt: string;            // pre-formatted: "il y a 12 min"

  // Settings (from D4 drawer)
  budgetMaxChf: number;           // shown as "Loyer max" (e.g. 2500)
  budgetCeilingChf: number;       // shown as "Plafond" (e.g. 3000)
  enabledSources: Record<ListingSource, boolean>;
};
```

---

## `Stage`

```ts
type StageValue = "triage" | "active" | "visits" | "files" | "done";

type Stage = {
  value: StageValue;
  label: string;                  // FR display label
  count: number;                  // listings currently in this stage
};
```

Default labels (from prototype):

| value | label |
|---|---|
| triage | À trier |
| active | En cours |
| visits | Visites |
| files | Dossiers |
| done | Archivées |

---

## `Scan`

```ts
type ScanSourceState =
  | { state: "queued" }
  | { state: "running"; startedAt: string }
  | { state: "done"; finishedAt: string; newCount: number }
  | { state: "error"; message: string };

type Scan = {
  id: string;
  startedAt: string;
  status: "running" | "done" | "cancelled" | "error";
  sources: Record<ListingSource, ScanSourceState>;
  totalNew: number;               // sum of newCount across done sources
};
```

---

## API endpoints (suggested shapes)

These are not prescriptive — match your existing API. But the screens need access to:

| Endpoint | Returns | Used by |
|---|---|---|
| `GET /profile` | `Profile` | All screens |
| `GET /listings?stage=&zone=&q=` | `Listing[]` | List panel, mobile list, map pins |
| `GET /listings/:id` | `Listing` | Detail panel, mobile detail sheet |
| `PATCH /listings/:id` | updates `status`, `pinned`, notes | Detail panel actions |
| `POST /listings/:id/dismiss` | marks `Écartée` | Secondary "Écarter" button |
| `POST /scan` | `Scan` (id of new scan) | Top bar Scanner button |
| `GET /scan/:id` (SSE or polling) | `Scan` | Scanning state (D3) |
| `DELETE /scan/:id` | cancels | Scan card "Annuler" |

Live updates: scan progress is the only thing in V2 that benefits from SSE/WebSocket. List/detail can be normal HTTP + invalidate on mutation.

---

## Selection state (URL)

Embed the selected listing in the URL so refresh and shareable links work. Suggested shape:

```
/dashboard?stage=triage&zone=vevey-riviera&listing=ff-44102
```

`listing` as a query param, not a path segment — so the underlying screen (list | map | settings) is independent of selection.
