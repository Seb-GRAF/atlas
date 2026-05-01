import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  deleteListing,
  getDashboardState,
  toggleListingPin,
  updateListingStatus
} from '../../api/listings';
import { getProfileDetail, updateProfile } from '../../api/profiles';
import type { ProfileDetail, ProfilePayload } from '../../api/schemas';
import { adaptListings, adaptProfile } from './adapt';
import type { AtlasListing, AtlasListingStatus, AtlasProfile } from '../types';

const SERVER_DEFAULT_SCOPE = 'server-default';

export const stateKey = (profileSlug?: string) => ['atlas', 'state', profileSlug ?? SERVER_DEFAULT_SCOPE] as const;
export const profileKey = (profileSlug?: string) => ['atlas', 'profile', profileSlug ?? SERVER_DEFAULT_SCOPE] as const;

export function useAtlasState(profileSlug?: string) {
  const stateQuery = useQuery({
    queryKey: stateKey(profileSlug),
    queryFn: () => getDashboardState(profileSlug)
  });
  const profileQuery = useQuery({
    queryKey: profileKey(profileSlug),
    queryFn: () => getProfileDetail(profileSlug)
  });

  const listings = useMemo<AtlasListing[]>(
    () => (stateQuery.data ? adaptListings(stateQuery.data) : []),
    [stateQuery.data]
  );

  const profile = useMemo<AtlasProfile>(
    () => adaptProfile(profileQuery.data ?? null, stateQuery.data ?? null),
    [profileQuery.data, stateQuery.data]
  );

  return {
    listings,
    profile,
    isLoading: stateQuery.isLoading || profileQuery.isLoading,
    isFetching: stateQuery.isFetching,
    error: stateQuery.error || profileQuery.error,
    refetch: () => Promise.all([stateQuery.refetch(), profileQuery.refetch()])
  };
}

export function buildProfilePayload(next: AtlasProfile, detail: ProfileDetail): ProfilePayload {
  const sources = {
    immobilier: next.enabledSources['immobilier.ch'] !== false,
    flatfox: next.enabledSources['flatfox.ch'] !== false,
    naef: next.enabledSources['naef.ch'] !== false,
    bernardNicod: next.enabledSources['bernard-nicod'] !== false,
    retraitesListings: next.enabledSources['Retraites Populaires'] !== false,
    retraitesProjets: detail.sources?.retraitesProjets ?? true,
    anibis: next.enabledSources['anibis.ch'] !== false
  };

  return {
    slug: next.slug,
    shortTitle: next.shortTitle,
    areas: next.areas,
    sources,
    filters: {
      ...detail.filters,
      minTotalChf: next.budgetMinChf ?? 0,
      maxTotalChf: next.budgetMaxChf ?? detail.filters.maxTotalChf ?? 1400,
      minRoomsPreferred: next.roomsMin ?? detail.filters.minRoomsPreferred ?? 1,
      maxRoomsPreferred: next.roomsMax ?? null
    },
    preferences: { ...detail.preferences, workplaceAddress: next.workplace }
  };
}

export function useAtlasMutations(profileSlug: string, queryProfileSlug?: string) {
  const qc = useQueryClient();
  const scopedProfileKey = profileKey(queryProfileSlug);
  const scopedStateKey = stateKey(queryProfileSlug);

  const setStatus = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: AtlasListingStatus; notes?: string }) => {
      if (!profileSlug || profileSlug === 'default') throw new Error('Profil non chargé');
      return updateListingStatus(profileSlug, id, status, notes ?? '');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: scopedStateKey })
  });

  const togglePin = useMutation({
    mutationFn: (id: string) => {
      if (!profileSlug || profileSlug === 'default') throw new Error('Profil non chargé');
      return toggleListingPin(profileSlug, id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: scopedStateKey })
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => {
      if (!profileSlug || profileSlug === 'default') throw new Error('Profil non chargé');
      return deleteListing(profileSlug, id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: scopedStateKey })
  });

  const saveProfile = useMutation({
    mutationFn: (next: AtlasProfile) => {
      const detail = qc.getQueryData<ProfileDetail>(scopedProfileKey);
      if (!detail) throw new Error('Profil non chargé');
      return updateProfile(buildProfilePayload(next, detail));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scopedProfileKey });
      qc.invalidateQueries({ queryKey: scopedStateKey });
    }
  });

  return { setStatus, togglePin, dismiss, saveProfile };
}
