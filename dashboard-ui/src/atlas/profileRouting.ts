export const DEFAULT_PROFILE_SLUG = 'vaud-3-pieces';

export function sanitizeProfileSlug(value: string | null | undefined) {
  const clean = String(value || '').trim().toLowerCase();
  if (!clean) return undefined;
  return /^[a-z0-9-]+$/.test(clean) ? clean : undefined;
}

export function getActiveProfileSlug(url = new URL(window.location.href)) {
  return sanitizeProfileSlug(url.searchParams.get('profile'));
}

export function buildProfileDashboardUrl(slug: string) {
  return `/?profile=${encodeURIComponent(sanitizeProfileSlug(slug) ?? DEFAULT_PROFILE_SLUG)}`;
}
