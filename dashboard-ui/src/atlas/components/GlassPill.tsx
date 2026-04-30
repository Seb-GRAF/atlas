import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

type GlassPillProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  padding?: CSSProperties['padding'];
  as?: 'div' | 'button';
};

export function GlassPill({
  children,
  padding = '8px 12px',
  style,
  as = 'div',
  ...rest
}: GlassPillProps) {
  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding,
    borderRadius: 999,
    background: 'var(--atlas-glass-pill-bg)',
    backdropFilter: 'var(--atlas-glass-pill-blur)',
    WebkitBackdropFilter: 'var(--atlas-glass-pill-blur)',
    boxShadow: 'var(--atlas-shadow-1)',
    fontSize: 13,
    color: 'var(--atlas-ink)',
    border: 0,
    ...style
  };

  if (as === 'button') {
    return (
      <button type="button" style={{ ...baseStyle, cursor: 'pointer' }} {...(rest as HTMLAttributes<HTMLButtonElement>)}>
        {children}
      </button>
    );
  }

  return (
    <div style={baseStyle} {...rest}>
      {children}
    </div>
  );
}
