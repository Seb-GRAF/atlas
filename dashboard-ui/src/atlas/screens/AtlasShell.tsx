import { useEffect, useMemo, useState } from 'react';
import { AtlasMap, type AtlasMapPin, MapControls } from '../components';
import { useAtlasMutations, useAtlasState } from '../data/hooks';
import { listStages, matchesStage } from '../data/adapt';
import { useAtlasUrlState } from '../url';
import { useScan } from '../scan';
import { TopBar } from './TopBar';
import { ListPanel } from './ListPanel';
import { DetailPanel } from './DetailPanel';
import { EmptyListPanel } from './EmptyListPanel';
import { ScanProgressCard } from './ScanProgressCard';
import { SettingsDrawer, SettingsScrim } from './SettingsDrawer';
import { MobileShell } from './mobile/MobileShell';
import type { AtlasListing, AtlasListingSource, AtlasListingStatus, AtlasProfile } from '../types';
import type { ScanJob } from '../../api/schemas';

const VEVEY_FALLBACK = { lat: 46.47, lon: 6.84, zoom: 11 };
const MOBILE_BREAKPOINT = 768;

const ALL_SOURCES: AtlasListingSource[] = [
  'immobilier.ch',
  'flatfox.ch',
  'naef.ch',
  'bernard-nicod',
  'Retraites Populaires',
  'anibis.ch'
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  );
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

function buildScanSources(profile: AtlasProfile, scan: ScanJob | null) {
  const enabled = ALL_SOURCES.filter((s) => profile.enabledSources[s] !== false);
  const total = enabled.length || ALL_SOURCES.length;
  const done = scan?.done ?? 0;
  const running = scan?.currentStep ?? null;
  return {
    total,
    done,
    sources: enabled.map<{ name: string; state: 'done' | 'running' | 'queued' | 'error' }>((name, idx) => {
      if (idx < done) return { name, state: 'done' };
      if (running && running.toLowerCase().includes(name.split('.')[0].toLowerCase()))
        return { name, state: 'running' };
      if (idx === done) return { name, state: 'running' };
      return { name, state: 'queued' };
    })
  };
}

export function AtlasShell() {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileShell />;
  return <DesktopShell />;
}

function DesktopShell() {
  const { listings, profile, isLoading, error } = useAtlasState();
  const { setStatus, togglePin, dismiss } = useAtlasMutations();
  const [urlState, updateUrl] = useAtlasUrlState();
  const { scan, start: startScan, cancel: cancelScan } = useScan();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const stages = useMemo(() => listStages(listings), [listings]);

  const filtered = useMemo(
    () =>
      listings
        .filter((l) => matchesStage(l, urlState.stage))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned)),
    [listings, urlState.stage]
  );

  const selected: AtlasListing | null = useMemo(
    () => listings.find((l) => l.id === urlState.listing) ?? null,
    [listings, urlState.listing]
  );

  const pins = useMemo<AtlasMapPin[]>(
    () =>
      filtered
        .filter((l) => l.lat != null && l.lon != null && l.totalChf != null)
        .map((l) => ({ id: l.id, lat: l.lat as number, lon: l.lon as number, totalChf: l.totalChf as number })),
    [filtered]
  );

  const initialCenter = profile.workplaceCoords
    ? { lat: profile.workplaceCoords.lat, lon: profile.workplaceCoords.lon, zoom: 11 }
    : VEVEY_FALLBACK;

  const scanRunning = !!scan && scan.status === 'running';
  const showEmpty = !isLoading && listings.length === 0 && !scanRunning;
  const enabledSourceLabels = ALL_SOURCES.filter((s) => profile.enabledSources[s] !== false);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--atlas-bg)',
        fontFamily: 'var(--atlas-sans)',
        color: 'var(--atlas-ink)'
      }}
    >
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <AtlasMap
          pins={pins}
          selectedId={urlState.listing}
          onSelect={(id) => updateUrl({ listing: id })}
          showWorkplace={!!profile.workplaceCoords}
          workplaceLabel={profile.workplace ? `Travail · ${profile.workplace}` : 'Travail'}
          workplace={profile.workplaceCoords ?? undefined}
          initialCenter={initialCenter}
        />
      </div>

      <TopBar
        profileTitle={profile.shortTitle}
        zones={profile.zones}
        query=""
        onQueryChange={() => {
          /* search wired in a later phase */
        }}
        stages={stages}
        stage={urlState.stage}
        onStageChange={(stage) => updateUrl({ stage, listing: null })}
        onOpenSettings={() => setSettingsOpen(true)}
        onScan={() => startScan()}
        scanning={scanRunning}
      />

      <ListPanel
        zones={profile.zones}
        listings={showEmpty ? [] : filtered}
        selectedId={urlState.listing}
        onSelect={(id) => updateUrl({ listing: id })}
        generatedAt={profile.generatedAt}
        emptyContent={
          showEmpty ? (
            <EmptyListPanel
              zonesCount={profile.zones.length}
              sources={enabledSourceLabels}
              onScan={() => startScan()}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          ) : null
        }
      />

      {scanRunning ? <ScanCardConnector profile={profile} scan={scan} onCancel={() => cancelScan()} /> : null}

      {selected && !settingsOpen ? (
        <DetailPanel
          listing={selected}
          onTogglePin={(id) => togglePin.mutate(id)}
          onStatusChange={(id, status: AtlasListingStatus) =>
            setStatus.mutate({ id, status, notes: selected.notes })
          }
          onNotesChange={(id, notes) => setStatus.mutate({ id, status: selected.status, notes })}
          onDismiss={(id) => {
            dismiss.mutate(id);
            updateUrl({ listing: null });
          }}
        />
      ) : null}

      <MapControls
        style={{ position: 'absolute', right: 432, bottom: 24, zIndex: 4 }}
      />

      {settingsOpen ? (
        <>
          <SettingsScrim onClick={() => setSettingsOpen(false)} />
          <SettingsDrawer
            profile={profile}
            onClose={() => setSettingsOpen(false)}
            onSave={() => {
              // Profile mutations land in a follow-up phase; close for now.
              setSettingsOpen(false);
            }}
          />
        </>
      ) : null}

      {isLoading ? <LoadingIndicator /> : null}
      {error ? <ErrorBanner message={(error as Error).message} /> : null}
    </div>
  );
}

function ScanCardConnector({
  profile,
  scan,
  onCancel
}: {
  profile: AtlasProfile;
  scan: ScanJob;
  onCancel: () => void;
}) {
  const { total, done, sources } = buildScanSources(profile, scan);
  return (
    <ScanProgressCard
      total={total}
      done={done}
      sources={sources}
      onCancel={onCancel}
      onBackground={() => {
        /* card hides itself when scan completes; nothing to do here */
      }}
    />
  );
}

function LoadingIndicator() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--atlas-glass-pill-bg)',
        backdropFilter: 'var(--atlas-glass-pill-blur)',
        WebkitBackdropFilter: 'var(--atlas-glass-pill-blur)',
        boxShadow: 'var(--atlas-shadow-1)',
        padding: '8px 14px',
        borderRadius: 999,
        fontSize: 12,
        color: 'var(--atlas-ink-2)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        zIndex: 5
      }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 999,
          border: '2px solid transparent',
          borderTopColor: 'var(--atlas-ember)',
          animation: 'v2spin 1s linear infinite',
          display: 'inline-block'
        }}
      />
      Chargement…
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--atlas-paper)',
        boxShadow: 'var(--atlas-shadow-2)',
        padding: '10px 16px',
        borderRadius: 12,
        fontSize: 13,
        color: 'var(--atlas-bad)',
        zIndex: 5,
        maxWidth: 480
      }}
    >
      {message}
    </div>
  );
}
