import type { CSSProperties, ReactNode } from 'react';
import { Hairline, Icons, Mono } from '../components';
import type { AtlasListing, CommuteLeg } from '../types';

type CommuteTimelineListing = Pick<
  AtlasListing,
  | 'transitText'
  | 'driveText'
  | 'driveMinutes'
  | 'transitMinutes'
  | 'driveRouteStatus'
  | 'transitRouteStatus'
  | 'transitRouteLabel'
  | 'transitRouteComputedAt'
  | 'transitRoute'
  | 'commuteWarnings'
>;

type CommuteTimelineProps = { listing: CommuteTimelineListing };

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  minWidth: 0
};

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--atlas-ink-3)',
  fontWeight: 500
};

const summaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
  gap: 8,
  minWidth: 0
};

const summaryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  minWidth: 0,
  padding: '7px 8px',
  borderRadius: 8,
  background: 'var(--atlas-paper-2)',
  boxShadow: '0 0 0 1px var(--atlas-line)',
  color: 'var(--atlas-ink)'
};

const labelStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
};

const statusTextStyle: CSSProperties = {
  fontSize: 11.5,
  lineHeight: 1.35,
  color: 'var(--atlas-ink-3)'
};

function statusLabel(status: string | null | undefined): string | null {
  if (!status || status === 'ok') return null;
  if (status === 'cached-stale') return 'cache ancien';
  if (status === 'route-failed') return 'trajet indisponible';
  if (status === 'missing-address') return 'adresse manquante';
  if (status === 'geocode-failed') return 'géocodage échoué';
  return `statut ${status}`;
}

function durationText(text: string | null, minutes: number | null): string {
  if (text) return text;
  if (minutes != null) return `${Math.round(minutes)} min`;
  return 'n/a';
}

function routeLabel(listing: CommuteTimelineListing): string | null {
  if (listing.transitRouteLabel) return listing.transitRouteLabel;
  const arrival = listing.transitRoute?.arrivalTime;
  if (arrival && (listing.transitRouteStatus || listing.transitRoute)) return `Arrivée ${arrival}`;
  if (listing.transitRouteStatus || listing.transitRoute) return 'Arrivée 08:00';
  return null;
}

function legLabel(leg: CommuteLeg): string {
  if (leg.type === 'walk') return 'WALK';
  return leg.label || leg.line || leg.mode || 'PT';
}

function modeIcon(leg: CommuteLeg) {
  if (leg.type === 'walk') return <Icons.Walk size={13} stroke={1.8} />;
  return <Icons.Train size={13} stroke={1.8} />;
}

function SummaryItem({
  icon,
  prefix,
  value,
  status
}: {
  icon: ReactNode;
  prefix: string;
  value: string;
  status: string | null;
}) {
  return (
    <div style={{ ...summaryStyle, color: status ? 'var(--atlas-ink-3)' : 'var(--atlas-ink)' }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <Mono style={{ ...labelStyle, fontSize: 12, fontWeight: 500 }}>
        {prefix} {value}
      </Mono>
      {status ? <Mono style={{ ...labelStyle, maxWidth: 74, fontSize: 10.5, color: 'currentColor', opacity: 0.8 }}>{status}</Mono> : null}
    </div>
  );
}

function TimelineLeg({ leg, last }: { leg: CommuteLeg; last: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 54px) minmax(0, 1fr) auto', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--atlas-ink-3)' }}>
        <div style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          {modeIcon(leg)}
        </div>
        {!last ? <Hairline vertical style={{ flex: 1, minHeight: 12, margin: '2px 0' }} /> : null}
      </div>
      <Mono style={{ ...labelStyle, fontSize: 11, fontWeight: 500, color: 'var(--atlas-ink)', paddingTop: 3 }}>
        {legLabel(leg)}
      </Mono>
      <div style={{ minWidth: 0, paddingTop: 2 }}>
        <div style={{ fontSize: 12.2, color: 'var(--atlas-ink)', lineHeight: 1.25, overflowWrap: 'anywhere' }}>
          {leg.from || 'Départ'} -&gt; {leg.to || 'Arrivée'}
        </div>
        {leg.direction ? (
          <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--atlas-ink-3)', overflowWrap: 'anywhere' }}>
            {leg.direction}
          </div>
        ) : null}
      </div>
      {leg.minutes != null ? (
        <Mono style={{ paddingTop: 3, fontSize: 11, color: 'var(--atlas-ink-3)', whiteSpace: 'nowrap' }}>
          {Math.round(leg.minutes)} min
        </Mono>
      ) : null}
    </div>
  );
}

export function CommuteTimeline({ listing }: CommuteTimelineProps) {
  const warnings = listing.commuteWarnings ?? [];
  const transitStatus = statusLabel(listing.transitRouteStatus);
  const driveStatus = statusLabel(listing.driveRouteStatus);
  const legs = listing.transitRoute?.legs ?? [];
  const baseline = routeLabel(listing);
  const hasData =
    !!listing.transitText ||
    !!listing.driveText ||
    listing.transitMinutes != null ||
    listing.driveMinutes != null ||
    !!listing.transitRouteStatus ||
    !!listing.driveRouteStatus ||
    !!baseline ||
    legs.length > 0 ||
    warnings.length > 0;

  if (!hasData) return null;

  return (
    <section style={sectionStyle} aria-label="Trajet">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, minWidth: 0 }}>
        <span style={eyebrowStyle}>Trajet</span>
        {baseline ? <span style={{ ...statusTextStyle, overflowWrap: 'anywhere' }}>{baseline}</span> : null}
      </div>
      <div style={summaryGridStyle}>
        <SummaryItem
          icon={<Icons.Train size={13} stroke={1.8} />}
          prefix="PT"
          value={durationText(listing.transitText, listing.transitMinutes)}
          status={transitStatus}
        />
        <SummaryItem
          icon={<Icons.Drive size={13} stroke={1.8} />}
          prefix="CAR"
          value={durationText(listing.driveText, listing.driveMinutes)}
          status={driveStatus}
        />
      </div>
      {transitStatus || driveStatus ? (
        <div style={statusTextStyle}>
          {[transitStatus ? `PT: ${transitStatus}` : null, driveStatus ? `CAR: ${driveStatus}` : null]
            .filter(Boolean)
            .join(' · ')}
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div style={statusTextStyle}>{warnings.join(' · ')}</div>
      ) : null}
      {legs.map((leg, index) => (
        <TimelineLeg key={`${leg.type}-${leg.from}-${leg.to}-${index}`} leg={leg} last={index === legs.length - 1} />
      ))}
    </section>
  );
}
