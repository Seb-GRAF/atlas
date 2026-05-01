import type { AtlasListing } from '../types';

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function searchableText(listing: AtlasListing): string {
  return normalize(
    [
      listing.title,
      listing.area,
      listing.address,
      listing.source,
      listing.notes,
      listing.totalChf != null ? String(listing.totalChf) : '',
      listing.rooms != null ? String(listing.rooms) : '',
      listing.surfaceM2 != null ? String(listing.surfaceM2) : ''
    ].join(' ')
  );
}

export function filterListingsByQuery(listings: AtlasListing[], query: string): AtlasListing[] {
  const terms = normalize(query)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (terms.length === 0) return listings;

  return listings.filter((listing) => {
    const haystack = searchableText(listing);
    return terms.every((term) => haystack.includes(term));
  });
}
