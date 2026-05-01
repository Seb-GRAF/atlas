function isoNow() {
  return new Date().toISOString();
}

function cleanSourceLabel(value = '') {
  return String(value || '').split('\u00b7')[0].trim();
}

function slugify(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\.(ch|com|net|org)$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeScanSourceKey(value = '') {
  return slugify(cleanSourceLabel(value));
}

function normalizeUnits(value) {
  const units = Number(value);
  if (!Number.isFinite(units) || units <= 0) return 0;
  return units;
}

function durationBetweenMs(start, end) {
  if (typeof start !== 'string' || !start.trim()) return null;
  if (typeof end !== 'string' || !end.trim()) return null;

  const started = new Date(start).getTime();
  const finished = new Date(end).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) return null;
  return finished - started;
}

function validateSourceEvent(event) {
  if (!event.source) return;

  const supportedTypes = new Set(['source:start', 'source:done', 'source:error', 'unit:done']);
  if (!supportedTypes.has(event.type)) {
    throw new Error(`Unknown source scan progress event type: ${String(event.type)}`);
  }
}

function validateFoundValue(event) {
  if (event.found == null) return;
  if (typeof event.found !== 'number' || !Number.isFinite(event.found) || event.found < 0) {
    throw new Error(`Invalid scan progress found count: ${String(event.found)}`);
  }
}

function createSourceState(source, now) {
  const key = normalizeScanSourceKey(source?.key || source?.label || source);
  const label = String(source?.label || source?.key || source || key).trim();
  return {
    key,
    label,
    kind: source?.kind === 'phase' ? 'phase' : 'source',
    status: 'queued',
    found: 0,
    error: '',
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    updatedAt: now
  };
}

function findSource(state, sourceName) {
  const key = normalizeScanSourceKey(sourceName);
  let row = state.sources.find((source) => source.key === key || normalizeScanSourceKey(source.label) === key);
  if (row) return row;

  row = createSourceState({ key, label: cleanSourceLabel(sourceName) || key }, state.updatedAt);
  state.sources.push(row);
  return row;
}

function mergeSourceList(state, sources = []) {
  if (!Array.isArray(sources)) return;
  for (const source of sources) {
    const key = normalizeScanSourceKey(source?.key || source?.label || source);
    if (!key || state.sources.some((row) => row.key === key)) continue;
    state.sources.push(createSourceState(source, state.updatedAt));
  }
}

function publicSource(source) {
  return {
    key: source.key,
    label: source.label,
    kind: source.kind,
    status: source.status,
    found: source.found,
    error: source.error,
    startedAt: source.startedAt,
    finishedAt: source.finishedAt,
    durationMs: source.durationMs,
    updatedAt: source.updatedAt
  };
}

export function createInitialScanProgress({ sources = [], totalUnits = 0, now = isoNow() } = {}) {
  return {
    phase: 'pending',
    totalUnits: Math.max(0, Number(totalUnits) || 0),
    completedUnits: 0,
    currentMessage: '',
    startedAt: now,
    updatedAt: now,
    sources: sources.map((source) => createSourceState(source, now))
  };
}

export function applyScanProgressEvent(state, event = {}) {
  if (!state || typeof state !== 'object') {
    throw new Error('applyScanProgressEvent requires a progress state object');
  }
  validateSourceEvent(event);
  validateFoundValue(event);

  const at = event.at || isoNow();
  mergeSourceList(state, event.sources);
  if (event.phase) state.phase = event.phase;
  if (event.message) state.currentMessage = event.message;
  if (event.totalUnits != null) {
    const totalUnits = Number(event.totalUnits);
    if (!Number.isFinite(totalUnits) || totalUnits < 0) {
      throw new Error(`Invalid scan progress totalUnits: ${String(event.totalUnits)}`);
    }
    state.totalUnits = totalUnits;
  }
  if (event.completedUnits != null) {
    const completedUnits = Number(event.completedUnits);
    if (!Number.isFinite(completedUnits) || completedUnits < 0) {
      throw new Error(`Invalid scan progress completedUnits: ${String(event.completedUnits)}`);
    }
    state.completedUnits = completedUnits;
  }

  const units = event.completedUnits == null ? normalizeUnits(event.units) : 0;
  if (units > 0) {
    state.completedUnits = (state.completedUnits || 0) + units;
  }

  if (event.source) {
    const source = findSource(state, event.source);
    source.updatedAt = at;
    if (event.kind === 'phase') source.kind = 'phase';

    if (event.type === 'source:start') {
      source.status = 'running';
      source.startedAt = at;
      source.finishedAt = null;
      source.durationMs = null;
      source.error = '';
    }

    if (event.type === 'source:done') {
      source.status = 'done';
      source.finishedAt = at;
      source.durationMs = durationBetweenMs(source.startedAt, source.finishedAt);
      source.error = '';
    }

    if (event.type === 'source:error') {
      source.status = 'error';
      source.finishedAt = at;
      source.durationMs = durationBetweenMs(source.startedAt, source.finishedAt);
      source.error = String(event.error || 'Unknown scan error');
    }

    if (event.found != null) {
      source.found = event.found;
    }
  }

  state.updatedAt = at;
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
    sources: state.sources.map(publicSource)
  };
}
