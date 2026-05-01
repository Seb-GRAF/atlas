import type { CSSProperties } from 'react';
import { Icons, Mono } from '../components';
import type { AtlasListing } from '../types';

type CommuteChipsProps = {
  listing: Pick<
    AtlasListing,
    'transitText' | 'driveText' | 'transitRouteStatus' | 'driveRouteStatus' | 'commutePending'
  >;
  compact?: boolean;
  style?: CSSProperties;
};

const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  minHeight: 24,
  padding: '3px 7px',
  borderRadius: 8,
  background: 'var(--atlas-paper-2)',
  color: 'var(--atlas-ink)',
  boxShadow: '0 0 0 1px var(--atlas-line)',
  whiteSpace: 'nowrap',
  maxWidth: '100%'
};

const iconStyle: CSSProperties = {
  flexShrink: 0
};

const statusStyle: CSSProperties = {
  flexShrink: 0,
  color: 'currentColor',
  opacity: 0.75
};

function chipTone(status: string | null | undefined, hasText: boolean): CSSProperties {
  if (status === 'cached-stale') return { color: 'var(--atlas-ember)' };
  if (!hasText || status === 'route-failed' || status === 'missing-address' || status === 'geocode-failed') {
    return { color: 'var(--atlas-ink-3)' };
  }
  return {};
}

function statusCue(status: string | null | undefined): { suffix: string; label: string } | null {
  if (!status || status === 'ok') return null;
  if (status === 'cached-stale') {
    return { suffix: 'cache', label: 'donnée issue du cache' };
  }
  if (status === 'route-failed') {
    return { suffix: 'indispo', label: 'trajet indisponible' };
  }
  if (status === 'missing-address') {
    return { suffix: 'adresse', label: 'adresse manquante' };
  }
  if (status === 'geocode-failed') {
    return { suffix: 'géocode', label: 'adresse non géocodée' };
  }
  return { suffix: 'statut', label: `statut ${status}` };
}

const ringSpinnerStyle = (size: number): CSSProperties => ({
  width: size,
  height: size,
  borderRadius: '50%',
  border: '2px solid var(--atlas-ember)',
  borderTopColor: 'transparent',
  animation: 'v2spin 0.7s linear infinite',
  display: 'inline-block',
  flexShrink: 0
});

export function CommuteChips({ listing, compact = false, style }: CommuteChipsProps) {
  const isPending = !!listing.commutePending && !listing.transitText && !listing.driveText;
  const transitValue = listing.transitText || 'n/a';
  const driveValue = listing.driveText || 'n/a';
  const transitStatus = statusCue(listing.transitRouteStatus);
  const driveStatus = statusCue(listing.driveRouteStatus);
  const valueStyle: CSSProperties = {
    fontSize: compact ? 11 : 12,
    fontWeight: 500,
    minWidth: 0,
    maxWidth: compact ? 88 : 108,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  };

  if (isPending) {
    const pendingChipStyle: CSSProperties = {
      ...chipStyle,
      background:
        'linear-gradient(90deg, var(--atlas-paper-2) 0%, rgba(214,69,69,0.08) 50%, var(--atlas-paper-2) 100%)',
      backgroundSize: '320px 100%',
      animation: 'atlas-shimmer 1.4s linear infinite',
      color: 'var(--atlas-ember)',
      boxShadow: '0 0 0 1px var(--atlas-ember)',
      gap: 6
    };
    const labelStyle: CSSProperties = {
      fontSize: compact ? 10.5 : 11.5,
      fontWeight: 600,
      letterSpacing: '0.02em',
      color: 'var(--atlas-ember)'
    };
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6,
          minWidth: 0,
          ...style
        }}
        role="status"
        aria-label="Calcul du trajet en cours"
      >
        <span title="Trajet transports publics: calcul en cours" style={pendingChipStyle}>
          <Icons.Train size={compact ? 11 : 12} stroke={1.8} style={iconStyle} />
          <span style={ringSpinnerStyle(compact ? 10 : 12)} aria-hidden />
          <span style={labelStyle}>Calcul…</span>
        </span>
        <span title="Trajet voiture: calcul en cours" style={pendingChipStyle}>
          <Icons.Drive size={compact ? 11 : 12} stroke={1.8} style={iconStyle} />
          <span style={ringSpinnerStyle(compact ? 10 : 12)} aria-hidden />
          <span style={labelStyle}>Calcul…</span>
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        minWidth: 0,
        ...style
      }}
    >
      <span
        title={`PT ${transitValue}${transitStatus ? `, ${transitStatus.label}` : ''}`}
        aria-label={`transport public ${transitValue}${transitStatus ? `, ${transitStatus.label}` : ''}`}
        style={{ ...chipStyle, ...chipTone(listing.transitRouteStatus, !!listing.transitText) }}
      >
        <Icons.Train size={compact ? 11 : 12} stroke={1.8} style={iconStyle} />
        <Mono style={valueStyle}>{transitValue}</Mono>
        {transitStatus ? <Mono style={{ ...valueStyle, ...statusStyle }}>{transitStatus.suffix}</Mono> : null}
      </span>
      <span
        title={`CAR ${driveValue}${driveStatus ? `, ${driveStatus.label}` : ''}`}
        aria-label={`voiture ${driveValue}${driveStatus ? `, ${driveStatus.label}` : ''}`}
        style={{ ...chipStyle, ...chipTone(listing.driveRouteStatus, !!listing.driveText) }}
      >
        <Icons.Drive size={compact ? 11 : 12} stroke={1.8} style={iconStyle} />
        <Mono style={valueStyle}>{driveValue}</Mono>
        {driveStatus ? <Mono style={{ ...valueStyle, ...statusStyle }}>{driveStatus.suffix}</Mono> : null}
      </span>
    </div>
  );
}
