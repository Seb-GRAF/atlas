import type { CSSProperties, ReactNode } from 'react';
import { Icons, Mono } from '../components';

type StatCellProps = {
  icon: ReactNode;
  label: string;
  value: ReactNode;
};

function StatCell({ icon, label, value }: StatCellProps) {
  return (
    <div
      style={{
        background: 'var(--atlas-paper-2)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--atlas-ink-3)'
        }}
      >
        <span style={{ color: 'var(--atlas-ink-3)', display: 'inline-flex' }} aria-hidden>
          {icon}
        </span>
        {label}
      </div>
      {typeof value === 'string' ? (
        <Mono style={{ fontSize: 14, fontWeight: 500, color: 'var(--atlas-ink)' }}>{value}</Mono>
      ) : (
        value
      )}
    </div>
  );
}

const statSpinnerStyle: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: '50%',
  border: '2px solid var(--atlas-ember)',
  borderTopColor: 'transparent',
  animation: 'v2spin 0.7s linear infinite',
  display: 'inline-block',
  flexShrink: 0
};

function PendingValue({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: 'var(--atlas-ember)',
        fontSize: 13,
        fontWeight: 500
      }}
    >
      <span style={statSpinnerStyle} aria-hidden />
      <span>Calcul…</span>
    </div>
  );
}

type StatGridProps = {
  rooms: number | null;
  surfaceM2: number | null;
  driveText: string | null;
  commutePending?: boolean;
};

export function StatGrid({ rooms, surfaceM2, driveText, commutePending }: StatGridProps) {
  const fmtRooms = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toString().replace('.', ',');

  const trajetValue: ReactNode =
    commutePending && !driveText ? <PendingValue label="Calcul du trajet en cours" /> : driveText ?? '—';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 1,
        background: 'var(--atlas-line)',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px var(--atlas-line)',
        flexShrink: 0
      }}
    >
      <StatCell
        icon={<Icons.Bed size={11} stroke={1.7} />}
        label="Pièces"
        value={rooms != null ? fmtRooms(rooms) : '—'}
      />
      <StatCell
        icon={<Icons.Square size={11} stroke={1.7} />}
        label="Surface"
        value={surfaceM2 != null ? `${surfaceM2} m²` : '—'}
      />
      <StatCell
        icon={<Icons.Drive size={11} stroke={1.7} />}
        label="Trajet"
        value={trajetValue}
      />
    </div>
  );
}
