import type { CSSProperties } from 'react';

type StatusTone = 'auto' | 'neutral' | 'ember' | 'good' | 'info' | 'bad';

type StatusPillProps = {
  status: string;
  tone?: StatusTone;
};

const PALETTE: Record<Exclude<StatusTone, 'auto'>, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--atlas-soft)', fg: 'var(--atlas-ink-2)' },
  ember: { bg: 'var(--atlas-ember-2)', fg: 'var(--atlas-ember)' },
  good: { bg: 'oklch(96% 0.04 155)', fg: 'var(--atlas-good)' },
  info: { bg: 'oklch(96% 0.02 230)', fg: 'var(--atlas-info)' },
  bad: { bg: 'oklch(96% 0.03 25)', fg: 'var(--atlas-bad)' }
};

function resolveTone(status: string, tone: StatusTone): Exclude<StatusTone, 'auto'> {
  if (tone !== 'auto') return tone;
  switch (status) {
    case 'À trier':
      return 'ember';
    case 'Visite prévue':
      return 'good';
    case 'Dossier à envoyer':
    case 'Dossier envoyé':
      return 'info';
    case 'Refus régie':
    case 'Écartée':
      return 'bad';
    default:
      return 'neutral';
  }
}

export function StatusPill({ status, tone = 'auto' }: StatusPillProps) {
  const resolved = resolveTone(status, tone);
  const palette = PALETTE[resolved];
  const dotStyle: CSSProperties = {
    width: 5,
    height: 5,
    borderRadius: 999,
    background: palette.fg,
    opacity: resolved === 'neutral' ? 0.4 : 1
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 9px',
        borderRadius: 999,
        background: palette.bg,
        color: palette.fg,
        fontFamily: 'var(--atlas-sans)',
        fontSize: 11.5,
        fontWeight: 500,
        letterSpacing: '-0.005em',
        whiteSpace: 'nowrap'
      }}
    >
      <span style={dotStyle} />
      {status}
    </span>
  );
}

export type { StatusTone };
