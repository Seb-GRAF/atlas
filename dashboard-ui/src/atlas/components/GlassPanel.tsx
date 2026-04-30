import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  variant?: 'panel' | 'card';
};

export function GlassPanel({ children, variant = 'panel', style, ...rest }: GlassPanelProps) {
  const variantStyle: CSSProperties =
    variant === 'card'
      ? { borderRadius: 'var(--atlas-r-card)' }
      : { borderRadius: 'var(--atlas-r-lg)' };

  return (
    <div
      style={{
        background: 'var(--atlas-glass-panel-bg)',
        backdropFilter: 'var(--atlas-glass-panel-blur)',
        WebkitBackdropFilter: 'var(--atlas-glass-panel-blur)',
        boxShadow: 'var(--atlas-shadow-2)',
        ...variantStyle,
        ...style
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
