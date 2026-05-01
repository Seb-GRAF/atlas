import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProfileScanStatus } from '../api/listings';
import type { ScanJob } from '../api/schemas';
import { buildScanSources, scanStorageKey, useScan } from './scan';
import type { AtlasProfile } from './types';

vi.mock('../api/listings', () => ({
  cancelProfileScan: vi.fn(),
  getProfileScanStatus: vi.fn(),
  startProfileScan: vi.fn()
}));

const profile: AtlasProfile = {
  slug: 'fribourg',
  shortTitle: 'Fribourg',
  areas: [],
  zones: [],
  workplace: null,
  workplaceCoords: null,
  newCount: 0,
  generatedAt: '',
  budgetMinChf: null,
  budgetMaxChf: null,
  budgetCeilingChf: null,
  roomsMin: null,
  roomsMax: null,
  enabledSources: {
    'immobilier.ch': true,
    'flatfox.ch': true,
    'naef.ch': false,
    'bernard-nicod': false,
    'Retraites Populaires': false,
    'anibis.ch': false
  }
};

describe('buildScanSources', () => {
  it('uses structured source progress when available', () => {
    const scan = {
      ok: true,
      completedUnits: 1,
      totalUnits: 2,
      sources: [
        {
          key: 'immobilier',
          label: 'immobilier.ch',
          status: 'done',
          found: 12,
          error: null,
          durationMs: 1530
        },
        {
          key: 'flatfox',
          label: 'flatfox.ch',
          status: 'error',
          found: 0,
          error: 'Rate limited',
          durationMs: null
        }
      ]
    } as ScanJob;

    expect(buildScanSources(profile, scan)).toEqual({
      total: 2,
      done: 1,
      sources: [
        {
          key: 'immobilier',
          name: 'immobilier.ch',
          state: 'done',
          found: 12,
          newCount: 12,
          error: null,
          durationMs: 1530
        },
        {
          key: 'flatfox',
          name: 'flatfox.ch',
          state: 'error',
          found: 0,
          newCount: 0,
          error: 'Rate limited',
          durationMs: null
        }
      ]
    });
  });

  it('keeps legacy enabled source progress from currentStep and done count', () => {
    const scan = {
      ok: true,
      done: 1,
      currentStep: 'Scanning flatfox listings'
    } as ScanJob;

    expect(buildScanSources(profile, scan)).toEqual({
      total: 2,
      done: 1,
      sources: [
        { key: 'immobilier.ch', name: 'immobilier.ch', state: 'done' },
        { key: 'flatfox.ch', name: 'flatfox.ch', state: 'running' }
      ]
    });
  });
});

describe('scan profile storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('scopes persisted scan jobs by explicit profile slug', () => {
    expect(scanStorageKey('fribourg')).toBe('atlas-scan-job:fribourg');
  });

  it('uses a stable bucket for the server-default profile', () => {
    expect(scanStorageKey()).toBe('atlas-scan-job:server-default');
  });

  it('does not clear stored scan jobs when polling rejects after unmount', async () => {
    const stored = JSON.stringify({ jobId: 'job-1' });
    window.localStorage.setItem(scanStorageKey('fribourg'), stored);

    let rejectStatus!: (error: Error) => void;
    vi.mocked(getProfileScanStatus).mockReturnValue(
      new Promise<ScanJob>((_, reject) => {
        rejectStatus = reject;
      })
    );

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);

    const { unmount } = renderHook(() => useScan('fribourg'), { wrapper });

    await waitFor(() => expect(getProfileScanStatus).toHaveBeenCalledWith('job-1'));
    unmount();
    rejectStatus(new Error('expired'));
    await Promise.resolve();

    expect(window.localStorage.getItem(scanStorageKey('fribourg'))).toBe(stored);
  });
});
