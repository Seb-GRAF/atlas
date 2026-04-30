# Single Shell Map Pin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split Leaflet pin plus popup animation with one selected map marker shell that expands into the listing preview card.

**Architecture:** `ApartmentMap.tsx` will render all listing marker states through `L.divIcon` HTML. The selected listing marker receives an expanded class and contains both collapsed price content and expanded preview content, while clusters keep their current fit-bounds behavior. `global.css` owns the single-shell choreography with transform, opacity, clipping, and reduced-motion rules.

**Tech Stack:** React 19, TypeScript, Leaflet `divIcon`, Vitest, Testing Library, CSS.

---

### File Structure

- Modify `dashboard-ui/src/components/listings/ApartmentMap.test.tsx`: add tests that prove selected listing markers render expanded shell HTML, do not bind Leaflet popups, preserve click selection, and pan selected markers without calling `openPopup`.
- Modify `dashboard-ui/src/components/listings/ApartmentMap.tsx`: replace popup binding for listing markers with single-shell marker HTML, delegate image/link clicks from marker DOM to the existing lightbox/open-link behavior, and keep cluster behavior unchanged.
- Modify `dashboard-ui/src/styles/global.css`: remove the split Leaflet popup animation path for listing details and add single-shell marker styles with reduced-motion support.

### Task 1: Failing Map Marker Tests

**Files:**
- Modify: `dashboard-ui/src/components/listings/ApartmentMap.test.tsx`

- [ ] **Step 1: Extend the Leaflet marker mock**

Add `getElement` support and track `openPopup` calls without requiring a real DOM marker from Leaflet:

```ts
type MarkerRecord = {
  latLng: { lat: number; lng: number };
  events: Map<string, () => void>;
  popup: unknown;
  options?: { icon?: { html?: string } };
  element: HTMLElement;
  on: (event: string, handler: () => void) => MarkerRecord;
  bindPopup: (content: unknown, options?: unknown) => MarkerRecord;
  addTo: (layer: unknown) => MarkerRecord;
  getLatLng: () => { lat: number; lng: number };
  getElement: () => HTMLElement;
  openPopup: ReturnType<typeof vi.fn>;
};
```

In the mock `marker` factory, create the element from the provided icon HTML:

```ts
marker: vi.fn((point: [number, number] | { lat: number; lng?: number; lon?: number }, options?: { icon?: { html?: string } }) => {
  const element = document.createElement('div');
  element.innerHTML = options?.icon?.html || '';
  const marker: MarkerRecord = {
    latLng: toLatLng(point),
    events: new Map(),
    popup: null,
    options,
    element,
    on(event, handler) {
      this.events.set(event, handler);
      return this;
    },
    bindPopup(content) {
      this.popup = content;
      return this;
    },
    addTo() {
      markers.push(this);
      return this;
    },
    getLatLng() {
      return this.latLng;
    },
    getElement() {
      return this.element;
    },
    openPopup: vi.fn()
  };
  return marker;
})
```

- [ ] **Step 2: Add a failing test for selected marker shell HTML**

Add this test below the cluster test:

```ts
it('renders the selected listing as one expanded marker shell without binding a popup', async () => {
  render(
    <ApartmentMap
      listings={[listing('one', 46.52, 6.63)]}
      workplace={null}
      selectedListingId="one"
      onSelectListing={vi.fn()}
      onOpenLightbox={vi.fn()}
      open
    />
  );

  await waitFor(() => expect(leafletMock.markers).toHaveLength(1));
  const marker = leafletMock.markers[0];
  const html = marker.options?.icon?.html || '';

  expect(marker.popup).toBeNull();
  expect(html).toContain('atlas-map-pin-shell');
  expect(html).toContain('is-expanded');
  expect(html).toContain('atlas-map-pin-price');
  expect(html).toContain('atlas-map-pin-preview');
  expect(html).toContain('Listing one');
  expect(html).toContain('2');
  expect(html).toContain('100 CHF');
});
```

- [ ] **Step 3: Add a failing test for click selection and selected-marker panning**

Add this test below the selected shell test:

```ts
it('selects marker clicks and pans selected listings without opening Leaflet popups', async () => {
  const onSelectListing = vi.fn();

  const { rerender } = render(
    <ApartmentMap
      listings={[listing('one', 46.52, 6.63)]}
      workplace={null}
      selectedListingId={null}
      onSelectListing={onSelectListing}
      onOpenLightbox={vi.fn()}
      open
    />
  );

  await waitFor(() => expect(leafletMock.markers).toHaveLength(1));
  leafletMock.markers[0].events.get('click')?.();
  expect(onSelectListing).toHaveBeenCalledWith('one');

  rerender(
    <ApartmentMap
      listings={[listing('one', 46.52, 6.63)]}
      workplace={null}
      selectedListingId="one"
      onSelectListing={onSelectListing}
      onOpenLightbox={vi.fn()}
      open
    />
  );

  await waitFor(() => expect(leafletMock.maps[0].panTo).toHaveBeenCalledWith(
    { lat: 46.52, lng: 6.63 },
    { animate: true, duration: 0.35 }
  ));
  expect(leafletMock.markers.at(-1)?.openPopup).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: Run the targeted test and confirm RED**

Run:

```bash
npm run test:ui -- dashboard-ui/src/components/listings/ApartmentMap.test.tsx
```

Expected: FAIL because the current marker HTML still uses `atlas-map-pin` and `bindPopup`, not `atlas-map-pin-shell`/`atlas-map-pin-preview`.

### Task 2: Single Shell Marker Implementation

**Files:**
- Modify: `dashboard-ui/src/components/listings/ApartmentMap.tsx`
- Modify: `dashboard-ui/src/styles/global.css`
- Modify: `dashboard-ui/src/components/listings/ApartmentMap.test.tsx` only if TypeScript mock details from Task 1 need a narrow compile fix.

- [ ] **Step 1: Replace listing marker HTML helpers**

In `ApartmentMap.tsx`, keep `rentPinLabel`, `surfaceLabel`, `commuteLabel`, and popup content helper logic reusable. Replace `markerHtml(item, selected)` with a single-shell helper shaped like this:

```ts
function escapeAttr(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function markerHtml(item: Listing, selected: boolean) {
  const urls = getImageUrls(item);
  const title = listingTitle(item);
  const meta = [money(item.totalChf), surfaceLabel(item)].filter(Boolean).join(' · ');
  const location = item.address || item.area || 'Lieu non renseigné';
  const commute = commuteLabel(item);
  const source = listingSourceLabel(item);
  const isApproximate = item.mapLocation?.precision === 'area';
  const classes = [
    'atlas-map-pin-shell',
    isApproximate ? 'is-approximate' : '',
    selected ? 'is-expanded' : ''
  ].filter(Boolean).join(' ');

  return [
    '<div class="atlas-map-pin-frame is-listing-pin">',
    `<article class="${classes}" aria-label="${escapeAttr(title)}">`,
    `<span class="atlas-map-pin-price">${escapeHtml(rentPinLabel(item.totalChf))}</span>`,
    '<div class="atlas-map-pin-preview" aria-hidden="true">',
    urls.length
      ? `<button class="atlas-map-pin-media" type="button" data-map-action="lightbox" aria-label="${escapeAttr(`Voir les photos de ${title}`)}"><img src="${escapeAttr(urls[0])}" alt="${escapeAttr(`Aperçu ${title}`)}" loading="lazy">${urls.length > 1 ? `<span class="atlas-map-popup-count">+${urls.length - 1}</span>` : ''}</button>`
      : '<div class="atlas-map-pin-media is-empty"><span>Sans photo</span></div>',
    '<div class="atlas-map-popup-body">',
    `<h3 class="atlas-map-popup-title">${escapeHtml(title)}</h3>`,
    meta ? `<p class="atlas-map-popup-meta is-strong">${escapeHtml(meta)}</p>` : '',
    `<p class="atlas-map-popup-meta">${escapeHtml(location)}</p>`,
    commute ? `<p class="atlas-map-popup-meta">${escapeHtml(commute)}</p>` : '',
    '<div class="atlas-map-popup-badges">',
    source ? `<span>${escapeHtml(source)}</span>` : '',
    isApproximate ? '<span>Position approx.</span>' : '',
    '</div>',
    item.url ? `<a class="atlas-map-popup-link" href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer" data-map-action="open-link">Ouvrir l’annonce</a>` : '',
    '</div>',
    '</div>',
    '</article>',
    '</div>'
  ].join('');
}
```

- [ ] **Step 2: Remove Leaflet popup binding for listing markers**

In the listing marker creation chain, remove `.bindPopup(...)` and the `popupopen`/`popupclose` class toggling. Keep `.on('click', () => onSelectListing(item.id))`.

- [ ] **Step 3: Add marker DOM event delegation**

After creating each listing marker, attach DOM listeners so the expanded shell image opens the existing lightbox while other clicks still select the listing:

```ts
const marker = L.marker(point, { icon, riseOnHover: true, zIndexOffset: selected ? 240 : 0 })
  .on('click', () => onSelectListing(item.id))
  .addTo(layer);

const markerElement = marker.getElement();
markerElement?.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  const action = target?.closest<HTMLElement>('[data-map-action]')?.dataset.mapAction;
  if (action === 'lightbox') {
    event.preventDefault();
    event.stopPropagation();
    const urls = getImageUrls(item);
    if (urls.length) onOpenLightbox(urls, 0);
  }
});
```

Do not intercept the external listing link; let the browser open it normally.

- [ ] **Step 4: Pan selected listings without opening popups**

In the selected-listing effect, keep `map.panTo(point, { animate: true, duration: 0.35 })` and remove `marker.openPopup()`.

- [ ] **Step 5: Replace split popup CSS with single-shell CSS**

In `global.css`, keep reusable `.atlas-map-popup-*` content styles. Replace listing pin and `.atlas-leaflet-popup` animation rules with this concrete single-shell structure:

```css
.atlas-map-pin-shell {
  --atlas-map-pin-fill: color-mix(in srgb, var(--mantine-color-white) 96%, transparent);
  --atlas-map-pin-border: color-mix(in srgb, var(--mantine-color-slate-3) 84%, transparent);
  --atlas-map-pin-color: var(--mantine-color-slate-8);
  --atlas-map-pin-shadow: color-mix(in srgb, var(--mantine-color-slate-9) 14%, transparent);
  --atlas-map-shell-scale-x: 0.34;
  --atlas-map-shell-scale-y: 0.13;
  position: relative;
  display: block;
  width: min(286px, calc(100vw - 42px));
  min-height: 222px;
  overflow: hidden;
  border: 1px solid var(--atlas-map-pin-border);
  border-radius: 999px;
  background: var(--atlas-map-pin-fill);
  color: var(--atlas-map-pin-color);
  box-shadow: 0 9px 24px var(--atlas-map-pin-shadow);
  transform: translateY(0) scale(var(--atlas-map-shell-scale-x), var(--atlas-map-shell-scale-y));
  transform-origin: 50% 100%;
  will-change: transform, border-radius, box-shadow;
}

.atlas-map-pin-shell::before,
.atlas-map-pin-shell::after {
  position: absolute;
  left: 50%;
  z-index: 3;
  width: 0;
  height: 0;
  content: '';
  transform: translateX(-50%) scale(calc(1 / var(--atlas-map-shell-scale-x)), calc(1 / var(--atlas-map-shell-scale-y)));
  transform-origin: 50% 0;
}

.atlas-map-pin-shell::before {
  bottom: -9px;
  border-top: 9px solid var(--atlas-map-pin-border);
  border-right: 7px solid transparent;
  border-left: 7px solid transparent;
}

.atlas-map-pin-shell::after {
  bottom: -7px;
  border-top: 7px solid var(--atlas-map-pin-fill);
  border-right: 5px solid transparent;
  border-left: 5px solid transparent;
  filter: drop-shadow(0 5px 5px var(--atlas-map-pin-shadow));
}

.atlas-map-pin-shell.is-approximate {
  --atlas-map-pin-fill: color-mix(in srgb, var(--mantine-color-amber-0) 82%, var(--mantine-color-white));
  --atlas-map-pin-border: color-mix(in srgb, var(--mantine-color-amber-6) 78%, var(--mantine-color-white));
  --atlas-map-pin-color: var(--mantine-color-amber-9);
  border-style: dashed;
}

.atlas-map-pin-shell.is-expanded {
  --atlas-map-shell-scale-x: 1;
  --atlas-map-shell-scale-y: 1;
  --atlas-map-pin-fill: var(--mantine-color-white);
  --atlas-map-pin-border: var(--mantine-color-slate-2);
  --atlas-map-pin-color: var(--mantine-color-dark-8);
  --atlas-map-pin-shadow: color-mix(in srgb, var(--mantine-color-slate-9) 18%, transparent);
  z-index: 1;
  border-radius: var(--mantine-radius-md);
  box-shadow: var(--mantine-shadow-lg), 0 0 0 1px var(--mantine-color-slate-2);
}

.atlas-map-pin-shell.is-expanded::before,
.atlas-map-pin-shell.is-expanded::after {
  opacity: 0;
}

.atlas-map-pin-price {
  position: absolute;
  left: 50%;
  bottom: 0;
  z-index: 2;
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  padding: 5px 10px;
  border-radius: 999px;
  color: inherit;
  font-size: 11.5px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  white-space: nowrap;
  transform: translateX(-50%) scale(calc(1 / var(--atlas-map-shell-scale-x)), calc(1 / var(--atlas-map-shell-scale-y)));
}

.atlas-map-pin-preview {
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
}

.atlas-map-pin-shell.is-expanded .atlas-map-pin-price {
  opacity: 0;
}

.atlas-map-pin-shell.is-expanded .atlas-map-pin-preview {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.atlas-map-pin-media {
  position: relative;
  display: grid;
  width: 100%;
  aspect-ratio: 4 / 3;
  place-items: center;
  padding: 0;
  border: 0;
  background: var(--mantine-color-slate-1);
  color: var(--mantine-color-slate-7);
  cursor: pointer;
  font-size: 12px;
  font-weight: 750;
  overflow: hidden;
}

.atlas-map-pin-media.is-empty {
  cursor: default;
}

.atlas-map-pin-media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@media (prefers-reduced-motion: no-preference) {
  .atlas-map-pin-shell {
    transition: transform 380ms cubic-bezier(0.22, 1, 0.36, 1),
      border-radius 380ms cubic-bezier(0.22, 1, 0.36, 1),
      box-shadow 380ms cubic-bezier(0.22, 1, 0.36, 1),
      background-color 240ms cubic-bezier(0.22, 1, 0.36, 1),
      border-color 240ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .atlas-map-pin-price,
  .atlas-map-pin-preview,
  .atlas-map-pin-shell::before,
  .atlas-map-pin-shell::after {
    transition: opacity 160ms cubic-bezier(0.22, 1, 0.36, 1),
      transform 380ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .atlas-map-pin-shell.is-expanded .atlas-map-pin-preview {
    transition-delay: 130ms;
  }
}

@media (prefers-reduced-motion: reduce) {
  .atlas-map-pin-shell,
  .atlas-map-pin-price,
  .atlas-map-pin-preview,
  .atlas-map-pin-shell::before,
  .atlas-map-pin-shell::after {
    transition: none !important;
    animation: none !important;
  }
}
```

The shell has fixed expanded dimensions and visually animates its width and height through `scaleX`/`scaleY` from the bottom-center origin. This keeps the effect as one entity while avoiding layout-driven animation jank.

- [ ] **Step 6: Run targeted test and confirm GREEN**

Run:

```bash
npm run test:ui -- dashboard-ui/src/components/listings/ApartmentMap.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run full UI test suite**

Run:

```bash
npm run test:ui
```

Expected: PASS.

- [ ] **Step 8: Self-review**

Check:

- `ApartmentMap.tsx` no longer binds Leaflet popups for listing markers.
- Cluster markers still have no popup and still fit bounds.
- `selectedListingId` is the only source of expanded marker state.
- Missing images render visible `Sans photo` content.
- Reduced motion disables marker choreography.
