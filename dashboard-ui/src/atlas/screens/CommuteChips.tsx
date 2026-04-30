import type { CSSProperties } from 'react';
import { Icons, Mono } from '../components';
import type { AtlasListing } from '../types';

type CommuteChipsProps = {
  listing: Pick<
    AtlasListing,
    'transitText' | 'driveText' | 'transitRouteStatus' | 'driveRouteStatus'
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
  whiteSpace: 'nowrap'
};

function chipTone(status: string | null | undefined, hasText: boolean): CSSProperties {
  if (status === 'cached-stale') return { color: 'var(--atlas-ember)' };
  if (!hasText || status === 'route-failed' || status === 'missing-address' || status === 'geocode-failed') {
    return { color: 'var(--atlas-ink-3)' };
  }
  return {};
}

export function CommuteChips({ listing, compact = false, style }: CommuteChipsProps) {
  const transitValue = listing.transitText || 'n/a';
  const driveValue = listing.driveText || 'n/a';

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
      <span style={{ ...chipStyle, ...chipTone(listing.transitRouteStatus, !!listing.transitText) }}>
        <Icons.Train size={compact ? 11 : 12} stroke={1.8} />
        <Mono style={{ fontSize: compact ? 11 : 12, fontWeight: 500 }}>PT {transitValue}</Mono>
      </span>
      <span style={{ ...chipStyle, ...chipTone(listing.driveRouteStatus, !!listing.driveText) }}>
        <Icons.Drive size={compact ? 11 : 12} stroke={1.8} />
        <Mono style={{ fontSize: compact ? 11 : 12, fontWeight: 500 }}>CAR {driveValue}</Mono>
      </span>
    </div>
  );
}
