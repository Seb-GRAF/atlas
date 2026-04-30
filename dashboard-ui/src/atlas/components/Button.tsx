import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

type AtlasButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  leftSection?: ReactNode;
  rightSection?: ReactNode;
  children?: ReactNode;
};

const baseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontFamily: 'var(--atlas-sans)',
  fontSize: 13,
  fontWeight: 500,
  borderRadius: 999,
  border: 0,
  cursor: 'pointer',
  transition: 'background 140ms ease, color 140ms ease, box-shadow 140ms ease',
  letterSpacing: '-0.005em'
};

const VARIANT_STYLE: Record<Variant, CSSProperties> = {
  primary: {
    background: 'var(--atlas-ink)',
    color: '#fff',
    padding: '10px 18px',
    boxShadow: 'var(--atlas-shadow-3)'
  },
  secondary: {
    background: 'var(--atlas-paper)',
    color: 'var(--atlas-ink-2)',
    padding: '10px 14px',
    boxShadow: 'inset 0 0 0 1px var(--atlas-line)'
  },
  ghost: {
    background: 'var(--atlas-soft)',
    color: 'var(--atlas-ink)',
    padding: '8px 12px'
  }
};

export function AtlasButton({
  variant = 'primary',
  leftSection,
  rightSection,
  children,
  style,
  type,
  ...rest
}: AtlasButtonProps) {
  return (
    <button
      // eslint-disable-next-line react/button-has-type
      type={type ?? 'button'}
      style={{ ...baseStyle, ...VARIANT_STYLE[variant], ...style }}
      {...rest}
    >
      {leftSection}
      {children}
      {rightSection}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: number;
  children: ReactNode;
};

export function AtlasIconButton({ size = 32, children, style, type, ...rest }: IconButtonProps) {
  return (
    <button
      // eslint-disable-next-line react/button-has-type
      type={type ?? 'button'}
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: 'var(--atlas-soft)',
        color: 'var(--atlas-ink)',
        border: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        ...style
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
