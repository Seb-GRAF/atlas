export type Basemap = 'vector' | 'satellite';

const STORAGE_KEY = 'atlas-basemap';

export function loadBasemap(): Basemap {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'satellite' ? 'satellite' : 'vector';
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
