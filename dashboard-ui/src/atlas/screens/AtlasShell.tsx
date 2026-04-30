import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AtlasMap, type AtlasMapHandle, type AtlasMapPin, MapControls } from '../components';
import { useAtlasMutations, useAtlasState } from '../data/hooks';
import { listStages, matchesStage, sortListings } from '../data/adapt';
import { useAtlasUrlState } from '../url';
import { useScan } from '../scan';
import { useAtlasKeyboard } from '../keyboard';
import { TopBar } from './TopBar';
import { ListPanel } from './ListPanel';
import { DetailPanel, PANEL_ANIM_MS } from './DetailPanel';
import { EmptyListPanel } from './EmptyListPanel';
import { ScanProgressCard } from './ScanProgressCard';
import { SettingsDrawer, SettingsScrim } from './SettingsDrawer';
import { ListSkeleton } from './Skeletons';
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
  const { setStatus, togglePin, dismiss, saveProfile } = useAtlasMutations();
  const [urlState, updateUrl] = useAtlasUrlState();
  const { scan, start: startScan, cancel: cancelScan } = useScan();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const mapHandle = useRef<AtlasMapHandle>(null);

  const stages = useMemo(() => listStages(listings), [listings]);

  const filtered = useMemo(
    () => sortListings(listings.filter((l) => matchesStage(l, urlState.stage)), urlState.sort),
    [listings, urlState.stage, urlState.sort]
  );

  const selected: AtlasListing | null = useMemo(
    () => listings.find((l) => l.id === urlState.listing) ?? null,
    [listings, urlState.listing]
  );

  // Keep the detail panel mounted long enough to play its exit animation.
  const detailVisible = !!selected && !settingsOpen;
  const [detailRender, setDetailRender] = useState<AtlasListing | null>(detailVisible ? selected : null);
  const [detailClosing, setDetailClosing] = useState(false);
  useEffect(() => {
    if (detailVisible && selected) {
      setDetailRender(selected);
      setDetailClosing(false);
      return;
    }
    if (detailRender) {
      setDetailClosing(true);
      const id = window.setTimeout(() => {
        setDetailRender(null);
        setDetailClosing(false);
      }, PANEL_ANIM_MS);
      return () => window.clearTimeout(id);
    }
  }, [detailVisible, selected, detailRender]);

  const pins = useMemo<AtlasMapPin[]>(
    () =>
      filtered
        .filter((l) => l.lat != null && l.lon != null && l.totalChf != null)
        .map((l) => ({
          id: l.id,
          lat: l.lat as number,
          lon: l.lon as number,
          totalChf: l.totalChf as number,
          precision: l.locationPrecision
        })),
    [filtered]
  );

  const initialCenter = profile.workplaceCoords
    ? { lat: profile.workplaceCoords.lat, lon: profile.workplaceCoords.lon, zoom: 11 }
    : VEVEY_FALLBACK;

  const scanRunning = !!scan && scan.status === 'running';
  const showEmpty = !isLoading && listings.length === 0 && !scanRunning;
  const showStageEmpty = !isLoading && listings.length > 0 && filtered.length === 0 && !scanRunning;
  const enabledSourceLabels = ALL_SOURCES.filter((s) => profile.enabledSources[s] !== false);

  const moveSelection = useCallback(
    (delta: 1 | -1) => {
      if (filtered.length === 0) return;
      const idx = filtered.findIndex((l) => l.id === urlState.listing);
      const nextIdx = idx === -1 ? 0 : Math.max(0, Math.min(filtered.length - 1, idx + delta));
      const next = filtered[nextIdx];
      if (next) updateUrl({ listing: next.id });
    },
    [filtered, updateUrl, urlState.listing]
  );

  const STATUS_BY_DIGIT: Record<1 | 2 | 3 | 4 | 5, AtlasListingStatus> = {
    1: 'À trier',
    2: 'À contacter',
    3: 'Visite prévue',
    4: 'Dossier à envoyer',
    5: 'Écartée'
  };

  useAtlasKeyboard({
    onNext: () => moveSelection(1),
    onPrev: () => moveSelection(-1),
    onEscape: () => {
      if (settingsOpen) setSettingsOpen(false);
      else if (urlState.listing) updateUrl({ listing: null });
    },
    onEnter: () => {
      if (selected?.url) window.open(selected.url, '_blank', 'noopener');
    },
    onSlash: () => {
      const input = document.querySelector<HTMLInputElement>('input[placeholder="Vevey, Lutry, Pully…"]');
      input?.focus();
    },
    onScan: () => {
      if (!scanRunning) startScan();
    },
    onSettings: () => setSettingsOpen((s) => !s),
    onStatusKey: (digit) => {
      if (!selected) return;
      setStatus.mutate({ id: selected.id, status: STATUS_BY_DIGIT[digit], notes: selected.notes });
    }
  });

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
          ref={mapHandle}
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
        listings={showEmpty || showStageEmpty || isLoading ? [] : filtered}
        selectedId={urlState.listing}
        onSelect={(id) => updateUrl({ listing: id })}
        generatedAt={profile.generatedAt}
        totalCount={isLoading ? undefined : filtered.length}
        emptyContent={
          isLoading ? (
            <ListSkeleton />
          ) : showEmpty ? (
            <EmptyListPanel
              zonesCount={profile.zones.length}
              sources={enabledSourceLabels}
              onScan={() => startScan()}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          ) : showStageEmpty ? (
            <StageEmpty stage={urlState.stage} />
          ) : null
        }
        sort={urlState.sort}
        onSortChange={(sort) => updateUrl({ sort })}
      />

      {scanRunning ? <ScanCardConnector profile={profile} scan={scan} onCancel={() => cancelScan()} /> : null}

      {detailRender ? (
        <DetailPanel
          listing={detailRender}
          closing={detailClosing}
          onTogglePin={(id) => togglePin.mutate(id)}
          onStatusChange={(id, status: AtlasListingStatus) =>
            setStatus.mutate({ id, status, notes: detailRender.notes })
          }
          onNotesChange={(id, notes) => setStatus.mutate({ id, status: detailRender.status, notes })}
          onDismiss={(id) => {
            dismiss.mutate(id);
            updateUrl({ listing: null });
          }}
        />
      ) : null}

      <MapControls
        style={{
          position: 'absolute',
          right: detailVisible ? 432 : 24,
          bottom: 24,
          zIndex: 4,
          transition: `right ${PANEL_ANIM_MS}ms cubic-bezier(0.32,0.72,0,1)`
        }}
        onZoomIn={() => mapHandle.current?.zoomIn()}
        onZoomOut={() => mapHandle.current?.zoomOut()}
        onCompass={() => mapHandle.current?.resetBearing()}
        onLayers={() => mapHandle.current?.flyToWorkplace()}
      />

      {settingsOpen ? (
        <>
          <SettingsScrim onClick={() => setSettingsOpen(false)} />
          <SettingsDrawer
            profile={profile}
            onClose={() => setSettingsOpen(false)}
            saving={saveProfile.isPending}
            error={saveProfile.error ? (saveProfile.error as Error).message : null}
            onSave={(next) => {
              saveProfile.mutate(next, {
                onSuccess: () => setSettingsOpen(false)
              });
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

const STAGE_EMPTY_COPY: Record<string, string> = {
  triage: 'Rien à trier pour l\'instant',
  active: 'Aucune annonce en cours',
  visits: 'Aucune visite prévue',
  files: 'Aucun dossier en cours',
  done: 'Rien dans les archives'
};

function StageEmpty({ stage }: { stage: string }) {
  return (
    <div
      style={{
        textAlign: 'center',
        color: 'var(--atlas-ink-2)',
        fontSize: 13,
        lineHeight: 1.55,
        maxWidth: 280,
        margin: '32px auto'
      }}
    >
      {STAGE_EMPTY_COPY[stage] ?? 'Aucune annonce'}
    </div>
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
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    const id = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(id);
  }, [message]);
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={() => setVisible(false)}
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--atlas-paper)',
        boxShadow: 'var(--atlas-shadow-2), 0 0 0 1px var(--atlas-line)',
        padding: '10px 16px',
        borderRadius: 12,
        fontSize: 13,
        color: 'var(--atlas-bad)',
        zIndex: 5,
        maxWidth: 480,
        border: 0,
        cursor: 'pointer',
        animation: 'atlas-toast-in 180ms ease-out',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: 'var(--atlas-bad)'
        }}
      />
      {message}
    </button>
  );
}
