import { useEffect, useState } from 'react';

const SOURCE_GLYPH: Record<string, string> = {
  'immobilier.ch': 'Im',
  'flatfox.ch': 'Ff',
  'naef.ch': 'Na',
  'bernard-nicod': 'Bn',
  'Retraites Populaires': 'Rp',
  'anibis.ch': 'An',
  'Facebook Marketplace': 'Mp'
};

const SOURCE_FAVICON: Record<string, string> = {
  'immobilier.ch': '/favicons/immobilier-ch.png',
  'flatfox.ch': '/favicons/flatfox-ch.svg',
  'naef.ch': '/favicons/naef-ch.png',
  'bernard-nicod': '/favicons/bernard-nicod.png',
  'Retraites Populaires': '/favicons/retraites-populaires.png',
  'anibis.ch': '/favicons/anibis-ch.png',
  'Facebook Marketplace': '/favicons/facebook-marketplace.png'
};

type SourceMonoProps = {
  source: string;
  size?: number;
  dim?: boolean;
};

export function SourceMono({ source, size = 22, dim = false }: SourceMonoProps) {
  const faviconUrl = SOURCE_FAVICON[source];
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setErrored(false);
  }, [faviconUrl]);

  const showFavicon = Boolean(faviconUrl) && !errored;
  const inner = Math.max(8, size - 6);

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
        letterSpacing: 0,
        overflow: 'hidden'
      }}
    >
      {showFavicon ? (
        <img
          src={faviconUrl}
          alt={source}
          width={inner}
          height={inner}
          loading="lazy"
          decoding="async"
          onError={() => setErrored(true)}
          style={{
            width: inner,
            height: inner,
            borderRadius: 4,
            objectFit: 'contain',
            display: 'block'
          }}
        />
      ) : (
        SOURCE_GLYPH[source] ?? '··'
      )}
    </span>
  );
}

export const ATLAS_SOURCE_GLYPH = SOURCE_GLYPH;
export const ATLAS_SOURCE_FAVICON = SOURCE_FAVICON;
