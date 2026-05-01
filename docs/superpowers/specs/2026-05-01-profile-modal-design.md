# Profile Modal Design

## Goal

Move profile creation, edition, and deletion into the top-left dashboard profile chooser so the user no longer has to leave the dashboard for profile management.

## Approved Direction

The top-left profile chooser becomes the control center:

- Clicking the profile pill opens a compact chooser.
- Each profile row supports selecting, editing, and deleting that profile.
- `Nouveau profil` opens a modal over the current dashboard.
- Edit opens the same modal prefilled from `/api/profile/detail`.
- Delete stays in the chooser and uses an inline confirmation state before calling `/api/profile/delete`.

## Visual Style

Use the existing Atlas dashboard system: warm paper surfaces, ink typography, compact controls, 8-18px radii, quiet shadows, and visible error states. The modal should feel like a focused operations panel, not a separate landing/profile page.

## Form Behavior

The modal supports:

- Title.
- Zones via the existing geo autocomplete.
- Workplace via the existing geo autocomplete.
- Price range using the existing `RangeSlider` for min/max rent.
- Room range using the existing `RangeSlider`.
- Hard ceiling, surface minimum, age limit, missing-surface toggle, and source toggles.

Create uses `/api/profile/create`; edit uses `/api/profile/update`; profile lists invalidate after mutations. After creating or editing a profile, the modal closes and the app navigates to the saved profile with `/?profile=<slug>`.

## Error Handling

Errors remain visible in the menu or modal. No mutation failure should be hidden behind a silent close.

## Out of Scope

The legacy `/dashboard/home.html` page can remain as a fallback, but the dashboard chooser should no longer link users there for normal create/edit/delete workflows.
