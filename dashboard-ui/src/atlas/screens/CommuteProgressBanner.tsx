import type { CSSProperties } from 'react';
import type { ScanJob } from '../../api/schemas';

const wrapperStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  margin: '0 18px 12px',
  padding: '10px 12px',
  borderRadius: 10,
  background: 'rgba(214,69,69,0.08)',
  boxShadow: '0 0 0 1px var(--atlas-ember)',
  color: 'var(--atlas-ember)',
  fontSize: 12,
  fontFamily: 'var(--atlas-sans)'
};

const spinnerStyle: CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: '50%',
  border: '2px solid var(--atlas-ember)',
  borderTopColor: 'transparent',
  animation: 'v2spin 0.7s linear infinite',
  display: 'inline-block',
  flexShrink: 0
};

const trackStyle: CSSProperties = {
  flex: 1,
  height: 3,
  borderRadius: 3,
  background: 'rgba(214,69,69,0.18)',
  overflow: 'hidden'
};

const fillStyle = (pct: number): CSSProperties => ({
  width: `${pct}%`,
  height: '100%',
  background: 'var(--atlas-ember)',
  transition: 'width 240ms ease'
});

type Props = {
  scan: ScanJob | null;
};

export function CommuteProgressBanner({ scan }: Props) {
  const commute = scan?.commute;
  if (!commute || commute.status !== 'running') return null;

  const total = commute.total ?? 0;
  const done = commute.done ?? 0;
  const safeTotal = total > 0 ? total : 1;
  const pct = Math.max(0, Math.min(100, Math.round((done / safeTotal) * 100)));
  const counter = total > 0 ? `${done} / ${total}` : '';

  return (
    <div role="status" aria-live="polite" style={wrapperStyle}>
      <span style={spinnerStyle} aria-hidden />
      <span style={{ fontWeight: 600 }}>Calcul des trajets…</span>
      <div style={trackStyle} aria-hidden>
        <div style={fillStyle(pct)} />
      </div>
      {counter ? (
        <span
          style={{
            fontFamily: 'var(--atlas-mono)',
            fontVariantNumeric: 'tabular-nums',
            fontSize: 11,
            color: 'var(--atlas-ember)'
          }}
        >
          {counter}
        </span>
      ) : null}
    </div>
  );
}
