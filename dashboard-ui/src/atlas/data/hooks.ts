import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  deleteListing,
  getDashboardState,
  toggleListingPin,
  updateListingStatus
} from '../../api/listings';
import { getProfileDetail } from '../../api/profiles';
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

  return { setStatus, togglePin, dismiss };
}
