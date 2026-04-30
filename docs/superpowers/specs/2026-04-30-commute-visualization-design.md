# Commute Visualization Design

Date: 2026-04-30

## Goal

Show useful commute information from each apartment to the configured work address:

- Public transport time to arrive at work by 08:00 on the next Monday.
- Car travel time for the same apartment-to-work direction.
- A detail view route timeline for public transport legs, including walking and vehicle segments.

The dashboard should make commute data easy to scan without breaking the Atlas visual language. It should fail loudly when routing cannot be computed.

## Current Diagnosis

The project already contains partial commute infrastructure:

- `scripts/scrape-immobilier.mjs` has geocoding, route-cache helpers, `fetchDrivingMinutes()`, and `fetchTransitMinutes()`.
- `scripts/recompute-distances.mjs` can compute distance and car minutes, but transit is a placeholder returning `null`.
- During the main scrape merge, visible listings currently have commute fields cleared or reset instead of being computed.
- `dashboard-ui` already passes `distanceText`, `transitText`, and `driveText` through API schemas and listing adaptation.
- The current Atlas UI only surfaces limited commute text and has no route-leg visualization.

## API Sources

### Public Transport

Use `https://transport.opendata.ch/v1/connections`.

Relevant capabilities confirmed from the documentation and a live sample request:

- No account is needed for basic use.
- `isArrivalTime=1` supports arrival-based routing.
- `date` and `time` support a stable comparison baseline.
- `connections[0].duration` provides total trip duration.
- `connections[0].sections` provides the sequence of legs.
- Each section can contain either:
  - `journey`: public transport leg with `category`, `number`, `name`, `to`, and stop data.
  - `walk`: walking leg, often with duration.

Source: https://transport.opendata.ch/docs.html

Constraints:

- The API is unofficial and rate-limited by the upstream timetable provider.
- It provides timetable sections and stops, not guaranteed geographic polylines for drawing exact map routes.
- Results should be cached and failures should be visible.

### Car

Continue using OSRM for car travel time via `https://router.project-osrm.org/route/v1/driving/...`.

Constraints:

- The public OSRM endpoint is a demo service for reasonable non-commercial use.
- Cache results and avoid repeated calls.
- Do not present OSRM values as guaranteed real-time traffic estimates.

Source: https://github-wiki-see.page/m/Project-OSRM/osrm-backend/wiki/Demo-server

## Data Model

Add structured commute data to each listing while keeping the existing simple fields for compatibility:

```js
{
  distanceKm: 12.4,
  distanceText: "12.4 km",
  distanceComputed: true,
  distanceFromWorkAddress: "Rue Etraz 4, 1003 Lausanne, Suisse",

  driveMinutes: 31,
  driveText: "31 min",
  driveRouteStatus: "ok",

  transitMinutes: 42,
  transitText: "42 min",
  transitRouteStatus: "ok",
  transitRouteLabel: "Arrivée 08:00",
  transitRouteComputedAt: "2026-04-30T...",
  transitRoute: {
    date: "2026-05-04",
    arrivalTime: "08:00",
    departureAt: "2026-05-04T07:09:00+0200",
    arrivalAt: "2026-05-04T07:44:00+0200",
    products: ["RE33", "m2"],
    legs: [
      {
        type: "walk",
        label: "Marche",
        from: "Vevey VD, Av. de la Gare",
        to: "Vevey",
        departureAt: "2026-05-04T07:09:00+0200",
        arrivalAt: "2026-05-04T07:14:00+0200",
        minutes: 5
      },
      {
        type: "transit",
        mode: "RE",
        line: "33",
        label: "RE33",
        direction: "Annemasse",
        from: "Vevey",
        to: "Lausanne",
        departureAt: "2026-05-04T07:14:00+0200",
        arrivalAt: "2026-05-04T07:29:00+0200",
        minutes: 15
      }
    ]
  },

  commuteWarnings: []
}
```

Statuses:

- `ok`: route computed.
- `missing-address`: listing or work address is missing.
- `geocode-failed`: coordinates/address lookup failed.
- `route-failed`: external routing failed and no cached result is available.
- `cached-stale`: stale cached value used because fresh route failed.

## Scraper Flow

For each displayed active listing:

1. Build a Swiss listing address query from address or area.
2. Geocode the work address and listing address using existing geocode cache.
3. Compute straight-line distance.
4. Fetch car minutes using OSRM and route cache.
5. Fetch public transport connection using transport.opendata.ch:
   - from listing address query
   - to work address
   - `date=nextMonday`
   - `time=08:00`
   - `isArrivalTime=1`
   - `limit=1`
6. Parse `duration` to minutes.
7. Normalize `sections` into timeline legs.
8. Save fields on the listing and write route/geocode caches.

Removed or hidden listings may keep existing values, but the UI should not prioritize recomputing them.

## Cache Design

Use `data/profiles/{profile}/route-cache.json`.

Cache keys should include:

- mode: `drive` or `transit`
- origin and destination
- arrival/departure policy
- date/time policy key

Example:

```text
transit:arrival-next-monday-0800:<listing-address>-><work-address>
drive:<listing-lat>,<listing-lon>-><work-lat>,<work-lon>
```

Cache entries should store more than minutes for transit:

```js
{
  minutes: 42,
  route: { "legs": [] },
  status: "ok",
  updatedAt: "2026-04-30T..."
}
```

Avoid silent degradation:

- If a fresh route fails but cached data exists, use it with `cached-stale`.
- If no cached data exists, set a visible failure status.

## UI Design

Use option C:

- Compact commute chips in list rows and mobile rows.
- Detailed commute section in desktop detail panel and mobile detail sheet.

Atlas fit:

- No emoji.
- Use existing `Icons` where available, such as train/route/car icons if present; otherwise use text labels (`PT`, `CAR`, `WALK`, `RE33`, `M2`) in Atlas-style pills.
- Use existing surfaces, typography, border radius, and restrained color tokens.
- Avoid creating a new visual language.

List row:

- Show rooms and surface as today.
- Add compact chips after the core meta:
  - `PT 42 min`
  - `CAR 31 min`
- If data failed:
  - `PT n/a` or a muted warning chip.
  - Detail panel explains the failure.

Detail panel:

- Add a `Commute` section below the stat grid or near the map/detail metadata.
- Show total public transport and car values.
- Show baseline: `Arrivée travail 08:00`.
- Show a vertical or horizontal route timeline:
  - walking legs in neutral style.
  - transit legs with line labels from `category + number`.
  - from/to stops and leg minutes.
- Show warnings inline when route data is missing, stale, or failed.

## Error Handling

Follow the project rule: fail loud, never fake.

- Do not silently leave chips blank when routing fails.
- Surface a clear dashboard warning for selected listing failures.
- Log routing failures during scrape with source, listing id, and status.
- Persist status fields so failures can be debugged from `tracker.json`.
- Keep cached fallback visibly marked as stale.

## Testing

Add focused tests/scripts where practical:

- Unit-like parser coverage for:
  - transport duration format.
  - section-to-leg normalization.
  - cache status behavior.
- Smoke test with a known Swiss route using a mocked fixture, not a live network dependency.
- Manual UI verification:
  - desktop list row.
  - desktop detail panel.
  - mobile list row.
  - mobile detail sheet.
  - failed transit route state.
  - stale cached route state.

## Rollout

1. Implement shared commute helpers inside the scraper or a small service module if extracting avoids duplication with `recompute-distances.mjs`.
2. Wire main scrape merge so displayed active listings compute and persist commute fields.
3. Extend API schema and Atlas types for structured route data.
4. Render compact commute chips in rows.
5. Render route timeline in detail views.
6. Run a scan for one profile and verify route-cache/tracker fields.
7. Build dashboard assets and verify in browser.
