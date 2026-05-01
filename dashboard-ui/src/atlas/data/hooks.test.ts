import { describe, expect, it } from 'vitest';
import { buildProfilePayload, profileKey, stateKey } from './hooks';
import type { ProfileDetail } from '../../api/schemas';
import type { AtlasProfile } from '../types';

const detail: ProfileDetail = {
  slug: 'vaud-3-pieces',
  shortTitle: 'Vaud',
  areas: [{ label: 'Vevey', slug: 'vevey', canton: 'vaud' }],
  sources: { immobilier: true, flatfox: true, retraitesProjets: true },
  filters: { minTotalChf: 1000, maxTotalChf: 1800, minRoomsPreferred: 2 },
  preferences: {}
};

const profile: AtlasProfile = {
  slug: 'vaud-3-pieces',
  shortTitle: 'Vaud',
  areas: [{ label: 'Lausanne', slug: 'lausanne', canton: 'vaud' }],
  zones: ['Lausanne'],
  workplace: 'EPFL, Route Cantonale, 1015 Lausanne',
  workplaceCoords: { lat: 46.5183, lon: 6.5668 },
  newCount: 0,
  generatedAt: '',
  budgetMinChf: 1100,
  budgetMaxChf: 1900,
  budgetCeilingChf: 2200,
  roomsMin: 2.5,
  roomsMax: null,
  enabledSources: {}
};

describe('buildProfilePayload', () => {
  it('scopes query keys by profile slug', () => {
    expect(stateKey('fribourg')).toEqual(['atlas', 'state', 'fribourg']);
    expect(profileKey('fribourg')).toEqual(['atlas', 'profile', 'fribourg']);
    expect(stateKey()).toEqual(['atlas', 'state', 'server-default']);
    expect(profileKey()).toEqual(['atlas', 'profile', 'server-default']);
  });

  it('persists edited areas and workplace address', () => {
    const payload = buildProfilePayload(profile, detail);

    expect(payload.areas).toEqual(profile.areas);
    expect(payload.preferences.workplaceAddress).toBe('EPFL, Route Cantonale, 1015 Lausanne');
  });

  it('keeps undefined source flags enabled when the UI shows them as enabled', () => {
    const payload = buildProfilePayload(profile, detail);

    expect(payload.sources.anibis).toBe(true);
  });

  it('keeps Facebook Marketplace disabled unless explicitly enabled', () => {
    const payload = buildProfilePayload(profile, detail);

    expect(payload.sources.facebookMarketplace).toBe(false);

    const enabled = buildProfilePayload(
      {
        ...profile,
        enabledSources: {
          ...profile.enabledSources,
          'Facebook Marketplace': true
        }
      },
      detail
    );

    expect(enabled.sources.facebookMarketplace).toBe(true);
  });
});
