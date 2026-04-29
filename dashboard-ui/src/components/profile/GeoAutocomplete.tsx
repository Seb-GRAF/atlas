import { Combobox, Loader, TextInput, TextInputProps, Text, useCombobox } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { Area } from '../../api/schemas';
import { buildSlug } from '../../utils/format';

const CANTON_MAP: Record<string, string> = {
  ag: 'aargau',
  ai: 'appenzell-innerrhoden',
  ar: 'appenzell-ausserrhoden',
  be: 'bern',
  bl: 'basel-landschaft',
  bs: 'basel-stadt',
  fr: 'fribourg',
  ge: 'geneve',
  gl: 'glarus',
  gr: 'graubunden',
  ju: 'jura',
  lu: 'luzern',
  ne: 'neuchatel',
  nw: 'nidwalden',
  ow: 'obwalden',
  sg: 'st-gallen',
  sh: 'schaffhausen',
  so: 'solothurn',
  sz: 'schwyz',
  tg: 'thurgau',
  ti: 'ticino',
  ur: 'uri',
  vd: 'vaud',
  vs: 'valais',
  zg: 'zug',
  zh: 'zurich'
};

function parseGeoResult(result: { attrs?: Record<string, unknown> }): Area {
  const attrs = result.attrs || {};
  const rawLabel = String(attrs.label || '').replace(/<[^>]+>/g, '').trim();
  const detail = String(attrs.detail || '').toLowerCase();
  const cantonMatch = detail.match(/\b([a-z]{2})$/);
  const cantonAbbr = cantonMatch ? cantonMatch[1] : '';
  const cityName = rawLabel.replace(/\s*\([A-Z]{2}\)\s*$/, '').trim();

  return {
    label: cityName,
    slug: buildSlug(cityName),
    canton: CANTON_MAP[cantonAbbr] || cantonAbbr,
    cantonAbbr: cantonAbbr.toUpperCase(),
    npa: null,
    lat: Number(attrs.lat),
    lon: Number(attrs.lon)
  };
}

export function GeoAutocomplete({
  label,
  placeholder,
  origins,
  minChars,
  value,
  onValueChange,
  onGeoSelect,
  rightSection,
  ...props
}: TextInputProps & {
  origins?: string;
  minChars: number;
  value: string;
  onValueChange: (value: string) => void;
  onGeoSelect: (item: Area) => void;
}) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption()
  });
  const [items, setItems] = useState<Area[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = value.trim();
    setError(null);
    if (q.length < minChars) {
      setItems([]);
      combobox.closeDropdown();
      return;
    }

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      const originsParam = origins ? `&origins=${origins}` : '';
      const url = `https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${encodeURIComponent(
        q
      )}&type=locations${originsParam}&limit=8`;

      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`geo.admin.ch ${res.status}`);
        const data = (await res.json()) as { results?: Array<{ attrs?: Record<string, unknown> }> };
        const nextItems = (data.results || []).map(parseGeoResult).filter((item) => item.label && item.slug);
        setItems(nextItems);
        if (nextItems.length) combobox.openDropdown();
        else combobox.closeDropdown();
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setItems([]);
          setError((err as Error).message);
          combobox.closeDropdown();
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [combobox, minChars, origins, value]);

  return (
    <Combobox
      store={combobox}
      withinPortal={false}
      onOptionSubmit={(optionValue) => {
        const item = items[Number(optionValue)];
        if (item) onGeoSelect(item);
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <TextInput
          label={label}
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            onValueChange(event.currentTarget.value);
            combobox.updateSelectedOptionIndex();
          }}
          onFocus={() => {
            if (items.length) combobox.openDropdown();
          }}
          onBlur={() => combobox.closeDropdown()}
          error={error ? `Autocomplete indisponible: ${error}` : props.error}
          rightSection={loading ? <Loader size={14} /> : rightSection}
          {...props}
        />
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Options>
          {items.map((item, index) => (
            <Combobox.Option value={String(index)} key={`${item.slug}-${index}`}>
              <Text size="sm" fw={650}>
                {item.label}
              </Text>
              {item.canton ? (
                <Text size="xs" c="dimmed">
                  {item.cantonAbbr ? `${item.cantonAbbr} · ` : ''}
                  {item.canton}
                </Text>
              ) : null}
            </Combobox.Option>
          ))}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
