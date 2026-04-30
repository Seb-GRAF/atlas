import type { CSSProperties } from 'react';
import { GlassPill, Icons } from '../../components';
import { MobileListRow } from './MobileListRow';
import type {
  AtlasListing,
  AtlasProfile,
  AtlasStage,
  AtlasStageValue
} from '../../types';

type MobileListProps = {
  profile: AtlasProfile;
  listings: AtlasListing[];
  stages: AtlasStage[];
  stage: AtlasStageValue;
  onStageChange: (stage: AtlasStageValue) => void;
  onSelect: (id: string) => void;
  onOpenMap: () => void;
  onScan: () => void;
  scanning: boolean;
};

const rootStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--atlas-bg)',
  fontFamily: 'var(--atlas-sans)',
  color: 'var(--atlas-ink)'
};

const topBarStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 6,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 12px',
  background: 'rgba(253,251,247,.86)',
  backdropFilter: 'blur(24px) saturate(170%)',
  WebkitBackdropFilter: 'blur(24px) saturate(170%)',
  boxShadow: '0 1px 0 rgba(22,20,15,.06)'
};

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--atlas-ink-3)',
  fontWeight: 500
};

const sortBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 10px',
  borderRadius: 999,
  background: 'var(--atlas-soft)',
  fontSize: 11.5,
  color: 'var(--atlas-ink-2)',
  border: 0,
  cursor: 'pointer',
  fontFamily: 'var(--atlas-sans)'
};

const carteFabStyle: CSSProperties = {
  position: 'absolute',
  right: 16,
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
};

function formatZones(zones: string[], shortTitle: string) {
  if (zones.length === 0) return shortTitle.toUpperCase() || '—';
  if (zones.length <= 3) return zones.join(' · ').toUpperCase();
  return `${zones.slice(0, 3).join(' · ').toUpperCase()} +${zones.length - 3}`;
}

export function MobileList({
  profile,
  listings,
  stages,
  stage,
  onStageChange,
  onSelect,
  onOpenMap,
  onScan,
  scanning
}: MobileListProps) {
  const count = listings.length;
  const eyebrow = formatZones(profile.zones, profile.shortTitle);

  return (
    <div style={rootStyle}>
      <div style={topBarStyle}>
        <GlassPill padding="6px 10px">
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: 'var(--atlas-ink)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--atlas-mono)',
              fontSize: 11,
              fontWeight: 600
            }}
          >
            A
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--atlas-ink-2)' }}>
            {profile.shortTitle}
          </span>
        </GlassPill>

        <span style={{ flex: 1 }} />

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

        <GlassPill
          as="button"
          padding="6px 12px"
          onClick={onScan}
          aria-label={scanning ? 'Scan en cours' : 'Lancer un scan'}
          style={{ gap: 6 }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: scanning ? 'var(--atlas-ember)' : 'oklch(78% 0.12 150)',
              animation: scanning ? 'v2pulse 1.4s ease-in-out infinite' : undefined,
              display: 'inline-block'
            }}
          />
          <span style={{ fontSize: 12.5, fontWeight: 500 }}>
            {scanning ? 'Scan…' : 'Scanner'}
          </span>
        </GlassPill>
      </div>

      <div
        style={{
          padding: '12px 12px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={eyebrowStyle}>{eyebrow}</div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 500,
              marginTop: 2,
              letterSpacing: '-0.018em'
            }}
          >
            {count} appartement{count > 1 ? 's' : ''}
          </div>
        </div>
        <button type="button" style={sortBtnStyle}>
          Plus récents
          <Icons.ChevronDown size={11} stroke={1.7} />
        </button>
      </div>

      <div
        style={{
          padding: '8px 12px 12px',
          display: 'flex',
          gap: 6,
          overflowX: 'auto'
        }}
      >
        {stages.map((s) => {
          const active = s.value === stage;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onStageChange(s.value)}
              style={{
                padding: '7px 12px',
                borderRadius: 999,
                fontSize: 12.5,
                color: active ? '#fff' : 'var(--atlas-ink-2)',
                background: active ? 'var(--atlas-ink)' : 'var(--atlas-paper)',
                boxShadow: active ? 'none' : 'inset 0 0 0 1px var(--atlas-line)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                border: 0,
                cursor: 'pointer',
                fontFamily: 'var(--atlas-sans)'
              }}
            >
              {s.label}{' '}
              <span
                style={{
                  fontFamily: 'var(--atlas-mono)',
                  fontSize: 10.5,
                  opacity: active ? 0.7 : 0.55,
                  marginLeft: 4
                }}
              >
                {s.count}
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: `0 12px calc(110px + env(safe-area-inset-bottom, 16px))`
        }}
      >
        {listings.length === 0 ? (
          <div
            style={{
              padding: '40px 12px',
              textAlign: 'center',
              color: 'var(--atlas-ink-3)',
              fontSize: 13
            }}
          >
            Aucune annonce dans ce filtre.
          </div>
        ) : (
          listings.map((listing) => (
            <MobileListRow key={listing.id} listing={listing} onSelect={onSelect} />
          ))
        )}
      </div>

      <button type="button" onClick={onOpenMap} style={carteFabStyle}>
        <Icons.Map size={16} stroke={1.8} /> Carte
      </button>
    </div>
  );
}
