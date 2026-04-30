import { useMemo, type CSSProperties } from 'react';
import {
  AtlasMap,
  GlassPanel,
  GlassPill,
  Icons,
  MapControls,
  Mono,
  formatCHF,
  type AtlasMapPin
} from '../../components';
import type {
  AtlasListing,
  AtlasProfile,
  AtlasStage,
  AtlasStageValue
} from '../../types';

const VEVEY_FALLBACK = { lat: 46.47, lon: 6.84, zoom: 11 };

type MobileMapProps = {
  profile: AtlasProfile;
  listings: AtlasListing[];
  selectedId: string | null;
  stages: AtlasStage[];
  stage: AtlasStageValue;
  onStageChange: (stage: AtlasStageValue) => void;
  onSelect: (id: string) => void;
  onOpenList: () => void;
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
  top: 16,
  left: 12,
  right: 12,
  zIndex: 6,
  display: 'flex',
  alignItems: 'center',
  gap: 8
};

const chipsRowStyle: CSSProperties = {
  position: 'absolute',
  top: 64,
  left: 0,
  right: 0,
  zIndex: 5,
  display: 'flex',
  gap: 6,
  padding: '0 12px',
  overflowX: 'auto',
  pointerEvents: 'auto'
};

export function MobileMap({
  profile,
  listings,
  selectedId,
  stages,
  stage,
  onStageChange,
  onSelect,
  onOpenList
}: MobileMapProps) {
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
        totalChf: l.totalChf as number
      })),
    [visible]
  );

  const initialCenter = profile.workplaceCoords
    ? { lat: profile.workplaceCoords.lat, lon: profile.workplaceCoords.lon, zoom: 11 }
    : VEVEY_FALLBACK;

  const selected =
    listings.find((l) => l.id === selectedId) ?? visible[0] ?? null;

  return (
    <div style={rootStyle}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <AtlasMap
          pins={pins}
          selectedId={selected?.id ?? null}
          onSelect={(id) => id && onSelect(id)}
          showWorkplace={!!profile.workplaceCoords}
          workplaceLabel={profile.workplace ? `Travail · ${profile.workplace}` : 'Travail'}
          workplace={profile.workplaceCoords ?? undefined}
          initialCenter={initialCenter}
          mode="warm"
        />
      </div>

      <div style={topBarStyle}>
        <GlassPill padding="8px 12px" style={{ flex: 1, gap: 8 }}>
          <Icons.Search size={14} stroke={1.7} style={{ color: 'var(--atlas-ink-3)' }} />
          <span style={{ flex: 1, color: 'var(--atlas-ink-3)', fontSize: 13 }}>
            Vevey, Lutry…
          </span>
        </GlassPill>
        <GlassPill as="button" padding="8px 10px" aria-label="Filtres">
          <Icons.Filter size={15} stroke={1.7} />
          {profile.newCount > 0 ? (
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: 'var(--atlas-ember)'
              }}
            />
          ) : null}
        </GlassPill>
      </div>

      <div style={chipsRowStyle}>
        {stages.map((s) => {
          const active = s.value === stage;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onStageChange(s.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 500,
                fontFamily: 'var(--atlas-sans)',
                whiteSpace: 'nowrap',
                background: active
                  ? 'rgba(22,20,15,.92)'
                  : 'var(--atlas-glass-pill-bg)',
                backdropFilter: 'var(--atlas-glass-pill-blur)',
                WebkitBackdropFilter: 'var(--atlas-glass-pill-blur)',
                color: active ? '#fff' : 'var(--atlas-ink-2)',
                boxShadow: 'var(--atlas-shadow-1)',
                border: 0,
                cursor: 'pointer'
              }}
            >
              {s.label} · <span style={{ fontFamily: 'var(--atlas-mono)' }}>{s.count}</span>
            </button>
          );
        })}
      </div>

      <MapControls
        size={40}
        style={{
          position: 'absolute',
          right: 12,
          top: 116,
          zIndex: 5
        }}
      />

      {visible.length > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: `calc(env(safe-area-inset-bottom, 16px) + 88px)`,
            zIndex: 6,
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            paddingBottom: 4
          }}
        >
          {visible.slice(0, 12).map((listing) => (
            <MiniCard
              key={listing.id}
              listing={listing}
              selected={listing.id === selected?.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onOpenList}
        style={{
          position: 'absolute',
          left: 16,
          bottom: `calc(env(safe-area-inset-bottom, 16px) + 80px)`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 18px',
          borderRadius: 999,
          background: 'var(--atlas-ink)',
          color: '#fff',
          fontSize: 13.5,
          fontWeight: 500,
          boxShadow: '0 14px 30px -10px rgba(22,20,15,.4)',
          zIndex: 5,
          border: 0,
          cursor: 'pointer',
          fontFamily: 'var(--atlas-sans)'
        }}
      >
        <Icons.List size={16} stroke={1.8} /> Liste
      </button>
    </div>
  );
}

type MiniCardProps = {
  listing: AtlasListing;
  selected: boolean;
  onSelect: (id: string) => void;
};

function MiniCard({ listing, selected, onSelect }: MiniCardProps) {
  const cover = listing.images[0];
  const meta = [
    listing.rooms != null ? `${listing.rooms} pces` : null,
    listing.surfaceM2 != null ? `${listing.surfaceM2} m²` : null,
    listing.transitText
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <GlassPanel
      variant="panel"
      style={{
        flex: '0 0 280px',
        scrollSnapAlign: 'start',
        borderRadius: 18,
        padding: 10,
        cursor: 'pointer',
        outline: selected ? '2px solid var(--atlas-ink)' : 'none',
        outlineOffset: -2,
        transition: 'outline 140ms ease'
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
  );
}
