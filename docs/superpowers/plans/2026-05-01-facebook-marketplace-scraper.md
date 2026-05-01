# Facebook Marketplace Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fully free, experimental Facebook Marketplace apartment source that imports visible listing cards through a local Playwright browser session.

**Architecture:** Implement Facebook Marketplace as an isolated scraper module using Playwright persistent Chromium only. The source is disabled by default, fails loudly when login/blocking/no-card states occur, and marks Marketplace entries as source-only dedupe unless a street-level address is available.

**Tech Stack:** Node.js ESM, Playwright Chromium, existing JSON profile config, existing React/Vitest dashboard UI.

---

## Summary

- Add source key `facebookMarketplace` and label `Facebook Marketplace`.
- Use `npm run facebook:login` to create/update the local browser session in `data/facebook-marketplace-browser`.
- Run scans through the local browser only; no paid scraping API, no proxy service, and no paid provider config.
- Store listing URL, listing id, title, price, location text, parsed rooms/surface, and images when visible. Do not store seller names, profile ids, contact details, or message text.
- Set `dedupDisabled: true` for Marketplace listings without a street-level address so city-only cards do not merge unrelated listings.

## Implementation Changes

- Add `scripts/lib/facebook-marketplace.mjs` with URL building, parser helpers, access-problem detection, persistent-browser scraping, and `scrapeFacebookMarketplaceListings(config)`.
- Add `scripts/facebook-marketplace-login.mjs` that opens `https://www.facebook.com/marketplace` in a persistent Chromium profile and waits for Enter before closing.
- Add `playwright` plus scripts:

```json
{
  "facebook:login": "node scripts/facebook-marketplace-login.mjs",
  "playwright:install": "npx playwright install chromium"
}
```

- Add `facebookMarketplace` source plumbing in config defaults, profile create/update, schema validation, source toggles, scan progress, and listing source adaptation.
- Update dedupe helpers so `buildCrossSourceDedupKey()` and `buildSurfacelessDedupKey()` return `null` when `item.dedupDisabled === true`.
- Wire the scan source task only when `config.sources.facebookMarketplace === true`.

## Test Plan

- Node tests:

```bash
node --test scripts/lib/facebook-marketplace.test.mjs scripts/lib/dedup.test.mjs scripts/lib/scan-progress.test.mjs
```

- UI tests:

```bash
npm run test:ui
```

- Build:

```bash
npm run build:ui
```

- Manual free-mode acceptance:

```bash
npm run playwright:install
FACEBOOK_MARKETPLACE_HEADLESS=false npm run facebook:login
npm run scan -- --profile=<profile>
```

Expected manual outcome is either imported Marketplace listings or a clear login/block/no-cards error. Empty success is not acceptable.

## Assumptions

- The feature is free-only: no Scrapfly, no paid proxy, and no paid scraping API.
- The user accepts that Facebook can block or change Marketplace UI, so this source is experimental and may require selector/flow maintenance.
- Marketplace remains disabled by default for all profiles.
