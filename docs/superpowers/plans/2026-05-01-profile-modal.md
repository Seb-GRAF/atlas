# Profile Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the profile manager page links with dashboard-native create/edit/delete controls in the profile chooser.

**Architecture:** Add a focused React `ProfileEditorModal` that reuses existing Atlas controls, `GeoAutocompleteField`, profile API helpers, and `RangeSlider`. Expand `ProfileChooserMenu` to own modal state, profile-detail loading, create/update/delete mutations, and query invalidation.

**Tech Stack:** React 19, TanStack Query, Vitest, Testing Library, existing Atlas component system.

---

### Task 1: Profile Editor Modal

**Files:**
- Create: `dashboard-ui/src/atlas/screens/ProfileEditorModal.tsx`
- Modify: `dashboard-ui/src/atlas/screens/ProfileChooserMenu.tsx`
- Test: `dashboard-ui/src/atlas/screens/TopBar.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests that:
- Click `Nouveau profil` and expect a dialog titled `Nouveau profil`.
- Verify price sliders are present with labels `Loyer minimum` and `Loyer maximum`.
- Verify room sliders are present with labels `Pièces minimum` and `Pièces maximum`.
- Click an edit button and expect `/api/profile/detail?profile=<slug>` to be requested and the dialog titled `Modifier le profil`.

- [ ] **Step 2: Verify red**

Run: `npm run test:ui -- dashboard-ui/src/atlas/screens/TopBar.test.tsx`

Expected: the new tests fail because the modal and row edit controls do not exist.

- [ ] **Step 3: Implement modal**

Create `ProfileEditorModal.tsx` with:
- `mode: 'create' | 'edit'`
- optional `profile`
- controlled draft state
- zone/workplace autocomplete
- `RangeSlider` for price and rooms
- source toggles
- visible error area
- `onSave(payload)` callback

- [ ] **Step 4: Wire chooser**

Update `ProfileChooserMenu.tsx` to:
- Replace profile page links with modal triggers.
- Add edit and delete icon buttons per profile row.
- Load profile detail before editing.
- Use `createProfile`, `updateProfile`, `deleteProfile`.
- Invalidate `['atlas', 'profiles']` after changes.
- Navigate to `/?profile=<slug>` after successful create/update.

- [ ] **Step 5: Verify green**

Run: `npm run test:ui -- dashboard-ui/src/atlas/screens/TopBar.test.tsx`

Expected: all TopBar chooser tests pass.

### Task 2: Full Verification

**Files:**
- Verify all touched UI files.

- [ ] **Step 1: Run full UI test suite**

Run: `npm run test:ui`

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build:ui`

Expected: build exits 0; existing chunk-size warning is acceptable.

- [ ] **Step 3: Clean generated build artifacts**

Run: `git restore --staged --worktree -- dashboard/dist && rm -f dashboard/dist/assets/index-*.js`

Expected: no `dashboard/dist` changes remain.

- [ ] **Step 4: Whitespace check**

Run: `git diff --check`

Expected: no output, exit 0.
