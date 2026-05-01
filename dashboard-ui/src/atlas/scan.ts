import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cancelProfileScan, getProfileScanStatus, startProfileScan } from '../api/listings';
import type { ScanJob } from '../api/schemas';
import type { AtlasListingSource, AtlasProfile } from './types';

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
  name: string;
  state: ScanSourceState;
  newCount?: number;
};

export function buildScanSources(
  profile: AtlasProfile,
  scan: ScanJob | null
): { total: number; done: number; sources: ScanSourceRow[] } {
  const enabled = ALL_SOURCES.filter((s) => profile.enabledSources[s] !== false);
  const total = enabled.length || ALL_SOURCES.length;
  const done = scan?.done ?? 0;
  const running = scan?.currentStep ?? null;
  return {
    total,
    done,
    sources: enabled.map<ScanSourceRow>((name, idx) => {
      if (idx < done) return { name, state: 'done' };
      if (running && running.toLowerCase().includes(name.split('.')[0].toLowerCase()))
        return { name, state: 'running' };
      if (idx === done) return { name, state: 'running' };
      return { name, state: 'queued' };
    })
  };
}

type StoredScan = { jobId: string };

function load(): StoredScan | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredScan;
  } catch {
    return null;
  }
}

function save(value: StoredScan | null) {
  if (!value) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function useScan() {
  const qc = useQueryClient();
  const [scan, setScan] = useState<ScanJob | null>(null);
  const [jobId, setJobId] = useState<string | null>(() => load()?.jobId ?? null);
  const pollRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

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
          save(null);
          setJobId(null);
          qc.invalidateQueries({ queryKey: ['atlas', 'state'] });
        }
      } catch {
        // Job may be expired on the server side; clear local state.
        stop();
        save(null);
        setJobId(null);
      }
    };
    tick();
    pollRef.current = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      stop();
    };
  }, [jobId, qc, stop]);

  const start = useCallback(async () => {
    const job = await startProfileScan();
    save({ jobId: job.jobId! });
    setJobId(job.jobId!);
  }, []);

  const cancel = useCallback(async () => {
    if (!jobId) return;
    await cancelProfileScan(jobId);
    save(null);
    setJobId(null);
    setScan(null);
  }, [jobId]);

  return { scan, jobId, start, cancel };
}
