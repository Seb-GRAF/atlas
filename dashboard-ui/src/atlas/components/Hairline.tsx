import type { CSSProperties } from 'react';

type HairlineProps = {
  vertical?: boolean;
  style?: CSSProperties;
};

export function Hairline({ vertical = false, style }: HairlineProps) {
  return (
    <div
      style={{
        background: 'var(--atlas-line)',
        width: vertical ? 1 : '100%',
        height: vertical ? '100%' : 1,
        ...style
      }}
    />
  );
}
