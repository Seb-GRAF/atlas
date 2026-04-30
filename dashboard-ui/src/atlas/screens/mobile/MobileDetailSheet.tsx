import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type TouchEvent
} from 'react';
import {
  AtlasButton,
  AtlasSegmentedControl,
  AtlasTextarea,
  Hairline,
  Icons,
  Mono,
  PhotoFrame,
  SourceMono,
  StatusPill,
  formatCHF
} from '../../components';
import { StatGrid } from '../StatGrid';
import type { AtlasListing, AtlasListingStatus } from '../../types';

type MobileDetailSheetProps = {
  listing: AtlasListing | null;
  onClose: () => void;
  onTogglePin: (id: string) => void;
  onStatusChange: (id: string, status: AtlasListingStatus) => void;
  onNotesChange: (id: string, notes: string) => void;
  onDismiss: (id: string) => void;
};

const STATUS_OPTIONS: { value: AtlasListingStatus; label: string }[] = [
  { value: 'À trier', label: 'À trier' },
  { value: 'À contacter', label: 'À contacter' },
  { value: 'Visite prévue', label: 'Visite' },
  { value: 'Dossier à envoyer', label: 'Dossier' }
];

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--atlas-ink-3)',
  fontWeight: 500
};

const DISMISS_THRESHOLD = 100;

export function MobileDetailSheet({
  listing,
  onClose,
  onTogglePin,
  onStatusChange,
  onNotesChange,
  onDismiss
}: MobileDetailSheetProps) {
  const [draftNotes, setDraftNotes] = useState(listing?.notes ?? '');
  const [dragY, setDragY] = useState(0);
  const dragStartRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    setDraftNotes(listing?.notes ?? '');
    setDragY(0);
  }, [listing?.id, listing?.notes]);

  if (!listing) return null;

  const statusValue: AtlasListingStatus = STATUS_OPTIONS.find(
    (s) => s.value === listing.status
  )
    ? listing.status
    : 'À trier';

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    dragStartRef.current = event.touches[0]?.clientY ?? null;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || dragStartRef.current == null) return;
    const current = event.touches[0]?.clientY ?? dragStartRef.current;
    const delta = current - dragStartRef.current;
    if (delta > 0) setDragY(delta);
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    if (dragY > DISMISS_THRESHOLD) {
      onClose();
    } else {
      setDragY(0);
    }
    dragStartRef.current = null;
  };

  const sheetStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 6,
    height: '75%',
    background: 'var(--atlas-paper)',
    borderRadius: '24px 24px 0 0',
    boxShadow: '0 -22px 50px -22px rgba(22,20,15,.32)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transform: `translateY(${dragY}px)`,
    transition: isDraggingRef.current ? 'none' : 'transform 220ms ease'
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        fontFamily: 'var(--atlas-sans)',
        color: 'var(--atlas-ink)'
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(22,20,15,.36)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          opacity: Math.max(0, 1 - dragY / 400),
          transition: isDraggingRef.current ? 'none' : 'opacity 220ms ease'
        }}
      />

      <div style={sheetStyle}>
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '8px 0 4px',
            cursor: 'grab',
            touchAction: 'none'
          }}
        >
          <span
            style={{
              width: 36,
              height: 4,
              borderRadius: 4,
              background: 'rgba(22,20,15,.18)'
            }}
          />
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 16px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}
        >
          <div style={{ position: 'relative' }}>
            <PhotoFrame images={listing.images} aspect="4 / 3" radius={16} />
            <button
              type="button"
              onClick={() => onTogglePin(listing.id)}
              aria-label={listing.pinned ? 'Désépingler' : 'Épingler'}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 36,
                height: 36,
                borderRadius: 999,
                border: 0,
                background: 'rgba(255,255,255,.92)',
                boxShadow: '0 4px 12px rgba(0,0,0,.16)',
                cursor: 'pointer',
                color: listing.pinned ? 'var(--atlas-ember)' : 'var(--atlas-ink-2)',
                display: 'grid',
                placeItems: 'center'
              }}
            >
              <Icons.Heart size={16} stroke={1.7} />
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 10
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={eyebrowStyle}>
                {[listing.area, String(listing.source).replace(/\.ch$/i, '')]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </div>
              <h2
                style={{
                  margin: '4px 0 0',
                  fontFamily: 'var(--atlas-sans)',
                  fontSize: 18,
                  fontWeight: 500,
                  letterSpacing: '-0.018em',
                  lineHeight: 1.25,
                  color: 'var(--atlas-ink)'
                }}
              >
                {listing.title}
              </h2>
              <div
                style={{
                  color: 'var(--atlas-ink-3)',
                  fontSize: 12.5,
                  marginTop: 4
                }}
              >
                {listing.address || '—'}
              </div>
            </div>
            {listing.totalChf != null ? (
              <Mono
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  letterSpacing: '-0.015em',
                  whiteSpace: 'nowrap',
                  color: 'var(--atlas-ink)'
                }}
              >
                {formatCHF(listing.totalChf)}
              </Mono>
            ) : null}
          </div>

          <StatGrid
            rooms={listing.rooms}
            surfaceM2={listing.surfaceM2}
            driveText={listing.driveText}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SourceMono source={listing.source} />
            <span style={{ fontSize: 12.5, color: 'var(--atlas-ink-2)' }}>
              {listing.source}
            </span>
            <span style={{ flex: 1 }} />
            <StatusPill status={listing.status} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={eyebrowStyle}>Statut</span>
            <AtlasSegmentedControl
              items={STATUS_OPTIONS}
              value={statusValue}
              onChange={(value) => onStatusChange(listing.id, value)}
            />
          </div>

          <AtlasTextarea
            value={draftNotes}
            onChange={(event) => setDraftNotes(event.target.value)}
            onBlur={() => {
              if (draftNotes !== listing.notes) onNotesChange(listing.id, draftNotes);
            }}
            placeholder="Notes — prochains pas, contact…"
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: 'var(--atlas-ink-3)',
              paddingBottom: 8
            }}
          >
            <span>{listing.publishedShort ? `Vu il y a ${listing.publishedShort}` : ''}</span>
            <span>{listing.publishedLabel}</span>
          </div>
        </div>

        <Hairline />
        <div
          style={{
            padding: `10px 16px calc(10px + env(safe-area-inset-bottom, 16px))`,
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 8
          }}
        >
          <AtlasButton
            variant="primary"
            onClick={() => listing.url && window.open(listing.url, '_blank', 'noopener')}
            disabled={!listing.url}
            leftSection={<Icons.External size={14} stroke={1.8} />}
          >
            Ouvrir l'annonce
          </AtlasButton>
          <AtlasButton
            variant="secondary"
            onClick={() => onDismiss(listing.id)}
            leftSection={<Icons.Close size={14} stroke={1.8} />}
          >
            Écarter
          </AtlasButton>
        </div>
      </div>
    </div>
  );
}
