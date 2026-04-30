import { useEffect, useState, useCallback } from 'react';
import type { AtlasStageValue } from './types';

export type AtlasSortValue = 'recent' | 'priceAsc' | 'priceDesc';

export type AtlasUrlState = {
  stage: AtlasStageValue;
  listing: string | null;
  zone: string | null;
  sort: AtlasSortValue;
};

const STAGE_VALUES: AtlasStageValue[] = ['triage', 'active', 'visits', 'files', 'done'];
const SORT_VALUES: AtlasSortValue[] = ['recent', 'priceAsc', 'priceDesc'];

function readFromLocation(): AtlasUrlState {
  if (typeof window === 'undefined')
    return { stage: 'triage', listing: null, zone: null, sort: 'recent' };
  const params = new URLSearchParams(window.location.search);
  const stageRaw = params.get('stage');
  const stage = (STAGE_VALUES.includes(stageRaw as AtlasStageValue)
    ? (stageRaw as AtlasStageValue)
    : 'triage') satisfies AtlasStageValue;
  const sortRaw = params.get('sort');
  const sort = (SORT_VALUES.includes(sortRaw as AtlasSortValue)
    ? (sortRaw as AtlasSortValue)
    : 'recent') satisfies AtlasSortValue;
  return {
    stage,
    listing: params.get('listing'),
    zone: params.get('zone'),
    sort
  };
}

export function useAtlasUrlState() {
  const [state, setState] = useState<AtlasUrlState>(() => readFromLocation());

  useEffect(() => {
    const onPop = () => setState(readFromLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const update = useCallback((patch: Partial<AtlasUrlState>) => {
    const params = new URLSearchParams(window.location.search);
    const next = { ...readFromLocation(), ...patch };
    if (next.stage && next.stage !== 'triage') params.set('stage', next.stage);
    else params.delete('stage');
    if (next.listing) params.set('listing', next.listing);
    else params.delete('listing');
    if (next.zone) params.set('zone', next.zone);
    else params.delete('zone');
    if (next.sort && next.sort !== 'recent') params.set('sort', next.sort);
    else params.delete('sort');
    const search = params.toString();
    const url = `${window.location.pathname}${search ? `?${search}` : ''}`;
    window.history.replaceState({}, '', url);
    setState(next);
  }, []);

  return [state, update] as const;
}
