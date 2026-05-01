import type { ReactNode } from 'react';
import { Icons, Mono } from '../components';

type StatCellProps = {
  icon: ReactNode;
  label: string;
  value: string;
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
      <Mono style={{ fontSize: 14, fontWeight: 500, color: 'var(--atlas-ink)' }}>{value}</Mono>
    </div>
  );
}

type StatGridProps = {
  rooms: number | null;
  surfaceM2: number | null;
  driveText: string | null;
};

export function StatGrid({ rooms, surfaceM2, driveText }: StatGridProps) {
  const fmtRooms = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toString().replace('.', ',');

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
        value={driveText ?? '—'}
      />
    </div>
  );
}
