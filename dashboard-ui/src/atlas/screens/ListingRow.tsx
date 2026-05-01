import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { Icons, Mono, formatCHF } from '../components';
import type { AtlasListing } from '../types';
import { CommuteChips } from './CommuteChips';
import { useSwipeToArchive } from './useSwipeToArchive';

type ListingRowProps = {
  listing: AtlasListing;
  selected: boolean;
  onSelect: (id: string) => void;
  onArchive?: (id: string) => void;
};

const eyebrowStyle: CSSProperties = {
  fontFamily: 'var(--atlas-sans)',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--atlas-ink-3)'
};

const wrapperStyle: CSSProperties = {
  position: 'relative',
  borderRadius: 14,
  flexShrink: 0,
  overflow: 'hidden'
};

const actionLayerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px',
  background: 'var(--atlas-soft, rgba(22,20,15,.06))',
  fontFamily: 'var(--atlas-sans)',
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: 600,
  pointerEvents: 'none',
  borderRadius: 14
};

const actionPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6
};

const SWIPE_THRESHOLD = 96;

export function ListingRow({ listing, selected, onSelect, onArchive }: ListingRowProps) {
  const cover = listing.images[0];
  const meta = [
    listing.rooms != null ? `${listing.rooms} pces` : null,
    listing.surfaceM2 != null ? `${listing.surfaceM2} m²` : null
  ]
    .filter(Boolean)
    .join(' · ');

  const swipeEnabled = !!onArchive;
  const swipe = useSwipeToArchive({
    threshold: SWIPE_THRESHOLD,
    onCommit: () => {
      onArchive?.(listing.id);
    }
  });

  const suppressClickRef = useRef(false);

  const open = () => {
    if (suppressClickRef.current) return;
    onSelect(listing.id);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  };

  const onPointerUpWrapped = (e: PointerEvent<HTMLDivElement>) => {
    suppressClickRef.current = swipe.swiping || !!swipe.committed;
    swipe.handlers.onPointerUp(e);
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const handlers = swipeEnabled
    ? {
        onPointerDown: swipe.handlers.onPointerDown,
        onPointerMove: swipe.handlers.onPointerMove,
        onPointerUp: onPointerUpWrapped,
        onPointerCancel: swipe.handlers.onPointerCancel
      }
    : null;

  const tx = swipeEnabled ? swipe.translateX : 0;
  const isDragging = swipeEnabled && swipe.swiping;
  const released = swipeEnabled && !swipe.swiping;
  const past = Math.abs(tx) > SWIPE_THRESHOLD;
  const actionOpacity = swipeEnabled ? Math.min(1, Math.abs(tx) / SWIPE_THRESHOLD) : 0;

  return (
    <div style={wrapperStyle}>
      {swipeEnabled && tx !== 0 ? (
        <div
          style={{
            ...actionLayerStyle,
            opacity: actionOpacity,
            color: past ? 'var(--atlas-ember, #c43d2a)' : 'var(--atlas-ink-2)'
          }}
          aria-hidden
        >
          <span style={{ ...actionPillStyle, opacity: tx > 0 ? 1 : 0 }}>
            <Icons.Close size={14} stroke={2} />
            Archiver
          </span>
          <span style={{ ...actionPillStyle, opacity: tx < 0 ? 1 : 0 }}>
            Archiver
            <Icons.Close size={14} stroke={2} />
          </span>
        </div>
      ) : null}
      <div
        role="button"
        tabIndex={0}
        aria-label={listing.title}
        onClick={open}
        onKeyDown={onKeyDown}
        {...(handlers ?? {})}
        style={{
          display: 'block',
          width: '100%',
          boxSizing: 'border-box',
          textAlign: 'left',
          padding: 8,
          borderRadius: 14,
          background: selected ? '#fff' : tx !== 0 ? 'var(--atlas-bg, #f6f3ee)' : 'transparent',
          boxShadow: selected
            ? '0 6px 18px -10px rgba(22,20,15,.25), 0 0 0 1px rgba(22,20,15,.06)'
            : 'none',
          border: 0,
          cursor: 'pointer',
          touchAction: 'pan-y',
          transition: released && !isDragging
            ? 'transform 220ms cubic-bezier(.2,.8,.2,1), background 140ms ease, box-shadow 140ms ease'
            : 'background 140ms ease, box-shadow 140ms ease',
          transform: tx !== 0 ? `translate3d(${tx}px, 0, 0)` : undefined,
          position: 'relative'
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '92px 1fr',
            gap: 12,
            alignItems: 'start'
          }}
        >
          <div
            style={{
              position: 'relative',
              width: 92,
              height: 92,
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
      </div>
    </div>
  );
}
