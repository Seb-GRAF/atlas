import { describe, expect, it } from 'vitest';
import { buildProfileDashboardUrl, getActiveProfileSlug } from './profileRouting';

describe('profile routing', () => {
  it('reads the active profile from the URL query string', () => {
    const url = new URL('http://localhost:8787/?profile=fribourg&stage=active');

    expect(getActiveProfileSlug(url)).toBe('fribourg');
  });

  it('leaves the profile unset for missing or unsafe values so the API can use the server default', () => {
    expect(getActiveProfileSlug(new URL('http://localhost:8787/'))).toBeUndefined();
    expect(getActiveProfileSlug(new URL('http://localhost:8787/?profile=../bad'))).toBeUndefined();
  });

  it('builds a dashboard URL without stale listing selection', () => {
    expect(buildProfileDashboardUrl('fribourg')).toBe('/?profile=fribourg');
  });
});
