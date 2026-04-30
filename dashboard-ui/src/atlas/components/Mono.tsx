import type { CSSProperties, ReactNode } from 'react';

type MonoProps = {
  children: ReactNode;
  style?: CSSProperties;
};

const baseStyle: CSSProperties = {
  fontFamily: 'var(--atlas-mono)',
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1'
};

export function Mono({ children, style }: MonoProps) {
  return <span style={{ ...baseStyle, ...style }}>{children}</span>;
}

const formatter = new Intl.NumberFormat('fr-CH');

type PriceProps = {
  amount: number;
  currency?: string;
  style?: CSSProperties;
  suffixStyle?: CSSProperties;
};

export function Price({
  amount,
  currency = 'CHF',
  style,
  suffixStyle
}: PriceProps) {
  return (
    <span
      style={{
        ...baseStyle,
        fontWeight: 500,
        fontSize: 14,
        color: 'var(--atlas-ink)',
        ...style
      }}
    >
      {formatter.format(Math.round(amount))}
      <span
        style={{
          fontSize: 11,
          color: 'var(--atlas-ink-3)',
          marginLeft: 3,
          ...suffixStyle
        }}
      >
        {currency}
      </span>
    </span>
  );
}

export const formatCHF = (n: number) => formatter.format(Math.round(n));
