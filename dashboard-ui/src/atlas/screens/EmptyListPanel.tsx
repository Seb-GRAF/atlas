import type { CSSProperties } from 'react';
import { AtlasButton, Icons } from '../components';

type EmptyListPanelProps = {
  zonesCount: number;
  sources: string[];
  onScan: () => void;
};

const wrapperStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  // ListPanel applies padding: 24px 18px around emptyContent — counteract horizontally
  // so the hairline and footer can span panel-edge to panel-edge.
  marginLeft: -18,
  marginRight: -18,
  marginTop: -24,
  marginBottom: -24
};

const bodyStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 24px'
};

const stackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  textAlign: 'center'
};

const tileStyle: CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 16,
  background: 'var(--atlas-ember-2)',
  color: 'var(--atlas-ember)',
  display: 'grid',
  placeItems: 'center'
};

const headingStyle: CSSProperties = {
  fontFamily: 'var(--atlas-sans)',
  fontSize: 16,
  fontWeight: 500,
  letterSpacing: '-0.015em',
  color: 'var(--atlas-ink)'
};

const copyStyle: CSSProperties = {
  fontFamily: 'var(--atlas-sans)',
  fontSize: 13,
  fontWeight: 400,
  color: 'var(--atlas-ink-2)',
  marginTop: 6,
  lineHeight: 1.55,
  maxWidth: 280
};

const sourcesFooterStyle: CSSProperties = {
  fontFamily: 'var(--atlas-sans)',
  fontSize: 11.5,
  fontWeight: 400,
  color: 'var(--atlas-ink-3)'
};

function formatSources(sources: string[]): string {
  if (sources.length === 0) return 'Sources actives · —';
  if (sources.length <= 3) return `Sources actives · ${sources.join(', ')}`;
  const head = sources.slice(0, 3).join(', ');
  return `Sources actives · ${head} +${sources.length - 3}`;
}

export function EmptyListPanel({ zonesCount, sources, onScan }: EmptyListPanelProps) {
  return (
    <div style={wrapperStyle}>
      <div style={bodyStyle}>
        <div style={stackStyle}>
          <div style={tileStyle}>
            <Icons.Sparkle size={22} stroke={1.6} />
          </div>
          <div>
            <div style={headingStyle}>Aucune annonce pour l'instant</div>
            <div style={copyStyle}>
              Lance un premier scan sur les{' '}
              <b style={{ color: 'var(--atlas-ink)', fontWeight: 500 }}>{zonesCount} communes</b> de ton profil
              — ça prend généralement moins d'une minute.
            </div>
          </div>
          <AtlasButton
            variant="primary"
            onClick={onScan}
            leftSection={
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: 'oklch(78% 0.12 150)',
                  display: 'inline-block'
                }}
              />
            }
          >
            Lancer un scan
          </AtlasButton>
          <div style={sourcesFooterStyle}>{formatSources(sources)}</div>
        </div>
      </div>
    </div>
  );
}
