type ToggleProps = {
  on: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
};

export function AtlasToggle({ on, onChange, ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={() => onChange(!on)}
      style={{
        width: 32,
        height: 18,
        borderRadius: 999,
        padding: 2,
        background: on ? 'var(--atlas-ink)' : 'rgba(22,20,15,.18)',
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'pointer',
        border: 0,
        transition: 'background 140ms ease'
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 999,
          background: '#fff',
          marginLeft: on ? 14 : 0,
          transition: 'margin 160ms ease'
        }}
      />
    </button>
  );
}
