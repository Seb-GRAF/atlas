import { afterEach, describe, expect, it } from 'vitest';
import { loadBasemap, saveBasemap } from './mapPrefs';

afterEach(() => {
  window.localStorage.clear();
});

describe('map basemap preferences', () => {
  it('does not restore satellite on startup', () => {
    window.localStorage.setItem('atlas-basemap', 'satellite');

    expect(loadBasemap()).toBe('vector');
  });

  it('keeps satellite as a session-only choice', () => {
    saveBasemap('satellite');

    expect(window.localStorage.getItem('atlas-basemap')).toBeNull();
    expect(loadBasemap()).toBe('vector');
  });

  it('still persists lightweight map modes', () => {
    saveBasemap('relief');

    expect(window.localStorage.getItem('atlas-basemap')).toBe('relief');
    expect(loadBasemap()).toBe('relief');
  });
});
