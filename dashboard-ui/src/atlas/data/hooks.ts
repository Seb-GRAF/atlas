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

const STATE_KEY = ['atlas', 'state'] as const;
const PROFILE_KEY = ['atlas', 'profile'] as const;

export function useAtlasState() {
  const stateQuery = useQuery({
    queryKey: STATE_KEY,
    queryFn: () => getDashboardState()
  });
  const profileQuery = useQuery({
    queryKey: PROFILE_KEY,
    queryFn: () => getProfileDetail()
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

export function useAtlasMutations() {
  const qc = useQueryClient();
  const profileSlug = qc.getQueryData<{ slug?: string }>(PROFILE_KEY)?.slug;

  const setStatus = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: AtlasListingStatus; notes?: string }) => {
      if (!profileSlug) throw new Error('Profil non chargé');
      return updateListingStatus(profileSlug, id, status, notes ?? '');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: STATE_KEY })
  });

  const togglePin = useMutation({
    mutationFn: (id: string) => {
      if (!profileSlug) throw new Error('Profil non chargé');
      return toggleListingPin(profileSlug, id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: STATE_KEY })
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => {
      if (!profileSlug) throw new Error('Profil non chargé');
      return deleteListing(profileSlug, id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: STATE_KEY })
  });

  const saveProfile = useMutation({
    mutationFn: (next: AtlasProfile) => {
      const detail = qc.getQueryData<ProfileDetail>(PROFILE_KEY);
      if (!detail) throw new Error('Profil non chargé');
      return updateProfile(buildProfilePayload(next, detail));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROFILE_KEY });
      qc.invalidateQueries({ queryKey: STATE_KEY });
    }
  });

  return { setStatus, togglePin, dismiss, saveProfile };
}
