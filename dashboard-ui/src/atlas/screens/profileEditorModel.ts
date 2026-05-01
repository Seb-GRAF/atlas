import type { ProfileDetail, ProfilePayload } from '../../api/schemas';

export const PROFILE_SOURCE_OPTIONS = [
  { key: 'immobilier', label: 'immobilier.ch' },
  { key: 'flatfox', label: 'flatfox.ch' },
  { key: 'naef', label: 'naef.ch' },
  { key: 'bernardNicod', label: 'bernard-nicod.ch' },
  { key: 'retraitesListings', label: 'Retraites Populaires' },
  { key: 'retraitesProjets', label: 'Retraites Projets' },
  { key: 'anibis', label: 'anibis.ch' },
  { key: 'facebookMarketplace', label: 'Facebook Marketplace' }
] as const;

export type ProfileSourceKey = (typeof PROFILE_SOURCE_OPTIONS)[number]['key'];

export function slugFromTitle(title: string) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function createEmptyProfileDraft(): ProfilePayload {
  return {
    slug: '',
    shortTitle: '',
    areas: [],
    sources: {
      immobilier: true,
      flatfox: true,
      naef: true,
      bernardNicod: true,
      retraitesListings: true,
      retraitesProjets: true,
      anibis: false,
      facebookMarketplace: false
    },
    filters: {
      minTotalChf: 0,
      maxTotalChf: 1400,
      maxTotalHardChf: 1550,
      minRoomsPreferred: 2,
      maxRoomsPreferred: 5,
      minSurfaceM2Preferred: 0,
      allowMissingSurface: true,
      maxPublishedAgeDays: 30
    },
    preferences: {
      workplaceAddress: null
    }
  };
}

export function profileDetailToDraft(profile: ProfileDetail): ProfilePayload {
  return {
    slug: profile.slug,
    shortTitle: profile.shortTitle,
    areas: profile.areas,
    sources: {
      immobilier: profile.sources.immobilier !== false,
      flatfox: profile.sources.flatfox !== false,
      naef: profile.sources.naef !== false,
      bernardNicod: profile.sources.bernardNicod !== false,
      retraitesListings: profile.sources.retraitesListings !== false,
      retraitesProjets: profile.sources.retraitesProjets !== false,
      anibis: !!profile.sources.anibis,
      facebookMarketplace: !!profile.sources.facebookMarketplace
    },
    filters: {
      minTotalChf: profile.filters.minTotalChf ?? 0,
      maxTotalChf: profile.filters.maxTotalChf ?? 1400,
      maxTotalHardChf: profile.filters.maxTotalHardChf ?? 1550,
      minRoomsPreferred: profile.filters.minRoomsPreferred ?? 2,
      maxRoomsPreferred: profile.filters.maxRoomsPreferred ?? 5,
      minSurfaceM2Preferred: profile.filters.minSurfaceM2Preferred ?? 0,
      allowMissingSurface: profile.filters.allowMissingSurface !== false,
      maxPublishedAgeDays: profile.filters.maxPublishedAgeDays ?? 30
    },
    preferences: {
      workplaceAddress: profile.preferences.workplaceAddress ?? null
    }
  };
}

export function prepareProfilePayload(mode: 'create' | 'edit', draft: ProfilePayload): ProfilePayload {
  const shortTitle = draft.shortTitle.trim();
  return {
    ...draft,
    slug: mode === 'create' ? slugFromTitle(shortTitle) : draft.slug,
    shortTitle,
    preferences: {
      ...draft.preferences,
      workplaceAddress: draft.preferences.workplaceAddress?.trim() || null
    }
  };
}
