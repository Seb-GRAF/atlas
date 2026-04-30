import type { CSSProperties } from 'react';
import { Icons, Mono, formatCHF } from '../components';
import type { AtlasListing } from '../types';
import { CommuteChips } from './CommuteChips';

type ListingRowProps = {
  listing: AtlasListing;
  selected: boolean;
  onSelect: (id: string) => void;
};

const eyebrowStyle: CSSProperties = {
  fontFamily: 'var(--atlas-sans)',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--atlas-ink-3)'
};

export function ListingRow({ listing, selected, onSelect }: ListingRowProps) {
  const cover = listing.images[0];
  const meta = [
    listing.rooms != null ? `${listing.rooms} pces` : null,
    listing.surfaceM2 != null ? `${listing.surfaceM2} m²` : null
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      onClick={() => onSelect(listing.id)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: 8,
        borderRadius: 14,
        background: selected ? '#fff' : 'transparent',
        boxShadow: selected
          ? '0 6px 18px -10px rgba(22,20,15,.25), 0 0 0 1px rgba(22,20,15,.06)'
          : 'none',
        border: 0,
        cursor: 'pointer',
        transition: 'background 140ms ease, box-shadow 140ms ease'
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '92px 1fr',
          gap: 12,
          alignItems: 'stretch'
        }}
      >
        <div
          style={{
            position: 'relative',
            aspectRatio: '1',
            borderRadius: 10,
            background: cover ? `center/cover url(${JSON.stringify(cover)})` : 'var(--atlas-soft)',
            overflow: 'hidden'
          }}
        >
          {listing.pinned ? (
            <span
              style={{
                position: 'absolute',
                top: 6,
                left: 6,
                width: 22,
                height: 22,
                borderRadius: 999,
                background: 'var(--atlas-ink)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center'
              }}
            >
              <Icons.Pin size={11} stroke={2} />
            </span>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span
              style={{
                ...eyebrowStyle,
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {listing.area || '—'}
            </span>
            {listing.isNew ? (
              <>
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 999,
                    background: 'var(--atlas-ember)'
                  }}
                />
                <span style={{ ...eyebrowStyle, color: 'var(--atlas-ember)' }}>NOUVEAU</span>
              </>
            ) : null}
          </div>

          <div
            style={{
              fontFamily: 'var(--atlas-sans)',
              fontSize: 13.5,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              color: 'var(--atlas-ink)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {listing.title}
          </div>

          <div
            style={{
              fontFamily: 'var(--atlas-sans)',
              fontSize: 12,
              color: 'var(--atlas-ink-3)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {meta || '—'}
          </div>

          <CommuteChips listing={listing} compact style={{ marginTop: 3 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {listing.totalChf != null ? (
              <>
                <Mono style={{ fontSize: 14, fontWeight: 500 }}>{formatCHF(listing.totalChf)}</Mono>
                <span style={{ fontSize: 11, color: 'var(--atlas-ink-3)' }}>CHF</span>
              </>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--atlas-ink-3)' }}>Prix n/a</span>
            )}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: 'var(--atlas-ink-3)' }}>{listing.publishedLabel}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
