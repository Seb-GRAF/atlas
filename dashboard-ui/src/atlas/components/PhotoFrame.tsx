import { useState, type CSSProperties, type MouseEvent } from 'react';
import { Icons } from '../icons';

type PhotoFrameProps = {
  images: string[];
  aspect?: CSSProperties['aspectRatio'];
  radius?: number;
  count?: boolean;
  kenBurns?: boolean;
  onOpen?: (images: string[], index: number) => void;
};

const navBtnStyle = (side: 'left' | 'right'): CSSProperties => ({
  position: 'absolute',
  top: '50%',
  left: side === 'left' ? 8 : undefined,
  right: side === 'right' ? 8 : undefined,
  transform: 'translateY(-50%)',
  width: 28,
  height: 28,
  borderRadius: 999,
  background: 'rgba(255,255,255,.92)',
  color: 'var(--atlas-ink)',
  display: 'grid',
  placeItems: 'center',
  boxShadow: '0 4px 12px rgba(0,0,0,.16)',
  cursor: 'pointer',
  border: 0,
  padding: 0
});

export function PhotoFrame({
  images,
  aspect = '4 / 3',
  radius = 10,
  count = true,
  kenBurns = false,
  onOpen
}: PhotoFrameProps) {
  const [idx, setIdx] = useState(0);
  const [hover, setHover] = useState(false);
  const total = images.length;
  const current = images[idx] ?? images[0];

  const go = (delta: number) => (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIdx((prev) => (prev + delta + total) % total);
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onOpen?.(images, idx);
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={handleClick}
      style={{
        position: 'relative',
        aspectRatio: aspect,
        background: 'var(--atlas-soft)',
        borderRadius: radius,
        overflow: 'hidden',
        cursor: onOpen ? 'zoom-in' : 'default'
      }}
    >
      {current ? (
        <img
          src={current}
          alt=""
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: kenBurns ? 'scale(1.03)' : 'none',
            transition: 'opacity 200ms ease'
          }}
        />
      ) : null}
      {hover && total > 1 ? (
        <>
          <button onClick={go(-1)} style={navBtnStyle('left')} aria-label="Photo précédente">
            <Icons.Chevron stroke={1.8} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <button onClick={go(1)} style={navBtnStyle('right')} aria-label="Photo suivante">
            <Icons.Chevron stroke={1.8} />
          </button>
        </>
      ) : null}
      {total > 1 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 8,
            display: 'flex',
            justifyContent: 'center',
            gap: 4,
            pointerEvents: 'none'
          }}
        >
          {images.map((_, i) => (
            <span
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              style={{
                width: i === idx ? 14 : 4,
                height: 4,
                borderRadius: 2,
                background: i === idx ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.55)',
                transition: 'width 160ms ease'
              }}
            />
          ))}
        </div>
      ) : null}
      {count && total > 1 ? (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            padding: '3px 8px',
            borderRadius: 999,
            background: 'rgba(22,20,15,.55)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            color: '#fff',
            fontSize: 11,
            fontFamily: 'var(--atlas-mono)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5
          }}
        >
          <Icons.Photo size={11} stroke={1.8} />
          {idx + 1}/{total}
        </div>
      ) : null}
    </div>
  );
}
