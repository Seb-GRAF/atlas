# Single Shell Map Pin Animation Design

## Context

The listing map currently uses Leaflet `divIcon` pins for listing prices and Leaflet popups for listing details. Recent animation work tries to make the pin expand into the popup, but the effect is split across two separate DOM entities. That makes the transition look like a handoff instead of one object changing shape.

The desired interaction is a refined, Dynamic Island-like expansion where the selected map pin feels like the same entity widening and growing into the listing detail surface.

## Decision

Use a single animated marker shell for the selected listing. The selected listing marker owns both states:

- Collapsed state: compact price pill with the current pin-tail affordance.
- Expanded state: the same shell grows from the map anchor into a listing preview card.

The animation should visually change width and height, but the implementation should favor GPU-friendly transforms, clipping, opacity, and border-radius changes over animating layout properties directly. The shell should have stable expanded dimensions, transform from the bottom-center origin, and reveal the card content after the shell is mostly open.

## Behavior

Clicking a listing marker selects it and expands that marker. Selecting another marker collapses the previous expanded marker and expands the new selected marker. The map should still pan to the selected marker.

Clusters keep their current behavior: clicking a cluster fits the map bounds around the clustered listings. Cluster markers do not need the single-shell expansion in this iteration.

The expanded shell should show the same core information as the current popup: primary image when available, listing title, rent and surface metadata, location, commute text when available, source/precision badges, and the external listing link. Existing image-lightbox behavior should still work from the preview image.

## Implementation Shape

The map should stop using Leaflet popup UI for listing details. Instead, `ApartmentMap.tsx` should render richer marker HTML for listing markers and toggle an expanded class based on `selectedListingId`.

The marker shell should remain anchored to the listing coordinate. The expanded state should use bottom-center transform origin so the collapsed pill appears to grow from the pin location. Any tail should disappear as part of the same shell state rather than being hidden by a separate popup.

The CSS should define one coherent choreography:

- Shell expansion: about 320-420ms with a smooth ease-out curve.
- Content reveal: delayed until the shell has enough area to hold content, about 120-180ms after expansion starts.
- Collapse: slightly faster than expansion.

## Accessibility And Motion

The marker remains keyboard and screen-reader compatible through Leaflet's marker behavior. The expanded preview must not hide errors or substitute placeholder data silently; missing images should use the existing visible empty image treatment.

Respect `prefers-reduced-motion`. In reduced motion mode, the shell should switch between collapsed and expanded states without choreography while preserving readable content and selection behavior.

## Files

Expected implementation files:

- `dashboard-ui/src/components/listings/ApartmentMap.tsx`: generate single-shell marker HTML, remove popup binding for listing details, preserve map panning, selection, lightbox, and cluster behavior.
- `dashboard-ui/src/styles/global.css`: replace split pin/popup animation with single-shell marker styles and reduced-motion handling.
- `dashboard-ui/src/components/listings/ApartmentMap.test.tsx`: adjust tests for expanded marker HTML and selection behavior.

No database schema changes, no new dependencies, and no broad refactor are needed.

## Verification

Run the targeted map tests and the dashboard UI test suite available in the repo. Manually verify the map interaction in a browser at both desktop and mobile widths:

- A pin expands as one visual object.
- Selecting a different pin collapses the old one.
- The selected listing still pans into view.
- Cluster click behavior still fits grouped listings.
- Reduced motion disables the choreography.
