import { useEffect, useState, type CSSProperties } from 'react';
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
  formatCHF,
  useLightbox
} from '../../components';
import { StatGrid } from '../StatGrid';
import { CommuteTimeline } from '../CommuteTimeline';
import { MobileBottomSheet } from './MobileBottomSheet';
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

export function MobileDetailSheet({
  listing,
  onClose,
  onTogglePin,
  onStatusChange,
  onNotesChange,
  onDismiss
}: MobileDetailSheetProps) {
  const [draftNotes, setDraftNotes] = useState(listing?.notes ?? '');
  // Keep last non-null listing so the sheet can finish its close animation
  // after the parent clears `listing`.
  const [shown, setShown] = useState<AtlasListing | null>(listing);
  const openLightbox = useLightbox();

  useEffect(() => {
    setDraftNotes(listing?.notes ?? '');
    if (listing) setShown(listing);
  }, [listing?.id, listing?.notes]);

  const open = !!listing;
  const view = listing ?? shown;
  if (!view) return null;

  const statusValue: AtlasListingStatus = STATUS_OPTIONS.find(
    (s) => s.value === view.status
  )
    ? view.status
    : 'À trier';

  const guardLightbox = (event: Event) => {
    const lb = document.querySelector('.lg-container.lg-show');
    if (lb && event.target instanceof Node && lb.contains(event.target)) {
      event.preventDefault();
    }
  };

  return (
    <MobileBottomSheet
      open={open}
      onClose={onClose}
      title={view.title}
      onPointerDownOutside={guardLightbox}
      onInteractOutside={guardLightbox}
    >
      <div
        style={{
          flex: '1 1 0',
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          width: '100%',
          boxSizing: 'border-box',
          padding: '8px 16px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 14
        }}
      >
        <div style={{ position: 'relative' }}>
          <PhotoFrame
            images={view.images}
            aspect="4 / 3"
            radius={16}
            onOpen={(images, index) => openLightbox(images, index)}
          />
          <button
            type="button"
            onClick={() => onTogglePin(view.id)}
            aria-label={view.pinned ? 'Désépingler' : 'Épingler'}
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
              color: view.pinned ? 'var(--atlas-ember)' : 'var(--atlas-ink-2)',
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
              {[view.area, String(view.source).replace(/\.ch$/i, '')]
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
              {view.title}
            </h2>
            <div
              style={{
                color: 'var(--atlas-ink-3)',
                fontSize: 12.5,
                marginTop: 4
              }}
            >
              {view.address || '—'}
            </div>
          </div>
          {view.totalChf != null ? (
            <Mono
              style={{
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: '-0.015em',
                whiteSpace: 'nowrap',
                color: 'var(--atlas-ink)'
              }}
            >
              {formatCHF(view.totalChf)}
            </Mono>
          ) : null}
        </div>

        <StatGrid
          rooms={view.rooms}
          surfaceM2={view.surfaceM2}
          driveText={view.driveText}
        />

        <CommuteTimeline listing={view} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SourceMono source={view.source} />
          <span style={{ fontSize: 12.5, color: 'var(--atlas-ink-2)' }}>
            {view.source}
          </span>
          <span style={{ flex: 1 }} />
          <StatusPill status={view.status} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={eyebrowStyle}>Statut</span>
          <AtlasSegmentedControl
            items={STATUS_OPTIONS}
            value={statusValue}
            onChange={(value) => onStatusChange(view.id, value)}
          />
        </div>

        <AtlasTextarea
          value={draftNotes}
          onChange={(event) => setDraftNotes(event.target.value)}
          onBlur={() => {
            if (draftNotes !== view.notes) onNotesChange(view.id, draftNotes);
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
          <span>{view.publishedShort ? `Vu il y a ${view.publishedShort}` : ''}</span>
          <span>{view.publishedLabel}</span>
        </div>
      </div>

      <Hairline />
      <div
        style={{
          flexShrink: 0,
          padding: `10px 16px calc(10px + env(safe-area-inset-bottom, 16px))`,
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 8,
          width: '100%',
          boxSizing: 'border-box',
          minWidth: 0
        }}
      >
        <AtlasButton
          variant="primary"
          onClick={() => view.url && window.open(view.url, '_blank', 'noopener')}
          disabled={!view.url}
          leftSection={<Icons.External size={14} stroke={1.8} />}
        >
          Ouvrir l'annonce
        </AtlasButton>
        <AtlasButton
          variant="secondary"
          onClick={() => onDismiss(view.id)}
          leftSection={<Icons.Close size={14} stroke={1.8} />}
        >
          Écarter
        </AtlasButton>
      </div>
    </MobileBottomSheet>
  );
}
