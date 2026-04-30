const SOURCE_GLYPH: Record<string, string> = {
  'immobilier.ch': 'Im',
  'flatfox.ch': 'Ff',
  'naef.ch': 'Na',
  'bernard-nicod': 'Bn',
  'Retraites Populaires': 'Rp',
  'anibis.ch': 'An'
};

type SourceMonoProps = {
  source: string;
  size?: number;
  dim?: boolean;
};

export function SourceMono({ source, size = 22, dim = false }: SourceMonoProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 6,
        background: dim ? 'transparent' : 'var(--atlas-soft)',
        border: dim ? '1px solid var(--atlas-line)' : 'none',
        color: 'var(--atlas-ink-2)',
        fontFamily: 'var(--atlas-mono)',
        fontSize: size <= 22 ? 10 : 11,
        fontWeight: 500,
        letterSpacing: 0
      }}
    >
      {SOURCE_GLYPH[source] ?? '··'}
    </span>
  );
}

export const ATLAS_SOURCE_GLYPH = SOURCE_GLYPH;
