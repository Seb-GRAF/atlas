# Scan Progress And Speed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make scan feedback accurate and make scans faster by reporting structured progress and running independent fetch work with bounded concurrency.

**Architecture:** Keep the existing child-process scan job model. The scraper emits structured progress events, the server reduces those events into public job state, and the React UI renders that state directly instead of guessing from text labels. Source fetching becomes concurrently scheduled, while dedupe, tracker merge, cache writes, and file writes remain sequential.

**Tech Stack:** Node.js ESM, native `node:test`, React 19, TypeScript, Zod, Vitest, existing REST endpoints.

---

## File Map

- Create `scripts/lib/scan-progress.mjs`: testable progress event helpers and source/phase state reducer.
- Create `scripts/lib/scan-progress.test.mjs`: Node tests for progress state, source errors, source counts, and elapsed timestamps.
- Modify `scripts/scrape-immobilier.mjs`: emit structured events and run source collection with bounded concurrency.
- Modify `scripts/serve-dashboard.mjs`: store structured progress on single-profile `scanJobs` and expose it from `/api/scan-status`.
- Modify `dashboard-ui/src/api/schemas.ts`: accept structured scan fields.
- Modify `dashboard-ui/src/atlas/scan.ts`: build UI source rows from `scan.sources`, falling back to legacy fields.
- Modify `dashboard-ui/src/atlas/screens/ScanProgressContent.tsx`: show accurate phase, current message, source rows, found counts, durations, errors, elapsed time, and progress units.
- Do not modify `dashboard/home.js` in this pass; scan-all keeps its existing profile-level progress.

Before editing, inspect current dirty files with `git diff -- dashboard-ui/src/atlas/scan.ts dashboard-ui/src/atlas/screens/AtlasShell.tsx dashboard/home.js` and preserve unrelated profile chooser work.

---

### Task 1: Progress State Helpers

**Files:**
- Create: `scripts/lib/scan-progress.mjs`
- Create: `scripts/lib/scan-progress.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `scripts/lib/scan-progress.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyScanProgressEvent,
  createInitialScanProgress,
  normalizeScanSourceKey,
  publicScanProgress
} from './scan-progress.mjs';

test('tracks phases, completed units, current message, and source counts', () => {
  const state = createInitialScanProgress({
    sources: [
      { key: 'immobilier', label: 'immobilier.ch' },
      { key: 'flatfox', label: 'flatfox.ch' }
    ],
    totalUnits: 4,
    now: '2026-05-01T08:00:00.000Z'
  });

  applyScanProgressEvent(state, {
    type: 'source:start',
    source: 'flatfox.ch',
    phase: 'sources',
    message: 'Flatfox: recherche des annonces',
    at: '2026-05-01T08:00:01.000Z'
  });
  applyScanProgressEvent(state, {
    type: 'source:done',
    source: 'flatfox.ch',
    found: 12,
    units: 1,
    message: 'Flatfox: 12 annonces',
    at: '2026-05-01T08:00:04.000Z'
  });

  const publicState = publicScanProgress(state);
  assert.equal(publicState.phase, 'sources');
  assert.equal(publicState.completedUnits, 1);
  assert.equal(publicState.totalUnits, 4);
  assert.equal(publicState.currentMessage, 'Flatfox: 12 annonces');
  assert.equal(publicState.sources.find((s) => s.key === 'flatfox').status, 'done');
  assert.equal(publicState.sources.find((s) => s.key === 'flatfox').found, 12);
});

test('keeps source failures visible without blocking other sources', () => {
  const state = createInitialScanProgress({
    sources: [{ key: 'anibis', label: 'anibis.ch' }],
    totalUnits: 1,
    now: '2026-05-01T08:00:00.000Z'
  });

  applyScanProgressEvent(state, {
    type: 'source:error',
    source: 'anibis.ch',
    error: 'HTTP 503 on anibis.ch',
    units: 1,
    at: '2026-05-01T08:00:02.000Z'
  });

  const row = publicScanProgress(state).sources[0];
  assert.equal(row.status, 'error');
  assert.equal(row.error, 'HTTP 503 on anibis.ch');
  assert.equal(state.completedUnits, 1);
});

test('normalizes existing source labels', () => {
  assert.equal(normalizeScanSourceKey('bernard-nicod.ch'), 'bernard-nicod');
  assert.equal(normalizeScanSourceKey('Retraites Populaires'), 'retraites-populaires');
  assert.equal(normalizeScanSourceKey('immobilier.ch · Vevey · page 1'), 'immobilier');
});
```

- [ ] **Step 2: Run and verify red**

Run:

```bash
node --test scripts/lib/scan-progress.test.mjs
```

Expected: fail because `scripts/lib/scan-progress.mjs` does not exist.

- [ ] **Step 3: Implement helper module**

Create `scripts/lib/scan-progress.mjs`:

```js
const SOURCE_ALIASES = new Map([
  ['immobilier.ch', 'immobilier'],
  ['flatfox.ch', 'flatfox'],
  ['naef.ch', 'naef'],
  ['bernard-nicod.ch', 'bernard-nicod'],
  ['bernard-nicod', 'bernard-nicod'],
  ['Retraites Populaires', 'retraites-populaires'],
  ['retraites-populaires', 'retraites-populaires'],
  ['anibis.ch', 'anibis']
]);

export function normalizeScanSourceKey(value = '') {
  const raw = String(value || '').trim();
  for (const [label, key] of SOURCE_ALIASES) {
    if (raw.toLowerCase().includes(label.toLowerCase())) return key;
  }
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

export function createInitialScanProgress({ sources = [], totalUnits = 0, now = new Date().toISOString() } = {}) {
  return {
    phase: 'preparing',
    totalUnits: Math.max(0, Number(totalUnits || 0)),
    completedUnits: 0,
    currentMessage: 'Préparation du scan',
    startedAt: now,
    updatedAt: now,
    sources: sources.map((source) => ({
      key: normalizeScanSourceKey(source.key || source.label),
      label: String(source.label || source.key || '').trim(),
      status: 'queued',
      found: 0,
      error: null,
      startedAt: null,
      finishedAt: null,
      durationMs: null
    }))
  };
}

function getOrCreateSource(state, sourceLabel) {
  const key = normalizeScanSourceKey(sourceLabel);
  let row = state.sources.find((source) => source.key === key);
  if (!row) {
    row = { key, label: String(sourceLabel || key), status: 'queued', found: 0, error: null, startedAt: null, finishedAt: null, durationMs: null };
    state.sources.push(row);
  }
  return row;
}

function durationMs(startedAt, finishedAt) {
  const start = Date.parse(startedAt || '');
  const finish = Date.parse(finishedAt || '');
  return Number.isFinite(start) && Number.isFinite(finish) ? Math.max(0, finish - start) : null;
}

export function applyScanProgressEvent(state, event = {}) {
  const at = event.at || new Date().toISOString();
  if (event.phase) state.phase = event.phase;
  if (event.totalUnits != null) state.totalUnits = Math.max(0, Number(event.totalUnits || 0));
  if (event.message) state.currentMessage = String(event.message);
  state.updatedAt = at;

  if (event.type === 'unit:done' || event.type === 'source:done' || event.type === 'source:error') {
    state.completedUnits = Math.min(state.totalUnits || state.completedUnits + Number(event.units || 1), state.completedUnits + Number(event.units || 1));
  }

  if (event.source) {
    const row = getOrCreateSource(state, event.source);
    if (event.type === 'source:start') {
      row.status = 'running';
      row.startedAt = row.startedAt || at;
      row.error = null;
    } else if (event.type === 'source:done') {
      row.status = 'done';
      row.found = Math.max(0, Number(event.found || 0));
      row.finishedAt = at;
      row.durationMs = durationMs(row.startedAt, row.finishedAt);
    } else if (event.type === 'source:error') {
      row.status = 'error';
      row.error = String(event.error || 'Erreur inconnue');
      row.finishedAt = at;
      row.durationMs = durationMs(row.startedAt, row.finishedAt);
    }
  }

  return state;
}

export function publicScanProgress(state) {
  return {
    phase: state.phase,
    totalUnits: state.totalUnits,
    completedUnits: state.completedUnits,
    currentMessage: state.currentMessage,
    startedAt: state.startedAt,
    updatedAt: state.updatedAt,
    sources: state.sources.map((source) => ({ ...source }))
  };
}
```

- [ ] **Step 4: Run and verify green**

Run:

```bash
node --test scripts/lib/scan-progress.test.mjs
```

Expected: pass.

---

### Task 2: Server Job State

**Files:**
- Modify: `scripts/serve-dashboard.mjs`
- Test: `node --check scripts/serve-dashboard.mjs`

- [ ] **Step 1: Import and initialize structured progress**

Add the import near the top:

```js
import {
  applyScanProgressEvent,
  createInitialScanProgress,
  publicScanProgress
} from './lib/scan-progress.mjs';
```

In `createScanJob(profile)`, add a `progress` object:

```js
progress: createInitialScanProgress()
```

- [ ] **Step 2: Merge child events**

Replace the `onProgress` callback body in `createScanJob()` with:

```js
(progress) => {
  if (progress.type) {
    applyScanProgressEvent(job.progress, progress);
    const publicProgress = publicScanProgress(job.progress);
    job.total = Number(publicProgress.totalUnits || progress.total || job.total || 0);
    job.done = Number(publicProgress.completedUnits || progress.done || 0);
    job.currentStep = publicProgress.currentMessage || String(progress.currentStep || job.currentStep || '');
    job.phase = publicProgress.phase;
    job.sources = publicProgress.sources;
    job.totalUnits = publicProgress.totalUnits;
    job.completedUnits = publicProgress.completedUnits;
    job.currentMessage = publicProgress.currentMessage;
    job.updatedAt = publicProgress.updatedAt;
    return;
  }

  job.total = Number(progress.total || job.total || 0);
  job.done = Number(progress.done || 0);
  job.currentStep = String(progress.currentStep || job.currentStep || '');
  job.currentMessage = job.currentStep;
  job.updatedAt = progress.at || new Date().toISOString();
}
```

- [ ] **Step 3: Hide internal process state in API responses**

Where `/api/scan-status` builds `publicJob`, omit both `child` and `progress`:

```js
const { child: _child, progress: _progress, ...publicJob } = job;
return sendJson(res, 200, { ok: true, ...publicJob });
```

- [ ] **Step 4: Check syntax**

Run:

```bash
node --check scripts/serve-dashboard.mjs
```

Expected: no syntax errors.

---

### Task 3: Scraper Structured Events And Source Concurrency

**Files:**
- Modify: `scripts/scrape-immobilier.mjs`
- Test: `node --check scripts/scrape-immobilier.mjs`

- [ ] **Step 1: Import source key helper**

Add:

```js
import { normalizeScanSourceKey } from './lib/scan-progress.mjs';
```

- [ ] **Step 2: Add bounded concurrency helper**

Add near `sleep(ms)`:

```js
async function runLimited(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const workerCount = Math.max(1, Math.min(Number(limit || 1), items.length || 1));

  async function runWorker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
}
```

- [ ] **Step 3: Replace legacy progress plan with structured plan**

Keep `done/total/currentStep` legacy fields for compatibility, but emit structured fields too:

```js
const enabledSources = [
  { key: 'immobilier', label: 'immobilier.ch', enabled: true },
  { key: 'flatfox', label: 'flatfox.ch', enabled: config.sources?.flatfox !== false },
  { key: 'naef', label: 'naef.ch', enabled: config.sources?.naef !== false },
  { key: 'bernard-nicod', label: 'bernard-nicod.ch', enabled: config.sources?.bernardNicod !== false },
  { key: 'retraites-populaires', label: 'Retraites Populaires', enabled: config.sources?.retraitesListings !== false },
  { key: 'anibis', label: 'anibis.ch', enabled: config.sources?.anibis !== false }
].filter((source) => source.enabled);

const immobilierUnits = Math.max(1, (config.areas || []).length * Math.max(1, Number(config.pagesPerArea || 1)));
const totalUnits = immobilierUnits + enabledSources.filter((source) => source.key !== 'immobilier').length + 4;
let progressDone = 0;
const emitStructuredProgress = (event) => {
  emitProgress({
    ...event,
    total: totalUnits,
    done: progressDone,
    totalUnits,
    completedUnits: progressDone,
    sources: enabledSources,
    currentStep: event.message || event.currentStep || 'Scan en cours'
  });
};
const completeUnit = (event) => {
  progressDone = Math.min(totalUnits, progressDone + Number(event.units || 1));
  emitStructuredProgress(event);
};
emitStructuredProgress({ type: 'phase:start', phase: 'preparing', message: 'Préparation du scan' });
```

- [ ] **Step 4: Parallelize immobilier page fetches**

Replace the nested `for area` / `for page` fetch section with a task array and `runLimited`:

```js
const immobilierTasks = [];
for (const area of config.areas || []) {
  const canton = resolveImmobilierCanton(area, config);
  const areaLabel = String(area?.label || '').trim();
  const configuredSlug = normalizeSlugCandidate(area?.slug || '');
  const immobilierSlug = await resolveImmobilierSlugForArea(area, config);
  const finalSlug = immobilierSlug || configuredSlug;
  for (let page = 1; page <= (config.pagesPerArea || 1); page += 1) {
    immobilierTasks.push({ areaLabel, configuredSlug, canton, finalSlug, page });
  }
}

emitStructuredProgress({ type: 'source:start', source: 'immobilier.ch', phase: 'sources', message: 'immobilier.ch: recherche des annonces' });
const immobilierResults = await runLimited(immobilierTasks, Number(config.scanConcurrency?.immobilierPages ?? 3), async (task) => {
  const url = `https://www.immobilier.ch/fr/louer/appartement/${task.canton}/${task.finalSlug}/page-${task.page}`;
  try {
    const html = await fetchHtml(url);
    return parseListingsFromHtml(html, task.areaLabel).filter((item) => isTargetAreaCity(item.area || '', targetAreaSet));
  } catch (err) {
    console.error(`WARN ${url}: ${err.message}`);
    return [];
  } finally {
    completeUnit({
      type: 'unit:done',
      source: 'immobilier.ch',
      phase: 'sources',
      message: `immobilier.ch: page ${task.page} terminée`
    });
  }
});
const immobilierItems = immobilierResults.flat();
scraped.push(...immobilierItems);
emitStructuredProgress({ type: 'source:done', source: 'immobilier.ch', found: immobilierItems.length, message: `immobilier.ch: ${immobilierItems.length} annonces` });
```

- [ ] **Step 5: Parallelize independent sources with visible errors**

Build source tasks for Flatfox, Naef, Bernard Nicod, Retraites Populaires, and Anibis. Use `runLimited(sourceTasks, Number(config.scanConcurrency?.sources ?? 3), ...)`; each task emits `source:start`, then `source:done` with `found`, or `source:error` with `error`. Push only fulfilled item arrays into `scraped`. Do not throw a source failure unless all enabled sources fail.

Use this task shape:

```js
const sourceTasks = [
  config.sources?.flatfox !== false && { key: 'flatfox', label: 'flatfox.ch', run: () => scrapeFlatfoxListings(config) },
  config.sources?.naef !== false && { key: 'naef', label: 'naef.ch', run: () => scrapeNaefListings(config) },
  config.sources?.bernardNicod !== false && { key: 'bernard-nicod', label: 'bernard-nicod.ch', run: () => scrapeBernardNicodListings(config) },
  config.sources?.retraitesListings !== false && { key: 'retraites-populaires', label: 'Retraites Populaires', run: () => scrapeRetraitesPopulairesListings(config) },
  config.sources?.anibis !== false && { key: 'anibis', label: 'anibis.ch', run: () => scrapeAnibisListings(config) }
].filter(Boolean);
```

- [ ] **Step 6: Emit post-processing phases**

Replace `startStep/completeStep` calls after source collection with `emitStructuredProgress` and `completeUnit` events:

```js
emitStructuredProgress({ type: 'phase:start', phase: 'preparing-listings', message: 'Préparation des annonces' });
completeUnit({ type: 'unit:done', phase: 'preparing-listings', message: 'Préparation des annonces terminée' });
emitStructuredProgress({ type: 'phase:start', phase: 'flatfox-recheck', message: 'Vérification Flatfox' });
completeUnit({ type: 'unit:done', phase: 'flatfox-recheck', message: 'Vérification Flatfox terminée' });
emitStructuredProgress({ type: 'phase:start', phase: 'dedupe', message: 'Tri et déduplication' });
completeUnit({ type: 'unit:done', phase: 'dedupe', message: 'Tri et déduplication terminés' });
emitStructuredProgress({ type: 'phase:start', phase: 'saving', message: 'Images et sauvegarde' });
completeUnit({ type: 'unit:done', phase: 'saving', message: 'Images et sauvegarde terminées' });
```

- [ ] **Step 7: Check syntax**

Run:

```bash
node --check scripts/scrape-immobilier.mjs
```

Expected: no syntax errors.

---

### Task 4: API Schema And Source Row Mapping

**Files:**
- Modify: `dashboard-ui/src/api/schemas.ts`
- Modify: `dashboard-ui/src/atlas/scan.ts`
- Create: `dashboard-ui/src/atlas/scan.test.ts`

- [ ] **Step 1: Extend Zod scan schemas**

Add source row and structured fields:

```ts
const ScanSourceProgressSchema = z.object({
  key: z.string(),
  label: z.string(),
  status: z.enum(['queued', 'running', 'done', 'error']),
  found: z.number().optional(),
  error: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
  durationMs: z.number().nullable().optional()
});
```

Then add to `ScanJobSchema`:

```ts
phase: z.string().optional(),
totalUnits: z.number().optional(),
completedUnits: z.number().optional(),
currentMessage: z.string().optional(),
sources: z.array(ScanSourceProgressSchema).optional(),
```

- [ ] **Step 2: Update UI row type and mapping**

In `dashboard-ui/src/atlas/scan.ts`, extend `ScanSourceRow`:

```ts
export type ScanSourceRow = {
  key: string;
  name: string;
  state: ScanSourceState;
  found?: number;
  error?: string | null;
  durationMs?: number | null;
};
```

In `buildScanSources`, use `scan.sources` first:

```ts
if (scan?.sources?.length) {
  const completedUnits = scan.completedUnits ?? scan.done ?? 0;
  const totalUnits = scan.totalUnits ?? scan.total ?? scan.sources.length;
  return {
    total: totalUnits,
    done: completedUnits,
    sources: scan.sources.map((source) => ({
      key: source.key,
      name: source.label,
      state: source.status,
      found: source.found,
      error: source.error,
      durationMs: source.durationMs
    }))
  };
}
```

Keep the existing fallback for legacy jobs.

- [ ] **Step 3: Run UI type/build checks**

Run:

```bash
npm run test:ui -- dashboard-ui/src/atlas/scan.test.ts
npm run build:ui
```

Expected: scan mapping tests pass and build passes.

---

### Task 5: Scan Progress UI

**Files:**
- Modify: `dashboard-ui/src/atlas/screens/ScanProgressContent.tsx`

- [ ] **Step 1: Display accurate labels**

Change the header count from “sources” to “étapes” or “unités”:

```tsx
<span style={monoCountStyle}>
  {done} / {total} étapes
</span>
```

Use `source.found` for completed source rows:

```tsx
if (source.state === 'done') {
  const n = source.found ?? 0;
  const text = n === 1 ? '1 annonce' : `${n} annonces`;
  return { text, mono: true, color: 'var(--atlas-good)' };
}
```

For errors:

```tsx
if (source.state === 'error') {
  return { text: source.error || 'erreur', mono: false, color: 'var(--atlas-bad)' };
}
```

- [ ] **Step 2: Add durations without layout shift**

Add a small formatter:

```tsx
function formatDuration(ms?: number | null) {
  if (ms == null || !Number.isFinite(ms)) return '';
  const seconds = Math.max(1, Math.round(ms / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
```

Render it after the right label when present.

- [ ] **Step 3: Build**

Run:

```bash
npm run build:ui
```

Expected: build passes.

---

### Task 6: Verification And Manual Check

**Files:**
- No new files.

- [ ] **Step 1: Run focused backend checks**

Run:

```bash
node --test scripts/lib/scan-progress.test.mjs
node --check scripts/serve-dashboard.mjs
node --check scripts/scrape-immobilier.mjs
```

Expected: all pass.

- [ ] **Step 2: Run UI checks**

Run:

```bash
npm run test:ui
npm run build:ui
```

Expected: all pass.

- [ ] **Step 3: Start local server**

Run:

```bash
npm run dev
```

Expected: server prints the local dashboard URL, normally `http://127.0.0.1:8787`.

- [ ] **Step 4: Manual scan verification**

Open a profile dashboard, start a scan, and verify:

- The progress panel appears immediately.
- The top counter says étapes, not sources.
- Source rows change from queued to running to done/error.
- Source rows show announcement counts and visible errors.
- Progress continues during long source fetches instead of looking frozen.
- Cancelling still stops the child process and clears local job state.

---

## Self-Review Notes

- Spec coverage: accurate progress feedback is covered by Tasks 1, 2, 4, and 5; faster scans are covered by Task 3 with bounded source/page concurrency; verification is covered by Task 6.
- Scope control: this plan does not change dedupe rules, removed-listing rules, database schema, or dependencies.
- Type consistency: public fields use `totalUnits`, `completedUnits`, `currentMessage`, `phase`, and `sources` consistently from server schema through UI mapping.
- Dirty worktree caution: implementation must preserve existing uncommitted profile chooser/dashboard changes and inspect local diffs before editing overlapping files.
