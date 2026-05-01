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

  const runningState = publicScanProgress(state);
  const runningRow = runningState.sources.find((s) => s.key === 'flatfox');
  assert.equal(runningRow.status, 'running');
  assert.equal(runningRow.startedAt, '2026-05-01T08:00:01.000Z');
  assert.equal(runningRow.finishedAt, null);
  assert.equal(runningRow.durationMs, null);

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
  assert.equal(publicState.sources.find((s) => s.key === 'flatfox').durationMs, 3000);
});

test('ignores non-positive and non-numeric unit counts', () => {
  const state = createInitialScanProgress({
    sources: [{ key: 'flatfox', label: 'flatfox.ch' }],
    totalUnits: 4,
    now: '2026-05-01T08:00:00.000Z'
  });

  for (const units of [0, -1, Number.NaN, 'not-a-number']) {
    applyScanProgressEvent(state, {
      type: 'source:done',
      source: 'flatfox.ch',
      units,
      at: '2026-05-01T08:00:04.000Z'
    });
  }

  assert.equal(publicScanProgress(state).completedUnits, 0);
});

test('initial source rows are queued for the UI and expose public fields', () => {
  const state = createInitialScanProgress({
    sources: [{ key: 'immobilier', label: 'immobilier.ch' }],
    totalUnits: 1,
    now: '2026-05-01T08:00:00.000Z'
  });

  const row = publicScanProgress(state).sources[0];
  assert.deepEqual(Object.keys(row), [
    'key',
    'label',
    'kind',
    'status',
    'found',
    'error',
    'startedAt',
    'finishedAt',
    'durationMs',
    'updatedAt'
  ]);
  assert.equal(row.status, 'queued');
  assert.equal(row.found, 0);
  assert.equal(row.error, '');
  assert.equal(row.startedAt, null);
  assert.equal(row.finishedAt, null);
  assert.equal(row.durationMs, null);
});

test('merges event source lists and structured unit totals', () => {
  const state = createInitialScanProgress({
    now: '2026-05-01T08:00:00.000Z'
  });

  applyScanProgressEvent(state, {
    type: 'phase:start',
    phase: 'sources',
    totalUnits: 5,
    completedUnits: 2,
    sources: [
      { key: 'immobilier', label: 'immobilier.ch' },
      { key: 'flatfox', label: 'flatfox.ch' }
    ],
    message: 'Recherche des annonces',
    at: '2026-05-01T08:00:01.000Z'
  });

  const publicState = publicScanProgress(state);
  assert.equal(publicState.totalUnits, 5);
  assert.equal(publicState.completedUnits, 2);
  assert.deepEqual(publicState.sources.map((source) => [source.key, source.status]), [
    ['immobilier', 'queued'],
    ['flatfox', 'queued']
  ]);
});

test('preserves phase rows so long post-processing is visible', () => {
  const state = createInitialScanProgress({
    sources: [
      { key: 'immobilier', label: 'immobilier.ch', kind: 'source' },
      { key: 'commute', label: 'Calcul des trajets', kind: 'phase' }
    ],
    totalUnits: 2,
    now: '2026-05-01T08:00:00.000Z'
  });

  applyScanProgressEvent(state, {
    type: 'source:start',
    source: 'Calcul des trajets',
    phase: 'commute',
    message: 'Calcul des trajets',
    at: '2026-05-01T08:00:01.000Z'
  });

  const commuteRow = publicScanProgress(state).sources.find((source) => source.key === 'commute');
  assert.equal(commuteRow.kind, 'phase');
  assert.equal(commuteRow.status, 'running');
});

test('does not double count units when completedUnits is supplied', () => {
  const state = createInitialScanProgress({
    sources: [{ key: 'flatfox', label: 'flatfox.ch' }],
    totalUnits: 5,
    now: '2026-05-01T08:00:00.000Z'
  });

  applyScanProgressEvent(state, {
    type: 'source:done',
    source: 'flatfox.ch',
    completedUnits: 3,
    units: 1,
    found: 4,
    at: '2026-05-01T08:00:01.000Z'
  });

  assert.equal(publicScanProgress(state).completedUnits, 3);
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
  assert.equal(row.durationMs, null);
  assert.equal(state.completedUnits, 1);
});

test('keeps duration null when a source completes without a start timestamp', () => {
  const state = createInitialScanProgress({
    sources: [{ key: 'anibis', label: 'anibis.ch' }],
    totalUnits: 1,
    now: '2026-05-01T08:00:00.000Z'
  });

  applyScanProgressEvent(state, {
    type: 'source:done',
    source: 'anibis.ch',
    at: '2026-05-01T08:00:04.000Z'
  });

  const row = publicScanProgress(state).sources[0];
  assert.equal(row.durationMs, null);
});

test('clears terminal metadata when a source restarts', () => {
  const state = createInitialScanProgress({
    sources: [{ key: 'flatfox', label: 'flatfox.ch' }],
    totalUnits: 1,
    now: '2026-05-01T08:00:00.000Z'
  });

  applyScanProgressEvent(state, {
    type: 'source:start',
    source: 'flatfox.ch',
    at: '2026-05-01T08:00:01.000Z'
  });
  applyScanProgressEvent(state, {
    type: 'source:done',
    source: 'flatfox.ch',
    at: '2026-05-01T08:00:04.000Z'
  });
  applyScanProgressEvent(state, {
    type: 'source:start',
    source: 'flatfox.ch',
    at: '2026-05-01T08:00:10.000Z'
  });

  const row = publicScanProgress(state).sources[0];
  assert.equal(row.status, 'running');
  assert.equal(row.startedAt, '2026-05-01T08:00:10.000Z');
  assert.equal(row.finishedAt, null);
  assert.equal(row.durationMs, null);
});

test('throws for unknown source event types', () => {
  const state = createInitialScanProgress({
    sources: [{ key: 'flatfox', label: 'flatfox.ch' }],
    totalUnits: 1,
    now: '2026-05-01T08:00:00.000Z'
  });

  assert.throws(
    () => applyScanProgressEvent(state, {
      type: 'source:skipped',
      source: 'flatfox.ch',
      at: '2026-05-01T08:00:01.000Z'
    }),
    /source:skipped/
  );
});

test('throws for invalid found counts', () => {
  const state = createInitialScanProgress({
    sources: [{ key: 'flatfox', label: 'flatfox.ch' }],
    totalUnits: 1,
    now: '2026-05-01T08:00:00.000Z'
  });

  for (const found of [-1, Number.NaN, 'not-a-number']) {
    assert.throws(
      () => applyScanProgressEvent(state, {
        type: 'source:done',
        source: 'flatfox.ch',
        found,
        at: '2026-05-01T08:00:01.000Z'
      }),
      /found/
    );
  }
});

test('normalizes existing source labels', () => {
  assert.equal(normalizeScanSourceKey('bernard-nicod.ch'), 'bernard-nicod');
  assert.equal(normalizeScanSourceKey('Retraites Populaires'), 'retraites-populaires');
  assert.equal(normalizeScanSourceKey('immobilier.ch · Vevey · page 1'), 'immobilier');
});
