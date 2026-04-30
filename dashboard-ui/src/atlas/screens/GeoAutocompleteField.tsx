import { useId, useRef, useState, type CSSProperties } from 'react';
import { AtlasInput } from '../components';
import type { Area } from '../../api/schemas';
import type { GeoAddress, GeoResult } from './geoAutocomplete';

const GEO_SEARCH_URL = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';

type GeoOption = Area | GeoAddress;

type GeoAutocompleteFieldProps<T extends GeoOption> = {
  ariaLabel: string;
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (value: T) => void;
  parseResult: (result: GeoResult) => T | null;
  origins?: string;
  minChars?: number;
  placeholder?: string;
};

const fieldWrapStyle: CSSProperties = {
  position: 'relative'
};

const listStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 50,
  left: 0,
  right: 0,
  top: 'calc(100% + 6px)',
  margin: 0,
  padding: 4,
  listStyle: 'none',
  borderRadius: 10,
  background: 'var(--atlas-paper)',
  boxShadow: 'var(--atlas-shadow-2), 0 0 0 1px var(--atlas-line)'
};

const optionStyle: CSSProperties = {
  width: '100%',
  border: 0,
  background: 'transparent',
  padding: '8px 9px',
  borderRadius: 7,
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'var(--atlas-sans)',
  fontSize: 13,
  color: 'var(--atlas-ink)'
};

const metaStyle: CSSProperties = {
  marginTop: 6,
  fontFamily: 'var(--atlas-sans)',
  fontSize: 12,
  color: 'var(--atlas-ink-3)'
};

export function GeoAutocompleteField<T extends GeoOption>({
  ariaLabel,
  value,
  onValueChange,
  onSelect,
  parseResult,
  origins,
  minChars = 2,
  placeholder
}: GeoAutocompleteFieldProps<T>) {
  const [options, setOptions] = useState<T[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);
  const listboxId = useId();

  const search = async (query: string) => {
    abortRef.current?.abort();
    setError(null);
    if (query.trim().length < minChars) {
      setOptions([]);
      setStatus('idle');
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');

    try {
      const url = new URL(GEO_SEARCH_URL);
      url.searchParams.set('searchText', query.trim());
      url.searchParams.set('type', 'locations');
      url.searchParams.set('limit', '8');
      if (origins) url.searchParams.set('origins', origins);

      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`geo.admin.ch ${response.status}`);
      const payload = await response.json();
      const next = (Array.isArray(payload?.results) ? payload.results : [])
        .map((item: GeoResult) => parseResult(item))
        .filter((item: T | null): item is T => Boolean(item));
      if (requestRef.current !== requestId) return;
      setOptions(next);
      setActiveIndex(0);
      setStatus('idle');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (requestRef.current !== requestId) return;
      setOptions([]);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Recherche impossible');
    }
  };

  return (
    <div style={fieldWrapStyle}>
      <AtlasInput
        aria-label={ariaLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={options.length > 0}
        aria-controls={options.length > 0 ? listboxId : undefined}
        aria-activedescendant={options[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => {
          const next = event.target.value;
          onValueChange(next);
          void search(next);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOptions([]);
          if (event.key === 'ArrowDown' && options.length > 0) {
            event.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, options.length - 1));
          }
          if (event.key === 'ArrowUp' && options.length > 0) {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          }
          if (event.key === 'Enter' && options[activeIndex]) {
            event.preventDefault();
            onSelect(options[activeIndex]);
            setOptions([]);
          }
        }}
      />
      {options.length > 0 ? (
        <ul id={listboxId} role="listbox" aria-label={`${ariaLabel} suggestions`} style={listStyle}>
          {options.map((option, index) => (
            <li key={`${option.label}-${option.lat ?? ''}-${option.lon ?? ''}`}>
              <button
                id={`${listboxId}-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                style={{
                  ...optionStyle,
                  background: index === activeIndex ? 'var(--atlas-soft)' : optionStyle.background
                }}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  onSelect(option);
                  setOptions([]);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {status === 'loading' ? <div style={metaStyle}>Recherche...</div> : null}
      {error ? <div style={{ ...metaStyle, color: 'var(--atlas-bad)' }}>{error}</div> : null}
    </div>
  );
}
