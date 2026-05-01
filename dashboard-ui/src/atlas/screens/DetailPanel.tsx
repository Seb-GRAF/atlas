import type { CSSProperties } from 'react';
import {
  AtlasButton,
  AtlasIconButton,
  AtlasSegmentedControl,
  AtlasTextarea,
  GlassPanel,
  Hairline,
  Icons,
  Mono,
  PhotoFrame,
  SourceMono,
  StatusPill,
  formatCHF
} from '../components';
import { StatGrid } from './StatGrid';
import { CommuteTimeline } from './CommuteTimeline';
import type { AtlasListing, AtlasListingStatus } from '../types';
import { useState, useEffect } from 'react';

type DetailPanelProps = {
  listing: AtlasListing | null;
  closing?: boolean;
  onTogglePin: (id: string) => void;
  onStatusChange: (id: string, next: AtlasListingStatus) => void;
  onNotesChange: (id: string, next: string) => void;
  onDismiss: (id: string) => void;
  onVisualizeRoute?: () => void;
  routeVisualizing?: boolean;
  routeLoading?: boolean;
};

export const PANEL_ANIM_MS = 260;

const basePanelStyle: CSSProperties = {
  position: 'absolute',
  right: 16,
  top: 76,
  bottom: 16,
  width: 400,
  zIndex: 4,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  willChange: 'transform, opacity'
};

const eyebrowStyle: CSSProperties = {
  fontFamily: 'var(--atlas-sans)',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--atlas-ink-3)'
};

const STATUS_OPTIONS: { value: AtlasListingStatus; label: string }[] = [
  { value: 'À trier', label: 'À trier' },
  { value: 'À contacter', label: 'À contacter' },
  { value: 'Visite prévue', label: 'Visite' },
  { value: 'Dossier à envoyer', label: 'Dossier' }
];

export function DetailPanel({
  listing,
  closing,
  onTogglePin,
  onStatusChange,
  onNotesChange,
  onDismiss,
  onVisualizeRoute,
  routeVisualizing,
  routeLoading
}: DetailPanelProps) {
  const [draftNotes, setDraftNotes] = useState(listing?.notes ?? '');
  useEffect(() => {
    setDraftNotes(listing?.notes ?? '');
  }, [listing?.id, listing?.notes]);

  if (!listing) return null;

  const statusValue: AtlasListingStatus = STATUS_OPTIONS.find((s) => s.value === listing.status)
    ? listing.status
    : 'À trier';

  const panelStyle: CSSProperties = {
    ...basePanelStyle,
    animation: closing
      ? `atlas-detail-out ${PANEL_ANIM_MS}ms cubic-bezier(0.32,0.72,0,1) forwards`
      : `atlas-detail-in ${PANEL_ANIM_MS}ms cubic-bezier(0.32,0.72,0,1)`
  };

  return (
    <GlassPanel variant="panel" style={panelStyle}>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 14
        }}
      >
        <div style={{ position: 'relative' }}>
          <PhotoFrame
            images={listing.images}
            aspect="4 / 3"
            radius={14}
          />
          <button
            type="button"
            onClick={() => onTogglePin(listing.id)}
            aria-label={listing.pinned ? 'Désépingler' : 'Épingler'}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 32,
              height: 32,
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
            <Icons.Heart size={15} stroke={1.8} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12
            }}
          >
            <span style={eyebrowStyle}>
              {[listing.area, listing.source].filter(Boolean).join(' · ') || '—'}
            </span>
            {listing.totalChf != null ? (
              <Mono style={{ fontSize: 24, fontWeight: 500, color: 'var(--atlas-ink)' }}>
                {formatCHF(listing.totalChf)}
                <span style={{ fontSize: 12, color: 'var(--atlas-ink-3)', marginLeft: 4 }}>CHF</span>
              </Mono>
            ) : null}
          </div>
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--atlas-sans)',
              fontSize: 17.5,
              fontWeight: 500,
              letterSpacing: '-0.018em',
              color: 'var(--atlas-ink)'
            }}
          >
            {listing.title}
          </h2>
          <div style={{ fontSize: 12.5, color: 'var(--atlas-ink-3)' }}>{listing.address || '—'}</div>
        </div>

        <AtlasButton
          variant="secondary"
          onClick={() => listing.url && window.open(listing.url, '_blank', 'noopener')}
          disabled={!listing.url}
          leftSection={<Icons.External size={14} stroke={1.8} />}
        >
          Ouvrir l'annonce
        </AtlasButton>

        <StatGrid
          rooms={listing.rooms}
          surfaceM2={listing.surfaceM2}
          driveText={listing.driveText}
          commutePending={listing.commutePending}
        />

        <CommuteTimeline
          listing={listing}
          onVisualize={onVisualizeRoute}
          visualizing={routeVisualizing}
          visualizingLoading={routeLoading}
        />

        <Hairline />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SourceMono source={listing.source} />
          <span style={{ fontSize: 13, color: 'var(--atlas-ink)' }}>{listing.source}</span>
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

        <AtlasButton
          variant="danger"
          onClick={() => onDismiss(listing.id)}
          leftSection={<Icons.Close size={14} stroke={1.8} />}
        >
          Écarter
        </AtlasButton>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--atlas-ink-3)'
          }}
        >
          <span>{listing.publishedShort ? `Vu il y a ${listing.publishedShort}` : ''}</span>
          <span>{listing.publishedLabel}</span>
        </div>
      </div>
    </GlassPanel>
  );
}
