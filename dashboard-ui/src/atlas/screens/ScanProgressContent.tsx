import type { CSSProperties } from 'react';
import { AtlasButton, Icons } from '../components';
import type { ScanSourceRow, ScanSourceState } from '../scan';

type ScanProgressContentProps = {
  done: number;
  total: number;
  sources: ScanSourceRow[];
  onCancel: () => void;
  onBackground: () => void;
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
    const n = source.newCount ?? 0;
    const text = n === 1 ? '1 nouvelle' : `${n} nouvelles`;
    return { text, mono: true, color: 'var(--atlas-good)' };
  }
  if (source.state === 'running') {
    return { text: 'en cours', mono: false, color: 'var(--atlas-ink-3)' };
  }
  if (source.state === 'error') {
    return { text: 'erreur', mono: false, color: 'var(--atlas-bad)' };
  }
  return { text: 'en file', mono: false, color: 'var(--atlas-ink-3)' };
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
  onBackground
}: ScanProgressContentProps) {
  const safeTotal = total > 0 ? total : 1;
  const pct = Math.max(0, Math.min(100, Math.round((done / safeTotal) * 100)));

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
          {done} / {total} sources
        </span>
      </div>

      <div style={trackStyle}>
        <div style={fillStyle(pct)} />
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sources.map((source) => {
          const right = rightLabel(source);
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
              <span style={{ color: nameColor(source.state), flex: 1 }}>{source.name}</span>
              <span
                style={{
                  color: right.color,
                  fontFamily: right.mono ? 'var(--atlas-mono)' : undefined,
                  fontVariantNumeric: right.mono ? 'tabular-nums' : undefined,
                  fontSize: 11.5
                }}
              >
                {right.text}
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
