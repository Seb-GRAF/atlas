# Profile Chooser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the top-left Atlas profile pill into a working profile chooser and creator shortcut.

**Architecture:** Keep profile creation on the existing full creator page, and make the React dashboard profile-aware through a URL `profile` query parameter. Use profile-scoped React Query keys so switching profiles does not mix state, settings, or listing mutations.

**Tech Stack:** React 19, TanStack Query, TypeScript, Vitest, Testing Library, existing Node HTTP APIs.

---

### Task 1: Profile Routing Helpers

**Files:**
- Create: `dashboard-ui/src/atlas/profileRouting.ts`
- Create: `dashboard-ui/src/atlas/profileRouting.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildProfileDashboardUrl, getActiveProfileSlug } from './profileRouting';

describe('profile routing', () => {
  it('reads the active profile from the URL query string', () => {
    const url = new URL('http://localhost:8787/?profile=fribourg&stage=active');
    expect(getActiveProfileSlug(url)).toBe('fribourg');
  });

  it('falls back to the default profile for missing or unsafe values', () => {
    expect(getActiveProfileSlug(new URL('http://localhost:8787/'))).toBe('vaud-3-pieces');
    expect(getActiveProfileSlug(new URL('http://localhost:8787/?profile=../bad'))).toBe('vaud-3-pieces');
  });

  it('builds a dashboard URL that preserves no stale listing selection', () => {
    expect(buildProfileDashboardUrl('fribourg')).toBe('/?profile=fribourg');
  });
});
```

- [ ] **Step 2: Run and verify red**

Run: `npm run test:ui -- dashboard-ui/src/atlas/profileRouting.test.ts`
Expected: fail because `profileRouting.ts` does not exist.

- [ ] **Step 3: Implement helpers**

```ts
export const DEFAULT_PROFILE_SLUG = 'vaud-3-pieces';

export function sanitizeProfileSlug(value: string | null | undefined, fallback = DEFAULT_PROFILE_SLUG) {
  const clean = String(value || fallback).trim().toLowerCase();
  return /^[a-z0-9-]+$/.test(clean) ? clean : fallback;
}

export function getActiveProfileSlug(url = new URL(window.location.href)) {
  return sanitizeProfileSlug(url.searchParams.get('profile'));
}

export function buildProfileDashboardUrl(slug: string) {
  return `/?profile=${encodeURIComponent(sanitizeProfileSlug(slug))}`;
}
```

- [ ] **Step 4: Run and verify green**

Run: `npm run test:ui -- dashboard-ui/src/atlas/profileRouting.test.ts`
Expected: pass.

### Task 2: Profile-Scoped Data And Scan Hooks

**Files:**
- Modify: `dashboard-ui/src/atlas/data/hooks.ts`
- Modify: `dashboard-ui/src/atlas/scan.ts`
- Modify: `dashboard-ui/src/atlas/screens/AtlasShell.tsx`

- [ ] **Step 1: Write failing tests**

Add tests in `dashboard-ui/src/atlas/data/hooks.test.ts` for exported key helpers:

```ts
import { profileKey, stateKey } from './hooks';

it('scopes query keys by profile slug', () => {
  expect(stateKey('fribourg')).toEqual(['atlas', 'state', 'fribourg']);
  expect(profileKey('fribourg')).toEqual(['atlas', 'profile', 'fribourg']);
});
```

- [ ] **Step 2: Run and verify red**

Run: `npm run test:ui -- dashboard-ui/src/atlas/data/hooks.test.ts`
Expected: fail because `profileKey` and `stateKey` are not exported.

- [ ] **Step 3: Implement profile-aware hooks**

Change `useAtlasState(profileSlug)` to call `getDashboardState(profileSlug)` and `getProfileDetail(profileSlug)`. Export `stateKey(profileSlug)` and `profileKey(profileSlug)`. Change mutations to accept `profileSlug`, read `profileKey(profileSlug)`, and invalidate `stateKey(profileSlug)`. Change `useScan(profileSlug)` to call `startProfileScan(profileSlug)`, use a localStorage key containing the slug, and invalidate `stateKey(profileSlug)`.

- [ ] **Step 4: Run and verify green**

Run: `npm run test:ui -- dashboard-ui/src/atlas/data/hooks.test.ts`
Expected: pass.

### Task 3: Top-Bar Chooser

**Files:**
- Modify: `dashboard-ui/src/atlas/screens/TopBar.tsx`
- Create: `dashboard-ui/src/atlas/screens/TopBar.test.tsx`
- Modify: `dashboard-ui/src/atlas/screens/AtlasShell.tsx`
- Modify: `dashboard/home.js`

- [ ] **Step 1: Write failing chooser tests**

Test that clicking the profile pill opens a menu, highlights the active profile, calls `onProfileSelect` for another profile, links `Nouveau profil` to `/dashboard/home.html#create`, and shows fetch failures visibly.

- [ ] **Step 2: Run and verify red**

Run: `npm run test:ui -- dashboard-ui/src/atlas/screens/TopBar.test.tsx`
Expected: fail because the chooser UI does not exist.

- [ ] **Step 3: Implement chooser**

Use `useQuery({ queryKey: ['atlas', 'profiles'], queryFn: listProfiles })` inside `TopBar`. Keep the current pill styling, add menu state, render a compact absolute menu below it, and use `onProfileSelect(slug)` to navigate. Add `window.location.hash === '#create'` handling in `dashboard/home.js` so the existing creator opens immediately from the shortcut.

- [ ] **Step 4: Run and verify green**

Run: `npm run test:ui -- dashboard-ui/src/atlas/screens/TopBar.test.tsx`
Expected: pass.

### Task 4: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused tests**

Run: `npm run test:ui -- dashboard-ui/src/atlas/profileRouting.test.ts dashboard-ui/src/atlas/data/hooks.test.ts dashboard-ui/src/atlas/screens/TopBar.test.tsx`
Expected: pass.

- [ ] **Step 2: Run build**

Run: `npm run build:ui`
Expected: exit 0.
