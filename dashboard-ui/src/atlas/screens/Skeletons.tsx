import type { CSSProperties } from 'react';

const bar = (width: string | number, height = 8): CSSProperties => ({
  width,
  height,
  borderRadius: 4,
  background: 'var(--atlas-line)'
});

export function ListSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '92px 1fr',
            gap: 12,
            padding: 8
          }}
        >
          <div
            style={{
              aspectRatio: '1',
              borderRadius: 10,
              background: 'var(--atlas-soft)'
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
            <div style={bar('60%')} />
            <div style={bar('40%')} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 14 }}>
      <div
        style={{
          aspectRatio: '4 / 3',
          borderRadius: 14,
          background: 'var(--atlas-soft)'
        }}
      />
      <div style={bar('70%', 14)} />
      <div style={bar('40%', 12)} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 56,
              borderRadius: 12,
              background: 'var(--atlas-paper-2)',
              boxShadow: '0 0 0 1px var(--atlas-line)'
            }}
          />
        ))}
      </div>
    </div>
  );
}
