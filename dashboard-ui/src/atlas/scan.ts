import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cancelProfileScan, getProfileScanStatus, startProfileScan } from '../api/listings';
import type { ScanJob } from '../api/schemas';
import type { AtlasListingSource, AtlasProfile } from './types';
import { stateKey } from './data/hooks';

const STORAGE_KEY = 'atlas-scan-job';

export const ALL_SOURCES: AtlasListingSource[] = [
  'immobilier.ch',
  'flatfox.ch',
  'naef.ch',
  'bernard-nicod',
  'Retraites Populaires',
  'anibis.ch'
];

export type ScanSourceState = 'done' | 'running' | 'queued' | 'error';

export type ScanSourceRow = {
  key: string;
  name: string;
  kind?: 'source' | 'phase';
  state: ScanSourceState;
  found?: number;
  error?: string | null;
  durationMs?: number | null;
  newCount?: number;
};

export function buildScanSources(
  profile: AtlasProfile,
  scan: ScanJob | null
): { total: number; done: number; sources: ScanSourceRow[] } {
  if (scan?.sources?.length) {
    const completedUnits = scan.completedUnits ?? scan.done ?? 0;
    const totalUnits = scan.totalUnits ?? scan.total ?? scan.sources.length;
    return {
      total: totalUnits,
      done: completedUnits,
      sources: scan.sources.map((source) => ({
        key: source.key,
        name: source.label,
        kind: source.kind,
        state: source.status,
        found: source.found,
        newCount: source.found,
        error: source.error,
        durationMs: source.durationMs
      }))
    };
  }

  const enabled = ALL_SOURCES.filter((s) => profile.enabledSources[s] !== false);
  const total = enabled.length || ALL_SOURCES.length;
  const done = scan?.done ?? 0;
  const running = scan?.currentStep ?? null;
  return {
    total,
    done,
    sources: enabled.map<ScanSourceRow>((name, idx) => {
      if (idx < done) return { key: name, name, state: 'done' };
      if (running && running.toLowerCase().includes(name.split('.')[0].toLowerCase()))
        return { key: name, name, state: 'running' };
      if (idx === done) return { key: name, name, state: 'running' };
      return { key: name, name, state: 'queued' };
    })
  };
}

type StoredScan = { jobId: string };

export function scanStorageKey(profileSlug?: string) {
  return `${STORAGE_KEY}:${profileSlug ?? 'server-default'}`;
}

function load(profileSlug?: string): StoredScan | null {
  try {
    const raw = window.localStorage.getItem(scanStorageKey(profileSlug));
    if (!raw) return null;
    return JSON.parse(raw) as StoredScan;
  } catch {
    return null;
  }
}

function save(profileSlug: string | undefined, value: StoredScan | null) {
  if (!value) {
    window.localStorage.removeItem(scanStorageKey(profileSlug));
    return;
  }
  window.localStorage.setItem(scanStorageKey(profileSlug), JSON.stringify(value));
}

function patchListingCommute(
  qc: ReturnType<typeof useQueryClient>,
  profileSlug: string | undefined,
  listingId: string,
  commute: NonNullable<NonNullable<ScanJob['commute']>['lastItem']>['commute']
) {
  if (!commute) return;
  qc.setQueryData(stateKey(profileSlug), (existing: unknown) => {
    if (!existing || typeof existing !== 'object') return existing;
    const state = existing as { tracker?: { listings?: Array<Record<string, unknown>> } };
    const listings = state.tracker?.listings;
    if (!Array.isArray(listings)) return existing;
    const idx = listings.findIndex((l) => String(l.id) === listingId);
    if (idx === -1) return existing;
    const nextListing = { ...listings[idx], ...commute, commutePending: false };
    const nextListings = listings.slice();
    nextListings[idx] = nextListing;
    return {
      ...state,
      tracker: { ...state.tracker, listings: nextListings }
    };
  });
}

export function useScan(profileSlug?: string) {
  const qc = useQueryClient();
  const [scan, setScan] = useState<ScanJob | null>(null);
  const [jobId, setJobId] = useState<string | null>(() => load(profileSlug)?.jobId ?? null);
  const pollRef = useRef<number | null>(null);
  const lastPatchedItemRef = useRef<{ id: string; at: string } | null>(null);

  const stop = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    stop();
    setScan(null);
    setJobId(load(profileSlug)?.jobId ?? null);
    lastPatchedItemRef.current = null;
  }, [profileSlug, stop]);

  // Poll while a scan or its commute phase is active.
  useEffect(() => {
    if (!jobId) {
      stop();
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await getProfileScanStatus(jobId);
        if (cancelled) return;
        setScan(next);

        const lastItem = next.commute?.lastItem ?? null;
        if (lastItem && lastItem.id) {
          const fingerprint = `${lastItem.id}@${lastItem.at ?? ''}`;
          const previous = lastPatchedItemRef.current;
          const previousFingerprint = previous ? `${previous.id}@${previous.at}` : null;
          if (fingerprint !== previousFingerprint) {
            lastPatchedItemRef.current = { id: lastItem.id, at: lastItem.at ?? '' };
            patchListingCommute(qc, profileSlug, lastItem.id, lastItem.commute ?? null);
          }
        }

        const scanTerminal = next.status && next.status !== 'running';
        const commuteStatus = next.commute?.status ?? null;
        const commuteTerminal = !next.commute || commuteStatus !== 'running';
        const scanFailed = next.status === 'error' || next.status === 'cancelled';

        if (scanTerminal && (scanFailed || commuteTerminal)) {
          stop();
          save(profileSlug, null);
          setJobId(null);
          // If commute did not complete cleanly, clear the pending spinner on
          // any listing still waiting — surface the absence of data instead of
          // spinning forever (per project's fail-loud rule).
          if (commuteStatus === 'error' || commuteStatus === 'cancelled' || scanFailed) {
            qc.setQueryData(stateKey(profileSlug), (existing: unknown) => {
              if (!existing || typeof existing !== 'object') return existing;
              const state = existing as { tracker?: { listings?: Array<Record<string, unknown>> } };
              const listings = state.tracker?.listings;
              if (!Array.isArray(listings)) return existing;
              const nextListings = listings.map((l) =>
                l.commutePending ? { ...l, commutePending: false } : l
              );
              return { ...state, tracker: { ...state.tracker, listings: nextListings } };
            });
          }
          qc.invalidateQueries({ queryKey: stateKey(profileSlug) });
        }
      } catch {
        if (cancelled) return;
        // Job may be expired on the server side; clear local state.
        stop();
        save(profileSlug, null);
        setJobId(null);
      }
    };
    tick();
    pollRef.current = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      stop();
    };
  }, [jobId, profileSlug, qc, stop]);

  const start = useCallback(async () => {
    const job = await startProfileScan(profileSlug);
    save(profileSlug, { jobId: job.jobId! });
    setJobId(job.jobId!);
  }, [profileSlug]);

  const cancel = useCallback(async () => {
    if (!jobId) return;
    await cancelProfileScan(jobId);
    save(profileSlug, null);
    setJobId(null);
    setScan(null);
  }, [jobId, profileSlug]);

  return { scan, jobId, start, cancel };
}

export type ScanCardPhase = 'running' | 'finished' | 'hidden';

const SCAN_CARD_FINISHED_HOLD_MS = 1500;

export function useScanCardVisibility(scan: ScanJob | null): ScanCardPhase {
  const [phase, setPhase] = useState<ScanCardPhase>('hidden');
  const previousStatusRef = useRef<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const status = scan?.status ?? null;
    const previous = previousStatusRef.current;
    previousStatusRef.current = status;

    if (status === 'running') {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setPhase('running');
      return;
    }

    if (previous === 'running' && (status === 'done' || status === 'error' || status === 'cancelled')) {
      setPhase('finished');
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        setPhase('hidden');
        timeoutRef.current = null;
      }, SCAN_CARD_FINISHED_HOLD_MS);
      return;
    }

    if (status == null) {
      if (timeoutRef.current == null) {
        setPhase('hidden');
      }
    }
  }, [scan?.status]);

  return phase;
}
