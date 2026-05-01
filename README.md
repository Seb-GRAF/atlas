# Apartment Search 🏠

Local dashboard for tracking apartment listings in Switzerland. Automatically scrapes listings from immobilier.ch, flatfox.ch, naef.ch, bernard-nicod.ch, Retraites Populaires direct rentals + projects (off-market), anibis.ch, and optional local Facebook Marketplace browser scraping, then displays them in a React/Mantine dashboard with status tracking and cross-source deduplication.

## Prerequisites

- **Node.js 18+**

## Getting Started

```bash
git clone <repo-url>
cd flat-scrapping
cp .env.example .env   # optional — customize PORT or Facebook Marketplace settings
npm install
npm run build:ui
npm start
```

Open http://localhost:8787/ in your browser.

For frontend development only:

```bash
npm run dev:ui
```

The Vite dev server proxies `/api/*` to the local Node server on port `8787`.

Useful frontend commands:

```bash
npm run build:ui
npm run test:ui
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values you need:

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: `8787`) |
| `FACEBOOK_MARKETPLACE_USER_DATA_DIR` | Only for Facebook Marketplace | Local Playwright browser profile directory (default: `data/facebook-marketplace-browser`) |
| `FACEBOOK_MARKETPLACE_HEADLESS` | Only for Facebook Marketplace | Use `false` while testing/login; default config uses `true` |
| `FACEBOOK_MARKETPLACE_DEBUG` | No | Set to `true` to write a temporary Marketplace debug report for each scan |
| `FACEBOOK_MARKETPLACE_THROTTLE_MIN_MS` | No | Minimum delay before each additional Marketplace region search (default: `20000`) |
| `FACEBOOK_MARKETPLACE_THROTTLE_MAX_MS` | No | Maximum delay before each additional Marketplace region search (default: `45000`) |

> **Note:** current providers (immobilier.ch, flatfox.ch, naef.ch, bernard-nicod.ch, Retraites Populaires rentals/projects, anibis.ch) run without credentials. Facebook Marketplace uses your own local browser session; there is no paid scraping API or proxy service.

## First Run

On first access, the home page shows the profile list (empty initially). Click **"Créer un profil"** to configure:

- **Title** — short profile name (e.g. "Vevey et environs")
- **Zones** — search and select Swiss municipalities via autocomplete (powered by [geo.admin.ch](https://api3.geo.admin.ch)). Canton, slug, and coordinates are derived automatically.
- **Budget** — max rent and hard cap
- **Rooms / minimum surface**
- **Workplace address** — autocomplete search for distance calculation
- **Sources** — which feeds to enable (immobilier.ch, flatfox.ch, naef.ch, bernard-nicod.ch, Retraites Populaires locations directes + projets off-market, anibis.ch, Facebook Marketplace)

Each profile is independent with its own data and criteria.

## Usage

### Dashboard

Each profile has its own dashboard at `/{profile}/dashboard`:

- **Table view** — dense newest-first review with rent, status, notes, and actions
- **Kanban view** — tracking pipeline (À contacter → Visite → Dossier → etc.)
- **Search** — by address, type, zone, or title
- **Actions** — scan, refresh, pin, change status, add notes, delete removed listings, view image galleries

### Running a Scan

Two options:

1. **From the dashboard** — click "Scanner"
2. **CLI**:
   ```bash
   npm run scan -- --profile=vevey
   ```

The scan fetches new listings, deduplicates same listings across multiple sites, and updates the tracker.

### Facebook Marketplace

Facebook Marketplace is experimental and requires a local logged-in browser profile. It is intentionally local-only and free: the app uses Playwright Chromium with a persistent browser profile on your machine. It does not use Scrapfly, paid proxies, or any paid scraping API.

Setup:

```bash
npm run playwright:install
FACEBOOK_MARKETPLACE_HEADLESS=false npm run facebook:login
```

Log in to Facebook in the opened browser, open/confirm Marketplace is usable, then press Enter in the terminal. After that, enable **Facebook Marketplace** in the profile sources and run a scan.

Marketplace searches are region-based, not town-query based. The scraper clusters selected profile zones by distance, resolves each cluster through Facebook's location picker, verifies the active Marketplace location, and runs one broad query per cluster. If Facebook shows a different active location than expected, the scan fails instead of scraping the wrong region.

Example profile config:

```json
{
  "sources": { "facebookMarketplace": true },
  "facebookMarketplace": {
    "query": "louer appartement",
    "daysSinceListed": 2,
    "sortBy": "creation_time_descend",
    "exact": false,
    "clusterDistanceKm": 25,
    "minRadiusKm": 10,
    "maxRadiusKm": 30,
    "throttleMinMs": 20000,
    "throttleMaxMs": 45000,
    "maxScrollsPerSearch": 4,
    "maxListingsPerSearch": 60
  }
}
```

This source may fail when Facebook requires login, blocks access, or changes Marketplace markup. Those cases are reported as scan errors rather than silently returning fake empty results. Marketplace cards often lack street addresses, so city-only Marketplace listings are not cross-source deduped against portal listings.

Temporary debug report:

```bash
FACEBOOK_MARKETPLACE_DEBUG=true npm run scan -- --profile=vevey
open data/profiles/vevey/debug/facebook-marketplace-latest.html
```

The report shows the Marketplace search URLs, resolved Facebook URLs, raw card order, raw/parsed prices, rooms, surface, accepted/rejected cards, duplicate skips, and rejection reasons. Use it only while tuning the scraper; it writes local debug files under the profile data directory.

### Managing Profiles

The home page (`/`) lets you:

- View all profiles with listing count and budget
- Create, edit, or delete profiles
- Navigate to each profile's dashboard

The profile switcher in the dashboard header also allows quick switching.

## Project Structure

```
flat-scrapping/
├── dashboard-ui/       # React + TypeScript + Mantine source
│   └── src/
├── dashboard/          # Built frontend assets + legacy rollback files
│   ├── dist/           # Vite production build served by the Node server
│   ├── home.html       # Legacy home page
│   ├── index.html      # Legacy per-profile dashboard
│   ├── app.js          # Legacy dashboard logic
│   └── styles.css      # Legacy shared styles
├── scripts/
│   ├── serve-dashboard.mjs   # HTTP server + API
│   └── scrape-immobilier.mjs # Multi-source scraper
├── data/
│   └── profiles/       # One folder per profile
│       └── {profile}/
│           ├── watch-config.json     # Configuration (tracked)
│           ├── tracker.json          # Tracked listings (gitignored)
│           ├── latest-listings.json  # Latest scan results (gitignored)
│           └── geocode-cache.json    # Geocoding cache (gitignored)
├── .env.example        # Environment variable template
└── package.json
```

## How It Works

1. **Scrape** — fetches listings from configured sources
2. **Deduplication** — by ID (intra-source), then by composite key address + rooms (floored) + surface (±5m²) + price (±50 CHF) for cross-source matching
3. **Tracker** — listings are persisted and their status is tracked across scans
4. **Dashboard** — real-time display with filters, sorting, and actions

## Port

Default: `8787`. Configurable via the `PORT` environment variable:

```bash
PORT=3000 npm start
```
