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

export function useScan(profileSlug?: string) {
  const qc = useQueryClient();
  const [scan, setScan] = useState<ScanJob | null>(null);
  const [jobId, setJobId] = useState<string | null>(() => load(profileSlug)?.jobId ?? null);
  const pollRef = useRef<number | null>(null);

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
  }, [profileSlug, stop]);

  // Poll while a job is active.
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
        if (next.status && next.status !== 'running') {
          stop();
          save(profileSlug, null);
          setJobId(null);
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
