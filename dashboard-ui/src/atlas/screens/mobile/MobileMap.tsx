import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  AtlasMap,
  GlassPanel,
  GlassPill,
  Icons,
  MapControls,
  Mono,
  formatCHF,
  type AtlasMapHandle,
  type AtlasMapPin
} from '../../components';
import { loadBasemap, saveBasemap, type Basemap } from '../../mapPrefs';
import { SourcesFilter } from '../SourcesFilter';
import type {
  AtlasListing,
  AtlasProfile,
  AtlasStage,
  AtlasStageValue,
  RouteOverlay
} from '../../types';

const VEVEY_FALLBACK = { lat: 46.47, lon: 6.84, zoom: 11 };
const MAP_PIN_DETAIL_DELAY_MS = 380;

type MobileMapProps = {
  profile: AtlasProfile;
  listings: AtlasListing[];
  selectedId: string | null;
  stages: AtlasStage[];
  stage: AtlasStageValue;
  onStageChange: (stage: AtlasStageValue) => void;
  onSelect: (id: string) => void;
  onOpenProfileSwitcher: () => void;
  routeOverlay?: RouteOverlay | null;
  sourceListings?: AtlasListing[];
  sources?: string[];
  onSourcesChange?: (next: string[]) => void;
};

const rootStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'var(--atlas-bg)',
  fontFamily: 'var(--atlas-sans)',
  color: 'var(--atlas-ink)',
  overflow: 'hidden'
};

const topBarStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
  left: 12,
  right: 12,
  zIndex: 6,
  display: 'flex',
  alignItems: 'center',
  gap: 8
};

const STAGE_LABEL_FALLBACK = 'À trier';

function formatZonesShort(zones: string[], shortTitle: string) {
  if (zones.length === 0) return shortTitle || 'Filtres';
  if (zones.length === 1) return zones[0];
  return `${zones[0]} +${zones.length - 1}`;
}

export function MobileMap({
  profile,
  listings,
  selectedId,
  stages,
  stage,
  onStageChange,
  onSelect,
  onOpenProfileSwitcher,
  routeOverlay,
  sourceListings,
  sources,
  onSourcesChange
}: MobileMapProps) {
  const mapHandle = useRef<AtlasMapHandle>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [basemap, setBasemap] = useState<Basemap>(() => loadBasemap());
  const changeBasemap = useCallback((next: Basemap) => {
    setBasemap(next);
    saveBasemap(next);
  }, []);
  // The carousel-driven focus is local: swiping highlights a pin and pans the
  // map without opening the detail sheet. Tapping a card or pin still calls
  // `onSelect` which lifts to the URL and opens detail.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const focusSourceRef = useRef<'external' | 'carousel'>('external');
  // Suppress carousel scroll focus while we're programmatically scrolling
  // a pin-tapped card into view, so focus doesn't bounce to a mid-animation card.
  const suppressObserverRef = useRef(false);
  const pendingMapSelectTimerRef = useRef<number | null>(null);

  const visible = useMemo(
    () => listings.filter((l) => l.lat != null && l.lon != null && l.totalChf != null),
    [listings]
  );

  const pins = useMemo<AtlasMapPin[]>(
    () =>
      visible.map((l) => ({
        id: l.id,
        lat: l.lat as number,
        lon: l.lon as number,
        totalChf: l.totalChf as number,
        precision: l.locationPrecision
      })),
    [visible]
  );

  const initialCenter = profile.workplaceCoords
    ? { lat: profile.workplaceCoords.lat, lon: profile.workplaceCoords.lon, zoom: 11 }
    : VEVEY_FALLBACK;

  const carouselListings = useMemo(() => visible.slice(0, 12), [visible]);

  // Mirror URL selection into local focus so the carousel scrolls to the right
  // card on back/forward and on detail-sheet open. We deliberately don't
  // auto-focus the first listing on mount — that would trump the initial
  // fitBounds in AtlasMap and zoom into a single pin.
  useEffect(() => {
    if (selectedId) {
      focusSourceRef.current = 'external';
      setFocusedId(selectedId);
    }
  }, [selectedId]);

  const clearPendingMapSelect = useCallback(() => {
    if (pendingMapSelectTimerRef.current == null) return;
    window.clearTimeout(pendingMapSelectTimerRef.current);
    pendingMapSelectTimerRef.current = null;
  }, []);

  useEffect(() => clearPendingMapSelect, [clearPendingMapSelect]);

  const handleMapSelect = useCallback(
    (id: string | null) => {
      clearPendingMapSelect();
      if (!id) {
        setFocusedId(null);
        return;
      }
      focusSourceRef.current = 'external';
      setFocusedId(id);
      pendingMapSelectTimerRef.current = window.setTimeout(() => {
        pendingMapSelectTimerRef.current = null;
        onSelect(id);
      }, MAP_PIN_DETAIL_DELAY_MS);
    },
    [clearPendingMapSelect, onSelect]
  );

  const handleCardSelect = useCallback(
    (id: string) => {
      clearPendingMapSelect();
      onSelect(id);
    },
    [clearPendingMapSelect, onSelect]
  );

  // Drop a stale focus if the underlying listing leaves the carousel (e.g.
  // stage filter change).
  useEffect(() => {
    setFocusedId((current) => {
      if (!current) return null;
      return carouselListings.some((l) => l.id === current) ? current : null;
    });
  }, [carouselListings]);

  // Carousel → map: update focus on the next animation frame during scroll so
  // the background and pin follow the card the user has already swiped into place.
  useEffect(() => {
    const root = carouselRef.current;
    if (!root || carouselListings.length === 0) return;

    const computeNearest = (): string | null => {
      const rootRect = root.getBoundingClientRect();
      // Match the card snap alignment (start), padded by `scrollPaddingLeft`.
      // Anchor on the card's left edge instead of its center so the picked
      // card matches the snap point, not the visually-centered one.
      const anchor = rootRect.left + 12;
      let bestId: string | null = null;
      let bestDist = Infinity;
      for (const [id, el] of cardRefs.current) {
        const r = el.getBoundingClientRect();
        const dist = Math.abs(r.left - anchor);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = id;
        }
      }
      return bestId;
    };

    const commit = () => {
      if (suppressObserverRef.current) return;
      const id = computeNearest();
      if (id) {
        focusSourceRef.current = 'carousel';
        setFocusedId(id);
      }
    };

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        commit();
      });
    };
    const onScrollEnd = () => commit();
    const onUserGestureStart = () => {
      suppressObserverRef.current = false;
    };

    root.addEventListener('scroll', onScroll, { passive: true });
    root.addEventListener('scrollend', onScrollEnd);
    root.addEventListener('pointerdown', onUserGestureStart, { passive: true });
    root.addEventListener('touchstart', onUserGestureStart, { passive: true });
    root.addEventListener('wheel', onUserGestureStart, { passive: true });
    return () => {
      root.removeEventListener('scroll', onScroll);
      root.removeEventListener('scrollend', onScrollEnd);
      root.removeEventListener('pointerdown', onUserGestureStart);
      root.removeEventListener('touchstart', onUserGestureStart);
      root.removeEventListener('wheel', onUserGestureStart);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [carouselListings]);

  // Map → carousel: when focus moves (e.g. user taps a pin and `selectedId`
  // updates, or external state change), scroll the matching card into view.
  useEffect(() => {
    if (!focusedId) return;
    const card = cardRefs.current.get(focusedId);
    if (!card) return;
    if (focusSourceRef.current === 'carousel') return;
    suppressObserverRef.current = true;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    const t = window.setTimeout(() => {
      suppressObserverRef.current = false;
    }, 450);
    return () => window.clearTimeout(t);
  }, [focusedId]);

  const activeId = focusedId ?? selectedId;
  const selected = activeId ? listings.find((l) => l.id === activeId) ?? null : null;
  const zoneLabel = formatZonesShort(profile.zones, profile.shortTitle);

  useEffect(() => {
    if (!filterOpen) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (filterPopoverRef.current?.contains(target)) return;
      if (filterButtonRef.current?.contains(target)) return;
      setFilterOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFilterOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [filterOpen]);

  const activeStage = stages.find((s) => s.value === stage);
  const stageLabelRaw = activeStage?.label ?? STAGE_LABEL_FALLBACK;
  const stageLabel = stageLabelRaw.replace(/^à\s+/i, '').toLowerCase();
  const stageCount = activeStage?.count ?? 0;
  const sourcesActive = (sources?.length ?? 0) > 0;
  const sourcesSummary = sourcesActive
    ? sources!.length === 1
      ? sources![0].replace(/\.ch$/i, '')
      : `${sources!.length} sources`
    : null;

  return (
    <div style={rootStyle}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <AtlasMap
          ref={mapHandle}
          pins={pins}
          selectedId={selected?.id ?? null}
          onSelect={handleMapSelect}
          showWorkplace={!!profile.workplaceCoords}
          workplaceLabel={profile.workplace ? `Travail · ${profile.workplace}` : 'Travail'}
          workplace={profile.workplaceCoords ?? undefined}
          initialCenter={initialCenter}
          basemap={basemap}
          routeOverlay={routeOverlay}
        />
      </div>

      <div style={topBarStyle}>
        <GlassPill
          as="button"
          padding="6px 10px 6px 6px"
          onClick={onOpenProfileSwitcher}
          aria-label="Choisir un profil"
          style={{ flex: 1, gap: 8, justifyContent: 'flex-start', minWidth: 0 }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              background: 'var(--atlas-ink)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--atlas-mono)',
              fontSize: 11,
              fontWeight: 600,
              flex: '0 0 auto'
            }}
          >
            A
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              color: 'var(--atlas-ink)',
              fontSize: 13,
              fontWeight: 500,
              textAlign: 'left',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {profile.shortTitle || zoneLabel}
          </span>
          <Icons.ChevronDown size={12} stroke={1.6} style={{ color: 'var(--atlas-ink-3)', flex: '0 0 auto' }} />
        </GlassPill>
        <button
          ref={filterButtonRef}
          type="button"
          aria-expanded={filterOpen}
          aria-haspopup="dialog"
          onClick={() => setFilterOpen((open) => !open)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 999,
            border: 0,
            cursor: 'pointer',
            background: 'var(--atlas-glass-pill-bg)',
            backdropFilter: 'var(--atlas-glass-pill-blur)',
            WebkitBackdropFilter: 'var(--atlas-glass-pill-blur)',
            boxShadow: 'var(--atlas-shadow-1)',
            fontFamily: 'var(--atlas-sans)'
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--atlas-ink)' }}>
            {stageLabel}
          </span>
          <span
            style={{
              fontFamily: 'var(--atlas-mono)',
              color: 'var(--atlas-ink-3)',
              fontSize: 11.5
            }}
          >
            {stageCount}
          </span>
          {sourcesSummary ? (
            <>
              <span style={{ width: 1, height: 12, background: 'var(--atlas-line)' }} />
              <span style={{ color: 'var(--atlas-ink-2)', fontSize: 12 }}>{sourcesSummary}</span>
            </>
          ) : null}
          <Icons.ChevronDown size={12} stroke={1.6} style={{ color: 'var(--atlas-ink-3)' }} />
        </button>
      </div>

      {filterOpen ? (
          <div
            ref={filterPopoverRef}
            role="dialog"
            aria-label="Filtres rapides"
            style={{
              position: 'fixed',
              top: 'calc(env(safe-area-inset-top, 0px) + 56px)',
              left: 12,
              right: 12,
              padding: '12px 12px 10px',
              borderRadius: 14,
              background: 'var(--atlas-paper)',
              boxShadow: 'var(--atlas-shadow-2), 0 0 0 1px var(--atlas-line)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              zIndex: 7,
              animation: 'atlas-popover-in 160ms ease-out',
              transformOrigin: 'top left'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span
                style={{
                  fontFamily: 'var(--atlas-sans)',
                  fontSize: 10.5,
                  fontWeight: 500,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--atlas-ink-3)'
                }}
              >
                Étape
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {stages.map((s) => {
                  const active = s.value === stage;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => {
                        onStageChange(s.value);
                        setFilterOpen(false);
                      }}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 500,
                        fontFamily: 'var(--atlas-sans)',
                        whiteSpace: 'nowrap',
                        background: active ? 'var(--atlas-ink)' : 'transparent',
                        color: active ? '#fff' : 'var(--atlas-ink-2)',
                        border: 0,
                        boxShadow: active ? 'none' : 'inset 0 0 0 1px var(--atlas-line)',
                        cursor: 'pointer'
                      }}
                    >
                      {s.label} ·{' '}
                      <span style={{ fontFamily: 'var(--atlas-mono)' }}>{s.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {sourceListings && sources && onSourcesChange ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span
                  style={{
                    fontFamily: 'var(--atlas-sans)',
                    fontSize: 10.5,
                    fontWeight: 500,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--atlas-ink-3)'
                  }}
                >
                  Sources
                </span>
                <SourcesFilter
                  listings={sourceListings}
                  selected={sources}
                  onChange={onSourcesChange}
                  compact
                />
              </div>
            ) : null}
          </div>
      ) : null}

      <MapControls
        size={40}
        style={{
          position: 'absolute',
          right: 12,
          top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
          zIndex: 5
        }}
        onZoomIn={() => mapHandle.current?.zoomIn()}
        onZoomOut={() => mapHandle.current?.zoomOut()}
        onCompass={() => mapHandle.current?.resetBearing()}
        basemap={basemap}
        onBasemapChange={changeBasemap}
      />

      {carouselListings.length > 0 ? (
        <div
          ref={carouselRef}
          className="atlas-no-scrollbar"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: `calc(env(safe-area-inset-bottom, 16px) + 84px)`,
            zIndex: 6,
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            scrollPaddingLeft: 12,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {carouselListings.map((listing) => (
            <MiniCard
              key={listing.id}
              listing={listing}
              selected={listing.id === activeId}
              registerRef={(el) => {
                if (el) cardRefs.current.set(listing.id, el);
                else cardRefs.current.delete(listing.id);
              }}
              onSelect={handleCardSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type MiniCardProps = {
  listing: AtlasListing;
  selected: boolean;
  onSelect: (id: string) => void;
  registerRef: (el: HTMLDivElement | null) => void;
};

function MiniCard({ listing, selected, onSelect, registerRef }: MiniCardProps) {
  const cover = listing.images[0];
  const meta = [
    listing.rooms != null ? `${listing.rooms} pces` : null,
    listing.surfaceM2 != null ? `${listing.surfaceM2} m²` : null,
    listing.transitText
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      ref={registerRef}
      data-listing-id={listing.id}
      style={{
        flex: '0 0 280px',
        scrollSnapAlign: 'start',
        opacity: selected ? 1 : 0.5,
        transition: 'opacity 140ms ease'
      }}
    >
    <GlassPanel
      variant="panel"
      style={{
        borderRadius: 18,
        padding: 10,
        cursor: 'pointer',
        background: 'var(--atlas-glass-pill-bg)',
        outline: 'none',
        transition: 'background 140ms ease',
        boxShadow:
          '0 4px 10px -6px rgba(22, 20, 15, 0.18), 0 0 0 1px rgba(22, 20, 15, 0.04)'
      }}
      onClick={() => onSelect(listing.id)}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '96px 1fr',
          gap: 10,
          alignItems: 'stretch'
        }}
      >
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 12,
            background: cover
              ? `center/cover no-repeat url(${JSON.stringify(cover)})`
              : 'var(--atlas-soft)'
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            paddingTop: 2,
            minWidth: 0
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--atlas-ink-3)'
            }}
          >
            {listing.area || '—'}
          </div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--atlas-ink)'
            }}
          >
            {listing.title}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--atlas-ink-3)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {meta || '—'}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 4
            }}
          >
            {listing.totalChf != null ? (
              <Mono style={{ fontSize: 14, fontWeight: 500 }}>
                {formatCHF(listing.totalChf)}
                <span style={{ fontSize: 11, color: 'var(--atlas-ink-3)', marginLeft: 3 }}>CHF</span>
              </Mono>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--atlas-ink-3)' }}>n/a</span>
            )}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 10.5, color: 'var(--atlas-ink-3)' }}>
              {listing.publishedShort}
            </span>
          </div>
        </div>
      </div>
    </GlassPanel>
    </div>
  );
}
