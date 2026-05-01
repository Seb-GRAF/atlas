export type Basemap = 'vector' | 'satellite' | 'relief';

const STORAGE_KEY = 'atlas-basemap';

export function loadBasemap(): Basemap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'satellite' || raw === 'relief') return raw;
    return 'vector';
  } catch {
    return 'vector';
  }
}

export function saveBasemap(value: Basemap) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage unavailable (private mode, quota) — selection just won't persist.
  }
}
