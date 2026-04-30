import type { CSSProperties } from 'react';
import { GlassPanel, Hairline, Icons } from '../components';
import { ListingRow } from './ListingRow';
import type { AtlasListing } from '../types';

type ListPanelProps = {
  zones: string[];
  listings: AtlasListing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  generatedAt: string;
  totalCount?: number;
  emptyContent?: React.ReactNode;
  scanStatus?: React.ReactNode;
};

const panelStyle: CSSProperties = {
  position: 'absolute',
  left: 16,
  top: 76,
  bottom: 16,
  width: 380,
  zIndex: 4,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const eyebrowStyle: CSSProperties = {
  fontFamily: 'var(--atlas-sans)',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--atlas-ink-3)'
};

function formatZones(zones: string[]) {
  if (zones.length === 0) return '—';
  if (zones.length <= 3) return zones.join(' · ').toUpperCase();
  const head = zones.slice(0, 3).join(' · ').toUpperCase();
  return `${head} +${zones.length - 3}`;
}

export function ListPanel({
  zones,
  listings,
  selectedId,
  onSelect,
  generatedAt,
  totalCount,
  emptyContent,
  scanStatus
}: ListPanelProps) {
  const count = totalCount ?? listings.length;

  return (
    <GlassPanel variant="panel" style={panelStyle}>
      <div style={{ padding: '16px 18px 12px' }}>
        <div style={eyebrowStyle}>{formatZones(zones)}</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginTop: 6,
            gap: 12
          }}
        >
          <div
            style={{
              fontFamily: 'var(--atlas-sans)',
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              color: 'var(--atlas-ink)'
            }}
          >
            {count} appartement{count > 1 ? 's' : ''}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 2
            }}
          >
            <button
              type="button"
              style={{
                background: 'transparent',
                border: 0,
                fontFamily: 'var(--atlas-sans)',
                fontSize: 12,
                color: 'var(--atlas-ink-2)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              Trier
              <Icons.ChevronDown size={11} stroke={1.6} />
            </button>
            {generatedAt ? (
              <span style={{ fontSize: 10.5, color: 'var(--atlas-ink-3)' }}>maj. {generatedAt}</span>
            ) : null}
          </div>
        </div>
      </div>

      {scanStatus ?? null}
      <Hairline />

      {listings.length === 0 && emptyContent ? (
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 18px' }}>{emptyContent}</div>
      ) : (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 8px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}
        >
          {listings.map((listing) => (
            <ListingRow
              key={listing.id}
              listing={listing}
              selected={listing.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </GlassPanel>
  );
}
