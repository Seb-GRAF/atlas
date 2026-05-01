import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AtlasMap, type AtlasMapHandle, type AtlasMapPin, MapControls } from '../components';
import { useAtlasMutations, useAtlasState } from '../data/hooks';
import { listStages, matchesStage, sortListings } from '../data/adapt';
import { filterListingsByQuery } from '../data/listingSearch';
import { useAtlasUrlState } from '../url';
import { ALL_SOURCES, buildScanSources, isAtlasSourceEnabled, useScan, useScanCardVisibility } from '../scan';
import { useAtlasKeyboard } from '../keyboard';
import { loadBasemap, saveBasemap, type Basemap } from '../mapPrefs';
import { TopBar } from './TopBar';
import { ListPanel } from './ListPanel';
import { DetailPanel, PANEL_ANIM_MS } from './DetailPanel';
import { EmptyListPanel } from './EmptyListPanel';
import { ScanProgressCard } from './ScanProgressCard';
import { CommuteProgressBanner } from './CommuteProgressBanner';
import { ListSkeleton } from './Skeletons';
import { UndoToast } from './UndoToast';
import { usePendingDismissals } from './usePendingDismissals';
import { MobileShell } from './mobile/MobileShell';
import type { AtlasListing, AtlasListingStatus, AtlasProfile, RouteOverlay } from '../types';
import type { ScanJob } from '../../api/schemas';
import { buildTransitRouteOverlay } from '../data/routeViz';
import { buildProfileDashboardUrl, getActiveProfileSlug } from '../profileRouting';

const VEVEY_FALLBACK = { lat: 46.47, lon: 6.84, zoom: 11 };
const MOBILE_BREAKPOINT = 768;

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

export function AtlasShell() {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileShell />;
  return <DesktopShell />;
}

function DesktopShell() {
  const activeProfileSlug = getActiveProfileSlug();
  const { listings, profile, isLoading, error } = useAtlasState(activeProfileSlug);
  const { setStatus, togglePin, dismiss } = useAtlasMutations(profile.slug, activeProfileSlug);
  const [urlState, updateUrl] = useAtlasUrlState();
  const { scan, start: startScan, cancel: cancelScan } = useScan(activeProfileSlug);
  const mapHandle = useRef<AtlasMapHandle>(null);
  const [routeOverlay, setRouteOverlay] = useState<RouteOverlay | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<Basemap>(() => loadBasemap());
  const [query, setQuery] = useState('');

  const changeBasemap = useCallback((next: Basemap) => {
    setBasemap(next);
    saveBasemap(next);
  }, []);

  const dismissCallback = useCallback((id: string) => dismiss.mutate(id), [dismiss]);
  const {
    pendingIds,
    pendingCount,
    restoringIds: restoringPendingIds,
    schedule: schedulePending,
    undoAll: undoPending
  } = usePendingDismissals(dismissCallback);

  const visibleListings = useMemo(
    () => (pendingIds.size === 0 ? listings : listings.filter((l) => !pendingIds.has(l.id))),
    [listings, pendingIds]
  );

  const stages = useMemo(() => listStages(visibleListings), [visibleListings]);

  const stageScoped = useMemo(
    () => visibleListings.filter((l) => matchesStage(l, urlState.stage)),
    [visibleListings, urlState.stage]
  );

  const filtered = useMemo(() => {
    const sourceSet = urlState.sources.length > 0 ? new Set(urlState.sources) : null;
    const sourceScoped = sourceSet
      ? stageScoped.filter((l) => sourceSet.has(String(l.source)))
      : stageScoped;
    return sortListings(filterListingsByQuery(sourceScoped, query), urlState.sort);
  }, [stageScoped, urlState.sort, urlState.sources, query]);

  // For list rendering: keep pending items in place so they can animate to
  // height 0 instead of jumping. They are excluded from `filtered` (and thus
  // from selection/stage counts/map pins).
  const filteredForList = useMemo(() => {
    if (pendingIds.size === 0) return filtered;
    const sourceSet = urlState.sources.length > 0 ? new Set(urlState.sources) : null;
    const pendingMembers = filterListingsByQuery(
      listings.filter(
        (l) =>
          pendingIds.has(l.id) &&
          matchesStage(l, urlState.stage) &&
          (!sourceSet || sourceSet.has(String(l.source)))
      ),
      query
    );
    if (pendingMembers.length === 0) return filtered;
    return sortListings([...filtered, ...pendingMembers], urlState.sort);
  }, [filtered, listings, pendingIds, urlState.stage, urlState.sort, urlState.sources, query]);

  const handleArchive = useCallback(
    (id: string) => {
      // If the archived listing is currently selected, advance selection to next/prev.
      if (urlState.listing === id) {
        const idx = filtered.findIndex((l) => l.id === id);
        const next = idx >= 0 ? filtered[idx + 1] ?? filtered[idx - 1] ?? null : null;
        updateUrl({ listing: next ? next.id : null });
      }
      schedulePending(id);
    },
    [filtered, schedulePending, updateUrl, urlState.listing]
  );

  const handleArchiveAll = useCallback(() => {
    if (filtered.length === 0) return;
    if (urlState.listing && filtered.some((l) => l.id === urlState.listing)) {
      updateUrl({ listing: null });
    }
    for (const l of filtered) schedulePending(l.id);
  }, [filtered, schedulePending, updateUrl, urlState.listing]);

  const selected: AtlasListing | null = useMemo(
    () => listings.find((l) => l.id === urlState.listing) ?? null,
    [listings, urlState.listing]
  );

  useEffect(() => {
    if (!urlState.listing) return;
    if (filtered.some((l) => l.id === urlState.listing)) return;
    updateUrl({ listing: null });
  }, [filtered, updateUrl, urlState.listing]);

  // Clear the route overlay when the user switches to a different listing or
  // deselects. The overlay is bound to a specific listing id.
  useEffect(() => {
    if (!selected || (routeOverlay && routeOverlay.listingId !== selected.id)) {
      setRouteOverlay(null);
      setRouteLoading(false);
      setRouteError(null);
    }
  }, [selected, routeOverlay]);

  const handleVisualizeRoute = useCallback(async () => {
    if (!selected) return;
    if (routeOverlay && routeOverlay.listingId === selected.id) {
      setRouteOverlay(null);
      setRouteError(null);
      return;
    }
    if (selected.transitRouteOverlay && selected.transitRouteOverlay.legs.length > 0) {
      setRouteOverlay(selected.transitRouteOverlay);
      setRouteError(null);
      return;
    }
    if (!selected.transitRoute || selected.transitRoute.legs.length === 0) return;
    setRouteLoading(true);
    setRouteError(null);
    try {
      const overlay = await buildTransitRouteOverlay(
        selected.id,
        selected.transitRoute,
        selected.lat != null && selected.lon != null
          ? { lat: selected.lat, lon: selected.lon }
          : null
      );
      setRouteOverlay(overlay);
    } catch (err) {
      setRouteError(`Impossible de tracer le trajet: ${(err as Error).message}`);
    } finally {
      setRouteLoading(false);
    }
  }, [selected, routeOverlay]);

  // Keep the detail panel mounted long enough to play its exit animation.
  const detailVisible = !!selected;
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
  const scanCardPhase = useScanCardVisibility(scan);
  const showEmpty = !isLoading && listings.length === 0 && !scanRunning;
  const showStageEmpty =
    !isLoading && listings.length > 0 && filteredForList.length === 0 && !scanRunning;
  const enabledSourceLabels = ALL_SOURCES.filter((s) => isAtlasSourceEnabled(profile.enabledSources, s));

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
      if (urlState.listing) updateUrl({ listing: null });
    },
    onEnter: () => {
      if (selected?.url) window.open(selected.url, '_blank', 'noopener');
    },
    onSlash: () => {
      const input = document.querySelector<HTMLInputElement>('input[aria-label="Rechercher une annonce"]');
      input?.focus();
    },
    onScan: () => {
      if (!scanRunning) startScan();
    },
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
          basemap={basemap}
          routeOverlay={routeOverlay}
        />
      </div>

      <TopBar
        profileSlug={activeProfileSlug ?? profile.slug}
        profileTitle={profile.shortTitle}
        zones={profile.zones}
        query={query}
        onQueryChange={setQuery}
        stages={stages}
        stage={urlState.stage}
        onStageChange={(stage) => updateUrl({ stage, listing: null })}
        onScan={() => startScan()}
        scanning={scanRunning}
        onProfileSelect={(slug) => {
          window.location.href = buildProfileDashboardUrl(slug);
        }}
      />

      <ListPanel
        zones={profile.zones}
        listings={showEmpty || showStageEmpty || isLoading ? [] : filteredForList}
        selectedId={urlState.listing}
        onSelect={(id) => updateUrl({ listing: id })}
        onArchive={handleArchive}
        onArchiveAll={handleArchiveAll}
        pendingIds={pendingIds}
        restoringIds={restoringPendingIds}
        generatedAt={profile.generatedAt}
        totalCount={isLoading ? undefined : filtered.length}
        scanStatus={<CommuteProgressBanner scan={scan} />}
        emptyContent={
          isLoading ? (
            <ListSkeleton />
          ) : showEmpty ? (
            <EmptyListPanel
              zonesCount={profile.zones.length}
              sources={enabledSourceLabels}
              onScan={() => startScan()}
            />
          ) : showStageEmpty ? (
            <StageEmpty stage={urlState.stage} query={query} />
          ) : null
        }
        sort={urlState.sort}
        onSortChange={(sort) => updateUrl({ sort })}
        sourceListings={stageScoped}
        sources={urlState.sources}
        onSourcesChange={(sources) => updateUrl({ sources, listing: null })}
      />

      {scanCardPhase !== 'hidden' && scan ? (
        <ScanCardConnector
          profile={profile}
          scan={scan}
          phase={scanCardPhase}
          onCancel={() => cancelScan()}
        />
      ) : null}

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
            const idx = filtered.findIndex((l) => l.id === id);
            const nextListing =
              idx >= 0 ? filtered[idx + 1] ?? filtered[idx - 1] ?? null : null;
            dismiss.mutate(id);
            updateUrl({ listing: nextListing ? nextListing.id : null });
          }}
          onVisualizeRoute={handleVisualizeRoute}
          routeVisualizing={!!routeOverlay && routeOverlay.listingId === detailRender.id}
          routeLoading={routeLoading}
        />
      ) : null}

      {routeError ? (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--atlas-paper)',
            boxShadow: 'var(--atlas-shadow-2), 0 0 0 1px var(--atlas-line)',
            padding: '8px 14px',
            borderRadius: 999,
            fontSize: 12,
            color: 'var(--atlas-ink-2)',
            zIndex: 5,
            maxWidth: 480
          }}
        >
          {routeError}
        </div>
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
        basemap={basemap}
        onBasemapChange={changeBasemap}
      />

      {pendingCount > 0 ? (
        <UndoToast count={pendingCount} onUndo={undoPending} bottomOffset={24} />
      ) : null}

      {isLoading ? <LoadingIndicator /> : null}
      {error ? <ErrorBanner message={(error as Error).message} /> : null}
    </div>
  );
}

function ScanCardConnector({
  profile,
  scan,
  phase,
  onCancel
}: {
  profile: AtlasProfile;
  scan: ScanJob;
  phase: 'running' | 'finished';
  onCancel: () => void;
}) {
  const { total, done, sources } = buildScanSources(profile, scan);
  const finished =
    phase === 'finished' && (scan.status === 'done' || scan.status === 'error' || scan.status === 'cancelled')
      ? {
          kind: scan.status,
          newCount: scan.newCount,
          message: scan.status === 'error' ? scan.error : undefined
        }
      : undefined;
  return (
    <ScanProgressCard
      total={total}
      done={done}
      sources={sources}
      onCancel={onCancel}
      onBackground={() => {
        /* card hides itself when scan completes; nothing to do here */
      }}
      finished={finished}
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

function StageEmpty({ stage, query }: { stage: string; query?: string }) {
  const trimmedQuery = query?.trim();
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
      {trimmedQuery ? `Aucune annonce pour "${trimmedQuery}"` : STAGE_EMPTY_COPY[stage] ?? 'Aucune annonce'}
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
