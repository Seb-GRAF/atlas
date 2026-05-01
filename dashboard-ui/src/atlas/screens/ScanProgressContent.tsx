import type { CSSProperties } from 'react';
import { AtlasButton, Icons } from '../components';
import type { ScanSourceRow, ScanSourceState } from '../scan';

type ScanProgressContentProps = {
  done: number;
  total: number;
  sources: ScanSourceRow[];
  onCancel: () => void;
  onBackground: () => void;
  finished?: { kind: 'done' | 'error' | 'cancelled'; newCount?: number; message?: string };
};

const headerRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10
};

const headingStyle: CSSProperties = {
  fontFamily: 'var(--atlas-sans)',
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--atlas-ink)'
};

const monoCountStyle: CSSProperties = {
  fontFamily: 'var(--atlas-mono)',
  fontVariantNumeric: 'tabular-nums',
  fontSize: 12,
  color: 'var(--atlas-ink-3)'
};

const trackStyle: CSSProperties = {
  marginTop: 14,
  height: 4,
  borderRadius: 4,
  background: 'rgba(22,20,15,.06)',
  overflow: 'hidden'
};

const fillStyle = (pct: number): CSSProperties => ({
  width: `${pct}%`,
  height: '100%',
  background: 'var(--atlas-ember)',
  borderRadius: 4,
  transition: 'width 240ms ease'
});

const sourceRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontFamily: 'var(--atlas-sans)',
  fontSize: 12.5
};

function dotStyle(state: ScanSourceState): CSSProperties {
  let bg: string;
  if (state === 'done') bg = 'var(--atlas-good)';
  else if (state === 'running') bg = 'var(--atlas-ember-2)';
  else if (state === 'error') bg = 'var(--atlas-bad)';
  else bg = 'var(--atlas-line)';
  return {
    width: 14,
    height: 14,
    borderRadius: 999,
    background: bg,
    color: state === 'done' || state === 'error' ? '#fff' : 'var(--atlas-ember)',
    display: 'grid',
    placeItems: 'center',
    flex: '0 0 auto'
  };
}

function rightLabel(source: ScanSourceRow): { text: string; mono: boolean; color: string } {
  if (source.state === 'done') {
    if (source.kind === 'phase') {
      return { text: 'terminé', mono: false, color: 'var(--atlas-good)' };
    }
    const n = source.found ?? source.newCount ?? 0;
    const text = n === 1 ? '1 annonce' : `${n} annonces`;
    return { text, mono: true, color: 'var(--atlas-good)' };
  }
  if (source.state === 'running') {
    return { text: 'en cours', mono: false, color: 'var(--atlas-ink-3)' };
  }
  if (source.state === 'error') {
    return { text: source.error || 'erreur', mono: false, color: 'var(--atlas-bad)' };
  }
  return { text: 'en file', mono: false, color: 'var(--atlas-ink-3)' };
}

function formatDuration(ms?: number | null) {
  if (ms == null || !Number.isFinite(ms)) return '';
  const seconds = Math.max(1, Math.round(ms / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function nameColor(state: ScanSourceState): string {
  if (state === 'queued') return 'var(--atlas-ink-3)';
  return 'var(--atlas-ink-2)';
}

export function ScanProgressContent({
  done,
  total,
  sources,
  onCancel,
  onBackground,
  finished
}: ScanProgressContentProps) {
  const safeTotal = total > 0 ? total : 1;
  const pct = Math.max(0, Math.min(100, Math.round((done / safeTotal) * 100)));

  if (finished) {
    return <ScanFinishedView finished={finished} />;
  }

  return (
    <>
      <div style={headerRowStyle}>
        <span style={{ position: 'relative', width: 18, height: 18, flex: '0 0 auto' }}>
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 999,
              border: '2px solid rgba(22,20,15,.12)'
            }}
          />
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 999,
              border: '2px solid transparent',
              borderTopColor: 'var(--atlas-ember)',
              animation: 'v2spin 1s linear infinite'
            }}
          />
        </span>
        <div style={headingStyle}>Scan en cours</div>
        <span style={{ flex: 1 }} />
        <span style={monoCountStyle}>
          {done} / {total} étapes
        </span>
      </div>

      <div style={trackStyle}>
        <div style={fillStyle(pct)} />
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sources.map((source) => {
          const right = rightLabel(source);
          const duration = formatDuration(source.durationMs);
          return (
            <div key={source.name} style={sourceRowStyle}>
              <span style={dotStyle(source.state)}>
                {source.state === 'done' ? <Icons.Check size={9} stroke={2.5} /> : null}
                {source.state === 'running' ? (
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      background: 'var(--atlas-ember)',
                      animation: 'v2pulse 1s ease-in-out infinite'
                    }}
                  />
                ) : null}
              </span>
              <span
                style={{
                  color: nameColor(source.state),
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {source.name}
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 6,
                  minWidth: 0,
                  maxWidth: '58%'
                }}
              >
                <span
                  title={right.text}
                  style={{
                    color: right.color,
                    fontFamily: right.mono ? 'var(--atlas-mono)' : undefined,
                    fontVariantNumeric: right.mono ? 'tabular-nums' : undefined,
                    fontSize: 11.5,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {right.text}
                </span>
                {duration ? (
                  <span
                    style={{
                      color: 'var(--atlas-ink-3)',
                      fontFamily: 'var(--atlas-mono)',
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 11,
                      whiteSpace: 'nowrap',
                      flex: '0 0 auto'
                    }}
                  >
                    {duration}
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <AtlasButton
          variant="secondary"
          onClick={onCancel}
          style={{ flex: 1, padding: '8px 12px', fontSize: 12.5 }}
        >
          Annuler
        </AtlasButton>
        <AtlasButton
          variant="primary"
          onClick={onBackground}
          style={{ flex: 1, padding: '8px 12px', fontSize: 12.5 }}
        >
          Continuer en arrière-plan
        </AtlasButton>
      </div>
    </>
  );
}

const finishedRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12
};

const finishedBadgeStyle = (kind: 'done' | 'error' | 'cancelled'): CSSProperties => {
  const bg =
    kind === 'done'
      ? 'var(--atlas-good)'
      : kind === 'error'
      ? 'var(--atlas-bad)'
      : 'var(--atlas-line)';
  return {
    width: 28,
    height: 28,
    borderRadius: 999,
    background: bg,
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    flex: '0 0 auto',
    boxShadow: '0 0 0 3px rgba(255,255,255,0.65)'
  };
};

function ScanFinishedView({ finished }: { finished: NonNullable<ScanProgressContentProps['finished']> }) {
  const { kind, newCount, message } = finished;
  const headline =
    kind === 'done'
      ? 'Scan terminé'
      : kind === 'error'
      ? 'Scan interrompu'
      : 'Scan annulé';
  const subline =
    message ??
    (kind === 'done'
      ? typeof newCount === 'number'
        ? newCount === 0
          ? 'Aucune nouvelle annonce.'
          : newCount === 1
          ? '1 nouvelle annonce.'
          : `${newCount} nouvelles annonces.`
        : 'Liste mise à jour.'
      : kind === 'error'
      ? 'Voir le journal pour les détails.'
      : '');

  return (
    <div style={finishedRowStyle}>
      <span style={finishedBadgeStyle(kind)}>
        {kind === 'done' ? <Icons.Check size={16} stroke={2.4} /> : null}
        {kind === 'error' ? (
          <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1 }}>!</span>
        ) : null}
        {kind === 'cancelled' ? (
          <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1, color: 'var(--atlas-ink-2)' }}>×</span>
        ) : null}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={headingStyle}>{headline}</div>
        {subline ? (
          <div style={{ fontSize: 12, color: 'var(--atlas-ink-3)', marginTop: 2 }}>{subline}</div>
        ) : null}
      </div>
    </div>
  );
}
