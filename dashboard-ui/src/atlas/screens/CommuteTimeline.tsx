import { Fragment, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Hairline, Icons, Mono } from '../components';
import { colorForLeg } from '../data/routeViz';
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

type CommuteTimelineProps = {
  listing: CommuteTimelineListing;
  onVisualize?: () => void;
  visualizing?: boolean;
  visualizingLoading?: boolean;
};

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  minWidth: 0,
  flexShrink: 0
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

function formatHHMM(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}

function secondaryLine(legs: CommuteLeg[]): string | null {
  const firstTransit = legs.find(l => l.type === 'transit' && l.departureAt);
  if (firstTransit) {
    const time = formatHHMM(firstTransit.departureAt);
    if (!time) return null;
    return firstTransit.from ? `${time} de ${firstTransit.from}` : time;
  }
  const firstWithTime = legs.find(l => l.departureAt);
  if (firstWithTime) return formatHHMM(firstWithTime.departureAt);
  return null;
}

function compactTransitLabel(leg: CommuteLeg): string {
  return (leg.line || leg.mode || 'PT').toString().toUpperCase();
}

function WalkBadge({ minutes }: { minutes: number | null }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 7px', borderRadius: 999,
      background: 'var(--atlas-ink)', color: 'var(--atlas-paper)',
      fontFamily: 'var(--atlas-mono)', fontSize: 11, fontWeight: 500,
      whiteSpace: 'nowrap'
    }}>
      <Icons.Walk size={11} stroke={2} />
      {minutes != null ? Math.round(minutes) : ''}
    </span>
  );
}

function TransitBadge({ leg }: { leg: CommuteLeg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 8px', borderRadius: 6,
      background: colorForLeg(leg), color: '#fff',
      fontFamily: 'var(--atlas-mono)', fontSize: 11, fontWeight: 600,
      letterSpacing: '0.02em', whiteSpace: 'nowrap'
    }}>
      {compactTransitLabel(leg)}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 12 12"
      aria-hidden="true"
      style={{
        flexShrink: 0,
        color: 'var(--atlas-ink-3)',
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'
      }}
    >
      <path
        d="M2.5 4.5L6 8L9.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CommuteSummaryStrip({
  legs,
  open,
  onToggle
}: {
  legs: CommuteLeg[];
  open: boolean;
  onToggle: () => void;
}) {
  if (legs.length === 0) return null;
  const secondary = secondaryLine(legs);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', border: 0, borderRadius: 8,
        background: 'var(--atlas-paper-2)', boxShadow: '0 0 0 1px var(--atlas-line)',
        textAlign: 'left', cursor: 'pointer', width: '100%', minWidth: 0,
        fontFamily: 'inherit',
        transition: 'background 160ms ease, box-shadow 160ms ease'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {legs.map((leg, i) => (
            <Fragment key={`${leg.type}-${leg.from}-${leg.to}-${i}`}>
              {leg.type === 'walk' ? <WalkBadge minutes={leg.minutes} /> : <TransitBadge leg={leg} />}
              {i < legs.length - 1 ? (
                <span style={{ color: 'var(--atlas-ink-3)', fontSize: 12 }}>›</span>
              ) : null}
            </Fragment>
          ))}
        </div>
        {secondary ? (
          <Mono style={{ fontSize: 11, color: 'var(--atlas-ink-3)' }}>{secondary}</Mono>
        ) : null}
      </div>
      <Chevron open={open} />
    </button>
  );
}

function modeIcon(leg: CommuteLeg) {
  if (leg.type === 'walk') return <Icons.Walk size={13} stroke={1.8} />;
  return <Icons.Train size={13} stroke={1.8} />;
}

function SummaryItem({
  icon,
  value,
  status
}: {
  icon: ReactNode;
  value: string;
  status: string | null;
}) {
  return (
    <div style={{ ...summaryStyle, color: status ? 'var(--atlas-ink-3)' : 'var(--atlas-ink)' }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <Mono style={{ ...labelStyle, fontSize: 12, fontWeight: 500 }}>
        {value}
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

export function CommuteTimeline({ listing, onVisualize, visualizing, visualizingLoading }: CommuteTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const warnings = listing.commuteWarnings ?? [];
  const transitStatus = statusLabel(listing.transitRouteStatus);
  const driveStatus = statusLabel(listing.driveRouteStatus);
  const legs = listing.transitRoute?.legs ?? [];
  const baseline = routeLabel(listing);
  const canVisualize = !!onVisualize && legs.length > 0;
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0, flex: 1 }}>
          <span style={eyebrowStyle}>Trajet</span>
          {baseline ? <span style={{ ...statusTextStyle, overflowWrap: 'anywhere' }}>{baseline}</span> : null}
        </div>
        {canVisualize ? (
          <button
            type="button"
            onClick={onVisualize}
            disabled={visualizingLoading}
            aria-pressed={visualizing}
            style={{
              flexShrink: 0,
              border: 0,
              padding: '5px 10px',
              borderRadius: 999,
              fontFamily: 'var(--atlas-sans)',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.02em',
              cursor: visualizingLoading ? 'progress' : 'pointer',
              background: visualizing ? 'var(--atlas-ink)' : 'var(--atlas-paper-2)',
              color: visualizing ? '#fff' : 'var(--atlas-ink)',
              boxShadow: visualizing ? 'none' : '0 0 0 1px var(--atlas-line)',
              opacity: visualizingLoading ? 0.7 : 1,
              transition: 'background 140ms ease, color 140ms ease'
            }}
          >
            {visualizingLoading ? 'Calcul…' : visualizing ? 'Masquer le trajet' : 'Visualiser le trajet'}
          </button>
        ) : null}
      </div>
      <div style={summaryGridStyle}>
        <SummaryItem
          icon={<Icons.Train size={13} stroke={1.8} />}
          value={durationText(listing.transitText, listing.transitMinutes)}
          status={transitStatus}
        />
        <SummaryItem
          icon={<Icons.Drive size={13} stroke={1.8} />}
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
      {legs.length > 0 ? (
        <>
          <CommuteSummaryStrip legs={legs} open={expanded} onToggle={() => setExpanded(v => !v)} />
          <div
            aria-hidden={!expanded}
            style={{
              display: 'grid',
              gridTemplateRows: expanded ? '1fr' : '0fr',
              opacity: expanded ? 1 : 0,
              transition: 'grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease',
              minHeight: 0
            }}
          >
            <div style={{ overflow: 'hidden', minHeight: 0 }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  paddingTop: 8,
                  transform: expanded ? 'translateY(0)' : 'translateY(-4px)',
                  transition: 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)'
                }}
              >
                {legs.map((leg, index) => (
                  <TimelineLeg
                    key={`${leg.type}-${leg.from}-${leg.to}-${index}`}
                    leg={leg}
                    last={index === legs.length - 1}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
