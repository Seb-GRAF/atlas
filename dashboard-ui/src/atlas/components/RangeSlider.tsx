import { useId, type CSSProperties } from 'react';

type RangeSliderProps = {
  min: number;
  max: number;
  step: number;
  valueMin: number;
  valueMax: number;
  onChange: (next: { min: number; max: number }) => void;
  ariaLabelMin?: string;
  ariaLabelMax?: string;
  style?: CSSProperties;
};

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 18;
const ROW_HEIGHT = THUMB_SIZE + 8;

const wrapperStyle: CSSProperties = {
  position: 'relative',
  height: ROW_HEIGHT,
  width: '100%',
  display: 'flex',
  alignItems: 'center'
};

const trackStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '50%',
  height: TRACK_HEIGHT,
  borderRadius: TRACK_HEIGHT,
  background: 'rgba(22,20,15,.10)',
  transform: 'translateY(-50%)',
  pointerEvents: 'none'
};

const fillStyle: CSSProperties = {
  position: 'absolute',
  top: '50%',
  height: TRACK_HEIGHT,
  borderRadius: TRACK_HEIGHT,
  background: 'var(--atlas-ink)',
  transform: 'translateY(-50%)',
  pointerEvents: 'none'
};

// Stack two native range inputs absolutely. Each input uses pointer-events:none
// on the track and pointer-events:auto on the thumb so the user can grab whichever
// thumb is closer (swap z-index based on min thumb position so the right thumb
// stays reachable when both collapse to the right edge).
const inputBaseStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '50%',
  transform: 'translateY(-50%)',
  width: '100%',
  height: THUMB_SIZE,
  margin: 0,
  padding: 0,
  background: 'transparent',
  pointerEvents: 'none',
  WebkitAppearance: 'none',
  appearance: 'none',
  outline: 'none'
};

export function RangeSlider({
  min,
  max,
  step,
  valueMin,
  valueMax,
  onChange,
  ariaLabelMin,
  ariaLabelMax,
  style
}: RangeSliderProps) {
  const id = useId();
  const styleId = `range-slider-${id.replace(/[^a-zA-Z0-9]/g, '')}`;
  const range = max - min || 1;
  const lowPct = ((valueMin - min) / range) * 100;
  const highPct = ((valueMax - min) / range) * 100;
  // When the lower thumb is past the midpoint, raise it so it stays grabbable.
  const lowThumbZ = lowPct > 50 ? 5 : 3;
  const highThumbZ = lowPct > 50 ? 4 : 5;

  const clampMin = (next: number) => Math.min(next, valueMax - step);
  const clampMax = (next: number) => Math.max(next, valueMin + step);

  return (
    <div
      style={{ ...wrapperStyle, ...style }}
      data-vaul-no-drag
      onPointerDownCapture={(event) => event.stopPropagation()}
    >
      <style>{`
        .${styleId}::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: ${THUMB_SIZE}px;
          height: ${THUMB_SIZE}px;
          border-radius: 999px;
          background: var(--atlas-paper);
          box-shadow: 0 0 0 1.5px var(--atlas-ink), 0 1px 4px rgba(22,20,15,.18);
          cursor: grab;
          pointer-events: auto;
          margin-top: 0;
          transition: transform 120ms ease, box-shadow 120ms ease;
        }
        .${styleId}::-webkit-slider-thumb:hover {
          transform: scale(1.08);
        }
        .${styleId}::-webkit-slider-thumb:active {
          cursor: grabbing;
          transform: scale(1.12);
          box-shadow: 0 0 0 1.5px var(--atlas-ink), 0 2px 8px rgba(22,20,15,.28);
        }
        .${styleId}::-moz-range-thumb {
          width: ${THUMB_SIZE}px;
          height: ${THUMB_SIZE}px;
          border: 1.5px solid var(--atlas-ink);
          border-radius: 999px;
          background: var(--atlas-paper);
          box-shadow: 0 1px 4px rgba(22,20,15,.18);
          cursor: grab;
          pointer-events: auto;
        }
        .${styleId}::-webkit-slider-runnable-track {
          background: transparent;
          height: ${THUMB_SIZE}px;
          border: 0;
        }
        .${styleId}::-moz-range-track {
          background: transparent;
          height: ${THUMB_SIZE}px;
          border: 0;
        }
      `}</style>
      <div style={trackStyle} />
      <div
        style={{
          ...fillStyle,
          left: `${lowPct}%`,
          width: `${Math.max(0, highPct - lowPct)}%`
        }}
      />
      <input
        type="range"
        className={styleId}
        min={min}
        max={max}
        step={step}
        value={valueMin}
        aria-label={ariaLabelMin}
        onChange={(event) => {
          const next = clampMin(Number(event.target.value));
          if (next !== valueMin) onChange({ min: next, max: valueMax });
        }}
        style={{ ...inputBaseStyle, zIndex: lowThumbZ }}
      />
      <input
        type="range"
        className={styleId}
        min={min}
        max={max}
        step={step}
        value={valueMax}
        aria-label={ariaLabelMax}
        onChange={(event) => {
          const next = clampMax(Number(event.target.value));
          if (next !== valueMax) onChange({ min: valueMin, max: next });
        }}
        style={{ ...inputBaseStyle, zIndex: highThumbZ }}
      />
    </div>
  );
}
