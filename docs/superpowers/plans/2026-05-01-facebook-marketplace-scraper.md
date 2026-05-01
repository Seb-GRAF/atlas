# Facebook Marketplace Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an experimental Facebook Marketplace apartment source, close to the Scrapfly article's browser-rendered approach, that imports listing cards into the existing apartment tracker.

**Architecture:** Implement Facebook Marketplace as an isolated scraper module with two providers: local Playwright persistent-browser mode and optional Scrapfly HTTP-rendering mode. The scan pipeline treats it like existing sources, but the source is disabled by default, fails loudly when login/blocking prevents collection, and marks Marketplace entries as source-only dedupe unless a street-level address is available.

**Tech Stack:** Node.js ESM, Playwright Chromium, native `fetch`, existing JSON profile config, existing React/Vitest dashboard UI.

---

## Design Decisions

- Source label: `Facebook Marketplace`; config key: `facebookMarketplace`.
- Default state: disabled for every profile.
- No seller identity storage: keep URL, listing id, title, price, location text, image URLs, parsed rooms/surface when visible; do not store seller names, profile IDs, or contact details.
- Local mode uses a persistent Chromium user data directory so the user can log in once. The scan must throw a clear error if login is missing, Facebook shows a block page, or no Marketplace card selector is found.
- Scrapfly mode is optional and selected by config/env. It uses Scrapfly's documented JS rendering/session options; it is not required for local development.
- Marketplace listings without a street-level address set `dedupDisabled: true`, so cross-source dedupe does not merge unrelated city-only listings.

## Files

- Create `scripts/lib/facebook-marketplace.mjs`: URL building, parser helpers, provider dispatch, local Playwright scraper, optional Scrapfly renderer.
- Create `scripts/lib/facebook-marketplace.test.mjs`: Node unit tests for parser, URL builder, error detection, and source-only dedupe metadata.
- Create `scripts/facebook-marketplace-login.mjs`: manual login helper that opens persistent Chromium and saves the session in local data.
- Modify `scripts/scrape-immobilier.mjs`: config defaults, progress rows, source task registration.
- Modify `scripts/lib/dedup.mjs` and `scripts/lib/dedup.test.mjs`: respect `dedupDisabled`.
- Modify `scripts/lib/scan-progress.test.mjs`: assert source key normalization for Facebook Marketplace.
- Modify `scripts/serve-dashboard.mjs`: profile create/update config handling.
- Modify `dashboard-ui/src/api/schemas.ts`, `dashboard-ui/src/atlas/types.ts`, `dashboard-ui/src/atlas/scan.ts`, `dashboard-ui/src/atlas/data/adapt.ts`, `dashboard-ui/src/atlas/data/hooks.ts`, and `dashboard-ui/src/atlas/screens/profileEditorModel.ts`: source flag, source label, profile payload plumbing.
- Modify `dashboard-ui/src/atlas/scan.test.ts` and `dashboard-ui/src/atlas/data/hooks.test.ts`: UI/source payload coverage.
- Modify `package.json`, `package-lock.json`, `.env.example`, and `README.md`: dependency, scripts, config docs, operational warnings.

## Task 1: Add Source Config And UI Plumbing

**Files:** `scripts/scrape-immobilier.mjs`, `scripts/serve-dashboard.mjs`, `dashboard-ui/src/api/schemas.ts`, `dashboard-ui/src/atlas/types.ts`, `dashboard-ui/src/atlas/scan.ts`, `dashboard-ui/src/atlas/data/adapt.ts`, `dashboard-ui/src/atlas/data/hooks.ts`, `dashboard-ui/src/atlas/screens/profileEditorModel.ts`

- [ ] Add optional `facebookMarketplace` to `SourcesSchema`.
- [ ] Add `'Facebook Marketplace'` to `AtlasListingSource`, `ALL_SOURCES`, `KNOWN_SOURCES`, and `PROFILE_SOURCE_OPTIONS`.
- [ ] Update `rawSourceLabel()` so raw values containing `facebook` or `marketplace` return `Facebook Marketplace`.
- [ ] Update `buildProfilePayload()` and `profileDetailToDraft()` so `facebookMarketplace` round-trips as disabled unless explicitly enabled.
- [ ] Update `makeDefaultConfig()` in both scraper/server code so:

```js
sources: {
  immobilier: true,
  flatfox: true,
  naef: true,
  bernardNicod: true,
  retraitesListings: true,
  anibis: false,
  facebookMarketplace: false
},
facebookMarketplace: {
  provider: 'playwright',
  maxScrollsPerSearch: 4,
  maxListingsPerSearch: 60,
  queryTemplates: [
    'appartement a louer {area}',
    'location appartement {area}',
    'studio a louer {area}'
  ],
  searchUrls: []
}
```

- [ ] Run `npm run test:ui -- dashboard-ui/src/atlas/scan.test.ts dashboard-ui/src/atlas/data/hooks.test.ts`; expected failures before implementation should mention missing source fields, then pass after implementation.
- [ ] Commit: `git add ... && git commit -m "feat: add marketplace source plumbing"`.

## Task 2: Add Parser And Dedupe Guard

**Files:** `scripts/lib/facebook-marketplace.mjs`, `scripts/lib/facebook-marketplace.test.mjs`, `scripts/lib/dedup.mjs`, `scripts/lib/dedup.test.mjs`

- [ ] Write failing tests for:
  - `parseMarketplacePrice("CHF 1'450")` returns `1450`.
  - `parseMarketplaceRooms("Appartement 2.5 pieces")` returns `2.5`.
  - `parseMarketplaceSurface("65 m2")` returns `65`.
  - `normalizeMarketplaceCard()` maps a `/marketplace/item/<id>/` URL to `id: "facebook:<id>"`, `source: "Facebook Marketplace"`, `listingStage: "early_market"`, and `dedupDisabled: true` when no street address is present.
  - `buildCrossSourceDedupKey({ dedupDisabled: true, area: "Lausanne", rooms: 2, totalChf: 1400 })` returns `null`.
- [ ] Implement exported helpers:

```js
export function buildMarketplaceSearchUrls(config = {}) {}
export function parseMarketplacePrice(text = '') {}
export function parseMarketplaceRooms(text = '') {}
export function parseMarketplaceSurface(text = '') {}
export function normalizeMarketplaceCard(raw = {}, context = {}) {}
export function detectFacebookAccessProblem(text = '', url = '') {}
```

- [ ] `normalizeMarketplaceCard()` must reject rows without listing id, URL, title, or total price. It may keep listings with missing rooms, but normal scan filters will hide them as `Taille hors criteres`.
- [ ] In `dedup.mjs`, return `null` from `buildCrossSourceDedupKey()` and `buildSurfacelessDedupKey()` when `item?.dedupDisabled === true`.
- [ ] Run `node --test scripts/lib/facebook-marketplace.test.mjs scripts/lib/dedup.test.mjs`; expected pass.
- [ ] Commit: `git add scripts/lib/facebook-marketplace.* scripts/lib/dedup.* && git commit -m "feat: parse marketplace listings"`.

## Task 3: Add Local Playwright Provider

**Files:** `scripts/lib/facebook-marketplace.mjs`, `scripts/facebook-marketplace-login.mjs`, `package.json`, `package-lock.json`, `.env.example`

- [ ] Add `playwright` as a runtime dependency and add scripts:

```json
{
  "facebook:login": "node scripts/facebook-marketplace-login.mjs",
  "playwright:install": "npx playwright install chromium"
}
```

- [ ] Add `.env.example` entries:

```bash
FACEBOOK_MARKETPLACE_PROVIDER=playwright
FACEBOOK_MARKETPLACE_USER_DATA_DIR=data/facebook-marketplace-browser
FACEBOOK_MARKETPLACE_HEADLESS=true
SCRAPFLY_API_KEY=
```

- [ ] Implement `scripts/facebook-marketplace-login.mjs` to launch Chromium persistent context with `FACEBOOK_MARKETPLACE_USER_DATA_DIR`, `headless: false`, open `https://www.facebook.com/marketplace`, and wait until the user presses Enter in the terminal before closing.
- [ ] Implement local provider in `facebook-marketplace.mjs`:
  - Use `chromium.launchPersistentContext(userDataDir, { headless, locale: 'fr-CH', timezoneId: 'Europe/Zurich' })`.
  - Visit each URL from `buildMarketplaceSearchUrls(config)`.
  - Wait for `a[href*="/marketplace/item/"]`, then scroll up to `maxScrollsPerSearch`.
  - Extract card data from anchors and nearest visible parent text, using stable link hrefs rather than generated class names.
  - Throw `FB_MARKETPLACE_LOGIN_REQUIRED`, `FB_MARKETPLACE_BLOCKED`, or `FB_MARKETPLACE_NO_CARDS` with the visited URL in the message.
- [ ] Run `npm install`; expected package lock updates only for Playwright.
- [ ] Run `node --test scripts/lib/facebook-marketplace.test.mjs`; expected pass.
- [ ] Commit: `git add package.json package-lock.json .env.example scripts/lib/facebook-marketplace.mjs scripts/facebook-marketplace-login.mjs && git commit -m "feat: add marketplace playwright provider"`.

## Task 4: Add Optional Scrapfly Provider

**Files:** `scripts/lib/facebook-marketplace.mjs`, `.env.example`, `README.md`

- [ ] Add provider dispatch:

```js
export async function scrapeFacebookMarketplaceListings(config = {}) {
  const provider = process.env.FACEBOOK_MARKETPLACE_PROVIDER || config.facebookMarketplace?.provider || 'playwright';
  if (provider === 'scrapfly') return scrapeWithScrapfly(config);
  if (provider === 'playwright') return scrapeWithPlaywright(config);
  throw new Error(`Unknown Facebook Marketplace provider: ${provider}`);
}
```

- [ ] Implement Scrapfly mode with native `fetch` against `https://api.scrapfly.io/scrape`, requiring `SCRAPFLY_API_KEY`; pass `render_js=true`, `asp=true`, `country=ch`, `session=facebook-marketplace-${PROFILE || 'default'}`, and a Marketplace card wait selector.
- [ ] Parse the returned HTML/body through the same card-normalization pipeline. If Scrapfly returns no body or a non-2xx status, throw a clear source error.
- [ ] Document that Scrapfly mode requires the user's own account/key and may incur per-scan cost.
- [ ] Run `node --test scripts/lib/facebook-marketplace.test.mjs`; expected pass.
- [ ] Commit: `git add scripts/lib/facebook-marketplace.mjs .env.example README.md && git commit -m "feat: add marketplace scrapfly provider"`.

## Task 5: Integrate Into Scan Pipeline

**Files:** `scripts/scrape-immobilier.mjs`, `scripts/lib/scan-progress.test.mjs`, `scripts/lib/dedup.mjs`

- [ ] Import `scrapeFacebookMarketplaceListings` from `scripts/lib/facebook-marketplace.mjs`.
- [ ] Add enabled-source row:

```js
config.sources?.facebookMarketplace === true && {
  key: 'facebook-marketplace',
  label: 'Facebook Marketplace'
}
```

- [ ] Add source task after Anibis:

```js
config.sources?.facebookMarketplace === true && {
  label: 'Facebook Marketplace',
  run: () => scrapeFacebookMarketplaceListings(config)
}
```

- [ ] Keep existing fail-loud behavior: if Marketplace throws, the source row gets `error` and the scan aborts through `sourceFailures`.
- [ ] Add scan-progress key test: `normalizeScanSourceKey('Facebook Marketplace') === 'facebook-marketplace'`.
- [ ] Run `node --test scripts/lib/scan-progress.test.mjs scripts/lib/dedup.test.mjs`; expected pass.
- [ ] Commit: `git add scripts/scrape-immobilier.mjs scripts/lib/scan-progress.test.mjs scripts/lib/dedup.mjs && git commit -m "feat: wire marketplace into scans"`.

## Task 6: Documentation And Manual Acceptance

**Files:** `README.md`, `.env.example`

- [ ] Document setup:

```bash
npm install
npm run playwright:install
FACEBOOK_MARKETPLACE_HEADLESS=false npm run facebook:login
```

- [ ] Document config example:

```json
{
  "sources": { "facebookMarketplace": true },
  "facebookMarketplace": {
    "provider": "playwright",
    "maxScrollsPerSearch": 4,
    "maxListingsPerSearch": 60,
    "queryTemplates": ["appartement a louer {area}", "studio a louer {area}"],
    "searchUrls": []
  }
}
```

- [ ] Add operational warning: this source is experimental, may stop working when Facebook changes UI/access rules, and stores no seller personal data.
- [ ] Manual test on one disposable/local profile:
  - Keep source disabled and run `npm run scan -- --profile <profile>`; expected unchanged behavior.
  - Enable `facebookMarketplace`, run without login; expected clear login-required source error.
  - Run `FACEBOOK_MARKETPLACE_HEADLESS=false npm run facebook:login`, complete login, then run scan; expected either imported listings or a clear Facebook-block/no-cards error.
- [ ] Run full verification:

```bash
node --test scripts/lib/*.test.mjs
npm run test:ui
npm run build:ui
```

- [ ] Commit: `git add README.md .env.example && git commit -m "docs: document marketplace scraper setup"`.

## Acceptance Criteria

- Source remains disabled by default for all existing profiles.
- Enabling `facebookMarketplace` adds one visible source row in scan progress and profile settings.
- Without a valid Facebook session or Scrapfly key, the scan fails with a clear error instead of returning empty fake success.
- Imported Marketplace listings have stable ids, URLs, prices, images when available, and parsed rooms/surface when visible in the card text.
- Marketplace listings without street addresses do not participate in cross-source dedupe.
- No seller names, profile links, message text, or contact details are stored.
- All Node and Vitest tests pass, and the UI build passes.

