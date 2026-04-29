export function formatNewApartmentsFound(count: number) {
  if (count <= 0) return 'Aucun nouvel appartement trouvé.';
  if (count === 1) return '1 nouvel appartement trouvé.';
  return `${count} nouveaux appartements trouvés.`;
}

export function scanNotificationColor(count: number) {
  return count > 0 ? 'alpine' : 'slate';
}

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${Math.max(1, seconds)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function formatScanProgressDetail(
  done = 0,
  total = 0,
  startedAt?: string | null,
  unit = 'étapes',
  currentStep?: string | null
) {
  if (total <= 0) return 'Préparation du scan';
  const base = `${Math.min(done, total)}/${total} ${unit}`;
  if (!startedAt || done >= total) return base;

  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return base;

  const elapsedMs = Math.max(0, Date.now() - started);
  let detail = `${base} · ${formatDuration(elapsedMs)} écoulées`;

  // Flatfox is the slow phase: warn the user instead of pretending to predict.
  const stepLower = (currentStep || '').toLowerCase();
  if (stepLower.includes('flatfox')) {
    detail += ' · Flatfox est plus lent';
  }

  return detail;
}
