import fs from 'node:fs/promises';
import path from 'node:path';

import {
  buildMarketplaceSearchUrl,
  clusterMarketplaceAreas,
  distanceKm,
  marketplaceRegionKey
} from './facebook-marketplace-regions.mjs';
import { geocodeMunicipality } from './geocode.mjs';

const FACEBOOK_BASE_URL = 'https://www.facebook.com';
const MARKETPLACE_ITEM_SELECTOR = 'a[href*="/marketplace/item/"]';

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toAbsoluteFacebookUrl(value = '') {
  const clean = String(value || '').trim();
  if (!clean) return null;
  try {
    return new URL(clean, FACEBOOK_BASE_URL).toString();
  } catch {
    return null;
  }
}

function extractMarketplaceId(url = '') {
  const clean = String(url || '');
  const match = clean.match(/\/marketplace\/item\/(\d+)/i);
  return match?.[1] || null;
}

function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractMarketplaceVisibleFilterText(text = '') {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean);
  const filterIndex = lines.findLastIndex((line) => /^(filtres?|filters?)$/i.test(line));
  if (filterIndex < 0) return String(text || '');
  return lines.slice(filterIndex + 1, filterIndex + 8).join('\n');
}

const SWISS_CANTON_CODES = new Set([
  'ag', 'ai', 'ar', 'be', 'bl', 'bs', 'fr', 'ge', 'gl', 'gr', 'ju', 'lu', 'ne',
  'nw', 'ow', 'sg', 'sh', 'so', 'sz', 'tg', 'ti', 'ur', 'vd', 'vs', 'zg', 'zh'
]);

function normalizeMarketplaceLocationForComparison(value = '') {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part && !SWISS_CANTON_CODES.has(part))
    .join(' ')
    .trim();
}

function hasStreetLevelAddress(value = '') {
  const text = normalizeText(value).toLowerCase();
  if (!text) return false;
  return /\b(rue|route|chemin|avenue|av\.?|boulevard|bd\.?|place|impasse|allee|allée)\b/.test(text)
    && /\b\d+[a-z]?\b/i.test(text);
}

function sourceError(code, message) {
  const err = new Error(`${code}: ${message}`);
  err.code = code;
  return err;
}

export function extractMarketplaceLocationLabelFromText(text = '') {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean);
  const radiusPattern = /\b(dans un rayon de|within)\b/i;

  for (const line of lines) {
    if (!line.includes('·') || !radiusPattern.test(line)) continue;
    const [label] = line.split('·');
    const clean = normalizeText(label);
    if (clean) return clean;
  }

  for (let index = 1; index < lines.length; index += 1) {
    if (!radiusPattern.test(lines[index])) continue;
    const previous = normalizeText(lines[index - 1]);
    if (previous && !/^(filtres?|filters?|rayon|radius|distance)$/i.test(previous)) return previous;
  }

  const inlineMatch = normalizeText(text).match(/(?:Filtres|Filters)\s+(.+?)\s+·\s+(?:Dans un rayon de|Within)\b/i);
  if (inlineMatch?.[1]) return normalizeText(inlineMatch[1]);
  const splitInlineMatch = normalizeText(text).match(/(?:Filtres|Filters)\s+(.+?)\s+(?:Dans un rayon de|Within)\b/i);
  if (splitInlineMatch?.[1]) return normalizeText(splitInlineMatch[1]);
  return '';
}

export function assertMarketplaceActiveLocation(pageText = '', expectedLabel = '') {
  const expected = normalizeText(expectedLabel);
  if (!expected) return;

  const filterText = extractMarketplaceVisibleFilterText(pageText);
  const actual = extractMarketplaceLocationLabelFromText(filterText);
  const normalizedExpected = normalizeMarketplaceLocationForComparison(expected);
  const normalizedActual = normalizeMarketplaceLocationForComparison(actual);

  if (
    normalizedExpected
    && normalizedActual
    && (normalizedActual.includes(normalizedExpected) || normalizedExpected.includes(normalizedActual))
  ) {
    return;
  }

  throw sourceError(
    'FB_MARKETPLACE_LOCATION_MISMATCH',
    `Expected Facebook Marketplace location "${expected}", but active location was "${actual || 'unknown'}"`
  );
}

function marketplaceTextMatchesActiveLocation(pageText = '', expectedLabel = '') {
  try {
    assertMarketplaceActiveLocation(pageText, expectedLabel);
    return true;
  } catch {
    return false;
  }
}

export function marketplaceTextShowsRadius(pageText = '', radiusKm) {
  const radius = finiteNumber(radiusKm);
  if (radius == null || radius <= 0) return false;

  const radiusText = String(Math.max(1, Math.round(radius)));
  const text = normalizeText(extractMarketplaceVisibleFilterText(pageText)).replace(/\u00a0/g, ' ');
  const radiusUnit = '(?:km|kilom[eè]tres?|kilometres?|kilometers?)';
  const radiusPattern = new RegExp(
    `(?:rayon|radius|distance|within|umkreis)\\b[^\\n]{0,80}\\b${radiusText}\\s*${radiusUnit}\\b|\\b${radiusText}\\s*${radiusUnit}\\b[^\\n]{0,80}\\b(?:rayon|radius|distance|umkreis)`,
    'i'
  );
  return radiusPattern.test(text);
}

export function assertMarketplaceActiveRadius(pageText = '', radiusKm, expectedLabel = '') {
  const radius = finiteNumber(radiusKm);
  if (radius == null || radius <= 0) return;
  if (marketplaceTextShowsRadius(pageText, radius)) return;

  const label = normalizeText(expectedLabel);
  throw sourceError(
    'FB_MARKETPLACE_RADIUS_MISMATCH',
    `Expected Facebook Marketplace radius ${Math.max(1, Math.round(radius))} km${label ? ` for "${label}"` : ''}, but the active radius summary did not match`
  );
}

export function facebookMarketplaceAccessMessage(code, url = '') {
  if (code === 'FB_MARKETPLACE_LOGIN_REQUIRED') {
    return 'Connexion Facebook Marketplace requise. Lance `FACEBOOK_MARKETPLACE_HEADLESS=false npm run facebook:login`, connecte-toi, ouvre Marketplace une fois, puis relance le scan.';
  }
  if (code === 'FB_MARKETPLACE_BLOCKED') {
    return 'Facebook Marketplace bloque temporairement ce profil navigateur. Arrête les scans quelques heures, puis réessaie avec la même session locale.';
  }
  const suffix = url ? ` (${url})` : '';
  return `Accès Facebook Marketplace impossible${suffix}`;
}

function boolEnv(value, fallback) {
  if (value == null || value === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(String(value).toLowerCase());
}

function marketplaceConfig(config = {}) {
  return config?.facebookMarketplace && typeof config.facebookMarketplace === 'object'
    ? config.facebookMarketplace
    : {};
}

function resolveUserDataDir(config = {}) {
  const configured = marketplaceConfig(config).userDataDir || process.env.FACEBOOK_MARKETPLACE_USER_DATA_DIR;
  return path.resolve(configured || 'data/facebook-marketplace-browser');
}

function maxListings(config = {}) {
  const n = Number(marketplaceConfig(config).maxListingsPerSearch ?? 60);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 60;
}

function maxScrolls(config = {}) {
  const n = Number(marketplaceConfig(config).maxScrollsPerSearch ?? 4);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 4;
}

function navigationTimeoutMs(config = {}) {
  const n = Number(marketplaceConfig(config).timeoutMs ?? process.env.FACEBOOK_MARKETPLACE_TIMEOUT_MS ?? 30000);
  return Number.isFinite(n) && n > 0 ? n : 30000;
}

function marketplaceDebugEnabled(config = {}) {
  const configured = marketplaceConfig(config).debug ?? process.env.FACEBOOK_MARKETPLACE_DEBUG;
  return boolEnv(configured, false);
}

function resolveDebugDir(config = {}) {
  const configured = marketplaceConfig(config).debugDir || process.env.FACEBOOK_MARKETPLACE_DEBUG_DIR;
  return path.resolve(configured || 'data/facebook-marketplace-debug');
}

function marketplaceQueryFromUrl(url = '') {
  try {
    return new URL(url).searchParams.get('query') || '';
  } catch {
    return '';
  }
}

function configuredMarketplaceUrls(facebookMarketplaceConfig = {}) {
  const values = [
    facebookMarketplaceConfig.searchUrl,
    ...(Array.isArray(facebookMarketplaceConfig.searchUrls) ? facebookMarketplaceConfig.searchUrls : [])
  ];
  return uniqueStrings(values)
    .map((url) => toAbsoluteFacebookUrl(url))
    .filter(Boolean);
}

function marketplaceSearchParams(config = {}, facebookMarketplaceConfig = {}) {
  const filters = config?.filters && typeof config.filters === 'object' ? config.filters : {};
  return {
    query: facebookMarketplaceConfig.query || 'louer appartement',
    minPrice: facebookMarketplaceConfig.minPrice ?? filters.minTotalChf ?? 0,
    maxPrice: facebookMarketplaceConfig.maxPrice ?? filters.maxTotalHardChf ?? filters.maxTotalChf ?? 0,
    daysSinceListed: facebookMarketplaceConfig.daysSinceListed ?? 2,
    sortBy: facebookMarketplaceConfig.sortBy || 'creation_time_descend',
    exact: facebookMarketplaceConfig.exact ?? false
  };
}

function regionKeyOrFallback(region = {}, fallback) {
  try {
    return marketplaceRegionKey(region);
  } catch {
    return fallback;
  }
}

function centerMemberLabelForRegion(region = {}) {
  const members = Array.isArray(region.members) ? region.members : [];
  if (!members.length) return String(region.centerLabel || '').trim();
  if (!region.center) return String(members[0]?.label || region.centerLabel || '').trim();

  const centerMember = members.reduce((best, member) => (
    distanceKm(member, region.center) < distanceKm(best, region.center) ? member : best
  ), members[0]);
  return String(centerMember?.label || region.centerLabel || '').trim();
}

function buildRegionPlanEntry(region = {}, index, params = {}, resolvedRegion = null) {
  const center = region.center && typeof region.center === 'object' ? region.center : null;
  const radiusKm = finiteNumber(region.radiusKm);
  const members = Array.isArray(region.members) ? region.members : [];
  const memberLabels = uniqueStrings(
    Array.isArray(region.memberLabels) ? region.memberLabels : members.map((member) => member?.label)
  );
  const label = String(region.label || region.centerLabel || `Configured region ${index + 1}`).trim();
  const facebookLocation = String(region.facebookLocation || resolvedRegion?.facebookLocation || '').trim();
  const expectedLocationLabel = String(
    region.expectedLocationLabel
      || resolvedRegion?.expectedLocationLabel
      || resolvedRegion?.label
      || region.centerLabel
      || label
      || ''
  ).trim();
  const key = regionKeyOrFallback(
    { label, center, radiusKm },
    facebookLocation ? `configured-region:${index + 1}` : `unresolved-region:${index + 1}`
  );
  const url = facebookLocation ? buildMarketplaceSearchUrl({ ...params, facebookLocation }) : '';

  return {
    key,
    label,
    center,
    centerLabel: region.centerLabel || '',
    radiusKm,
    memberLabels,
    query: params.query,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    daysSinceListed: params.daysSinceListed,
    sortBy: params.sortBy,
    exact: params.exact,
    facebookLocation,
    url,
    needsResolution: !facebookLocation,
    expectedLocationLabel
  };
}

export function buildMarketplaceSearchPlan(config = {}) {
  const marketplaceConfig = config?.facebookMarketplace || {};
  const configuredUrls = configuredMarketplaceUrls(marketplaceConfig);
  if (configuredUrls.length) {
    return configuredUrls.map((url, index) => ({
      key: `configured:${index + 1}`,
      label: `Configured ${index + 1}`,
      memberLabels: [],
      radiusKm: null,
      url,
      needsResolution: false,
      expectedLocationLabel: ''
    }));
  }

  const params = marketplaceSearchParams(config, marketplaceConfig);
  const explicitRegions = Array.isArray(marketplaceConfig.searchRegions) ? marketplaceConfig.searchRegions : [];
  if (explicitRegions.length) {
    return explicitRegions.map((region, index) => buildRegionPlanEntry(region, index, params));
  }

  const areas = Array.isArray(config?.areas) ? config.areas : [];
  const resolvedRegions = marketplaceConfig.resolvedRegions && typeof marketplaceConfig.resolvedRegions === 'object'
    ? marketplaceConfig.resolvedRegions
    : {};

  return clusterMarketplaceAreas(areas, marketplaceConfig).map((region, index) => {
    const key = marketplaceRegionKey(region);
    const centerLabel = centerMemberLabelForRegion(region);
    return buildRegionPlanEntry(
      {
        ...region,
        key,
        centerLabel,
        memberLabels: region.members.map((member) => member.label)
      },
      index,
      params,
      resolvedRegions[key] || null
    );
  });
}

export function buildMarketplaceSearchUrls(config = {}) {
  return uniqueStrings(buildMarketplaceSearchPlan(config).map((entry) => entry.url).filter(Boolean));
}

export function marketplaceThrottleDelayMs(config = {}, urlIndex = 0, random = Math.random) {
  if (urlIndex <= 0) return 0;

  const fbConfig = marketplaceConfig(config);
  const configuredMin = finiteNumber(fbConfig.throttleMinMs);
  const envMin = finiteNumber(process.env.FACEBOOK_MARKETPLACE_THROTTLE_MIN_MS);
  const configuredMax = finiteNumber(fbConfig.throttleMaxMs);
  const envMax = finiteNumber(process.env.FACEBOOK_MARKETPLACE_THROTTLE_MAX_MS);
  const min = Math.max(0, configuredMin ?? envMin ?? 20000);
  const max = Math.max(min, configuredMax ?? envMax ?? 45000);

  return Math.round(min + (max - min) * random());
}

export function marketplaceInteractionDelayMs(config = {}, random = Math.random) {
  const fbConfig = marketplaceConfig(config);
  const configuredMin = finiteNumber(fbConfig.interactionMinMs);
  const envMin = finiteNumber(process.env.FACEBOOK_MARKETPLACE_INTERACTION_MIN_MS);
  const configuredMax = finiteNumber(fbConfig.interactionMaxMs);
  const envMax = finiteNumber(process.env.FACEBOOK_MARKETPLACE_INTERACTION_MAX_MS);
  const min = Math.max(0, configuredMin ?? envMin ?? 900);
  const max = Math.max(min, configuredMax ?? envMax ?? 2200);

  return Math.round(min + (max - min) * random());
}

export function finalizeResolvedMarketplaceRegion(entry = {}, resolved = {}) {
  const facebookLocation = String(resolved.facebookLocation || '').trim();
  const useGlobalLocation = resolved.useGlobalLocation === true;
  if (!facebookLocation && !useGlobalLocation) return { ...entry };

  return {
    ...entry,
    facebookLocation,
    useGlobalLocation,
    expectedLocationLabel: String(resolved.expectedLocationLabel || entry.expectedLocationLabel || '').trim(),
    url: buildMarketplaceSearchUrl({
      facebookLocation,
      useGlobalLocation,
      query: entry.query,
      minPrice: entry.minPrice,
      maxPrice: entry.maxPrice,
      daysSinceListed: entry.daysSinceListed,
      sortBy: entry.sortBy,
      exact: entry.exact ?? false
    }),
    needsResolution: false
  };
}

export function assertMarketplaceSearchPlanRadiusSupported(searchPlan = []) {
  const radiusEntries = searchPlan
    .map((entry) => ({
      label: entry?.label || entry?.expectedLocationLabel || entry?.key || 'unknown region',
      radiusKm: finiteNumber(entry?.radiusKm)
    }))
    .filter((entry) => entry.radiusKm != null && entry.radiusKm > 0);
  const uniqueRadii = uniqueStrings(radiusEntries.map((entry) => String(entry.radiusKm)));
  if (uniqueRadii.length <= 1) return;

  throw sourceError(
    'FB_MARKETPLACE_MIXED_RADIUS_UNSUPPORTED',
    `Facebook Marketplace search plans cannot mix radii because radius is account-global: ${
      radiusEntries.map((entry) => `${entry.label} ${entry.radiusKm} km`).join(', ')
    }`
  );
}

export async function hydrateMarketplaceAreaCoordinates(areas = [], cache = {}, options = {}) {
  const resolver = options.geocodeMunicipality || geocodeMunicipality;
  const hydrated = [];

  for (const area of areas) {
    if (finiteNumber(area?.lat) != null && finiteNumber(area?.lon) != null) {
      hydrated.push(area);
      continue;
    }

    const point = await resolver(area?.label, cache, options);
    if (!point) {
      throw sourceError(
        'FB_MARKETPLACE_AREA_COORDINATES_MISSING',
        `Cannot resolve coordinates for Facebook Marketplace area "${area?.label || ''}"`
      );
    }

    hydrated.push({ ...area, lat: point.lat, lon: point.lon });
  }

  return hydrated;
}

export async function prepareMarketplaceSearchConfig(config = {}) {
  const fbConfig = marketplaceConfig(config);
  const hasConfiguredUrls = configuredMarketplaceUrls(fbConfig).length > 0;
  const hasExplicitRegions = Array.isArray(fbConfig.searchRegions) && fbConfig.searchRegions.length > 0;
  const nextConfig = hasConfiguredUrls || hasExplicitRegions
    ? config
    : {
      ...config,
      areas: await hydrateMarketplaceAreaCoordinates(
        Array.isArray(config?.areas) ? config.areas : [],
        config.geocodeCache || {},
        config.geocodeOptions || {}
      )
    };
  const searchPlan = buildMarketplaceSearchPlan(nextConfig);

  return {
    config: nextConfig,
    searchPlan,
    urls: uniqueStrings(searchPlan.map((entry) => entry.url).filter(Boolean))
  };
}

export function parseMarketplacePrice(text = '') {
  const clean = normalizeText(text);
  if (!clean || /gratuit|free|sur demande/i.test(clean)) return null;
  const match = clean.match(/(?:CHF\s*)?(\d[\d\s'’.]*)(?:\s*CHF)?/i);
  if (!match) return null;
  const n = Number(String(match[1]).replace(/[\s'’.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseMarketplaceRooms(text = '') {
  const clean = normalizeText(text);
  if (/\bstudio\b/i.test(clean)) return 1;
  const match = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:pi[eè]ces?|pcs?|p\b|rooms?)/i);
  if (!match) return null;
  const n = Number(String(match[1]).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseMarketplaceSurface(text = '') {
  const match = normalizeText(text).match(/(\d+(?:[.,]\d+)?)\s*m(?:2|²)/i);
  if (!match) return null;
  const n = Number(String(match[1]).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isMarketplaceFreshnessLabel(text = '') {
  const clean = normalizeText(text).toLowerCase();
  return /^(annonce r[eé]cente|recent listing|listed recently|just listed|neue anzeige|nuovo annuncio|annuncio recente|anuncio reciente)$/.test(clean);
}

function isMarketplaceUtilityLine(text = '') {
  return /message|envoyer|partage|sponsor/i.test(normalizeText(text));
}

function lineMatchesMarketplacePrice(line = '', priceRaw = '') {
  const cleanLine = normalizeText(line);
  const cleanPrice = normalizeText(priceRaw);
  if (cleanPrice && cleanLine === cleanPrice) return true;
  return parseMarketplacePrice(cleanLine) != null;
}

function marketplaceCardLineCandidates(raw = {}, priceRaw = '') {
  return (Array.isArray(raw.lines) ? raw.lines : [])
    .map((line) => normalizeText(line))
    .filter((line) => (
      line
      && !isMarketplaceFreshnessLabel(line)
      && !isMarketplaceUtilityLine(line)
      && !lineMatchesMarketplacePrice(line, priceRaw)
    ));
}

export function normalizeMarketplaceCard(raw = {}, context = {}) {
  const url = toAbsoluteFacebookUrl(raw.url || raw.href || '');
  const sourceId = extractMarketplaceId(url || '');
  const rawLines = (Array.isArray(raw.lines) ? raw.lines : []).map((line) => normalizeText(line)).filter(Boolean);
  const rawTitle = normalizeText(raw.title || '');
  const priceRaw = normalizeText(raw.priceText || raw.price || rawLines.find((line) => parseMarketplacePrice(line) != null) || '');
  const totalChf = parseMarketplacePrice(priceRaw);
  const lineCandidates = marketplaceCardLineCandidates(raw, priceRaw);
  const title = rawTitle && !isMarketplaceFreshnessLabel(rawTitle) && !lineMatchesMarketplacePrice(rawTitle, priceRaw)
    ? rawTitle
    : (lineCandidates[0] || rawTitle);

  if (!sourceId || !url || !title || totalChf == null) return null;

  const lineLocation = lineCandidates.find((line) => line !== title) || '';
  const combinedText = normalizeText([
    title,
    raw.description,
    raw.text,
    raw.locationText,
    raw.address,
    ...rawLines
  ].filter(Boolean).join(' '));
  const rawLocation = normalizeText(raw.address || raw.locationText || '');
  const location = normalizeText(
    (rawLocation && rawLocation !== title && !isMarketplaceFreshnessLabel(rawLocation) ? rawLocation : '')
      || lineLocation
      || context.areaLabel
      || ''
  );
  const address = location || normalizeText(context.areaLabel || '');
  const imageUrls = uniqueStrings(raw.imageUrls || (raw.imageUrl ? [raw.imageUrl] : []));
  const publishedAt = raw.scrapedAt || context.scrapedAt || new Date().toISOString();
  const streetLevel = hasStreetLevelAddress(address);

  return {
    id: `facebook:${sourceId}`,
    sourceId,
    url,
    title,
    objectType: title,
    address,
    area: location || normalizeText(context.areaLabel || ''),
    priceRaw,
    rentChf: totalChf,
    chargesChf: 0,
    totalChf,
    rooms: parseMarketplaceRooms(combinedText),
    surfaceM2: parseMarketplaceSurface(combinedText),
    imageUrl: imageUrls[0] || null,
    imageUrls,
    source: 'Facebook Marketplace',
    listingStage: 'early_market',
    publishedAt,
    dedupDisabled: !streetLevel
  };
}

export function detectFacebookAccessProblem(text = '', url = '') {
  const haystack = `${text || ''} ${url || ''}`.toLowerCase();
  if (/temporarily blocked|you(?:'|’)re temporarily blocked|misusing this feature|trop vite/.test(haystack)) {
    return 'FB_MARKETPLACE_BLOCKED';
  }
  if (/connectez-vous|log in|login|se connecter|create new account|cr[eé]er un compte/.test(haystack)) {
    return 'FB_MARKETPLACE_LOGIN_REQUIRED';
  }
  return null;
}

function rejectReasonsForMarketplaceCard(raw = {}) {
  const url = toAbsoluteFacebookUrl(raw.url || raw.href || '');
  const sourceId = extractMarketplaceId(url || '');
  const title = normalizeText(raw.title || '');
  const priceRaw = normalizeText(raw.priceText || raw.price || '');
  const totalChf = parseMarketplacePrice(priceRaw);
  const reasons = [];

  if (!url) reasons.push('missing url');
  if (!sourceId) reasons.push('missing marketplace item id');
  if (!title) reasons.push('missing title');
  if (totalChf == null) reasons.push('missing price');
  return reasons;
}

export function explainMarketplaceCard(raw = {}, context = {}) {
  const reasons = rejectReasonsForMarketplaceCard(raw);
  const normalized = reasons.length ? null : normalizeMarketplaceCard(raw, context);
  return {
    order: Number(raw.order) || 0,
    accepted: !!normalized,
    rejectReason: reasons.join(', '),
    raw: {
      url: toAbsoluteFacebookUrl(raw.url || raw.href || '') || String(raw.url || raw.href || ''),
      title: normalizeText(raw.title || ''),
      priceText: normalizeText(raw.priceText || raw.price || ''),
      locationText: normalizeText(raw.locationText || raw.address || ''),
      lines: Array.isArray(raw.lines) ? raw.lines.map((line) => normalizeText(line)).filter(Boolean) : [],
      imageCount: Number(raw.imageCount || raw.imageUrls?.length || 0) || 0,
      imageUrls: uniqueStrings(raw.imageUrls || [])
    },
    normalized
  };
}

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDebugNumber(value) {
  return value == null || value === '' ? '' : escapeHtml(value);
}

export function renderMarketplaceDebugHtml(trace = {}) {
  const searches = Array.isArray(trace.searches) ? trace.searches : [];
  const results = trace.results || {};
  const status = trace.status || 'unknown';
  const searchRows = searches.map((search) => `
        <tr>
          <td>${formatDebugNumber(search.index)}</td>
          <td>${escapeHtml(search.query || '')}</td>
          <td>${escapeHtml(search.areaLabel || '')}</td>
          <td><a href="${escapeHtml(search.requestedUrl || '')}">${escapeHtml(search.requestedUrl || '')}</a></td>
          <td><a href="${escapeHtml(search.pageUrl || '')}">${escapeHtml(search.pageUrl || '')}</a></td>
          <td>${escapeHtml(search.status || '')}</td>
          <td>${formatDebugNumber(search.rawCount ?? 0)}</td>
          <td>${formatDebugNumber(search.acceptedCount ?? 0)}</td>
          <td>${formatDebugNumber(search.rejectedCount ?? 0)}</td>
        </tr>`).join('');

  const sections = searches.map((search) => {
    const memberLabels = Array.isArray(search.memberLabels) ? search.memberLabels.join(', ') : '';
    const cardRows = (Array.isArray(search.cards) ? search.cards : []).map((card) => {
      const raw = card.raw || {};
      const normalized = card.normalized || {};
      const lines = Array.isArray(raw.lines) ? raw.lines.join(' | ') : '';
      return `
        <tr class="${card.accepted ? 'accepted' : 'rejected'}">
          <td>#${formatDebugNumber(card.order)}</td>
          <td><span class="pill">${escapeHtml(card.finalAction || (card.accepted ? 'accepted' : 'rejected'))}</span></td>
          <td>${escapeHtml(raw.priceText || '')}</td>
          <td>${formatDebugNumber(normalized.totalChf)}</td>
          <td>${formatDebugNumber(normalized.rooms)}</td>
          <td>${formatDebugNumber(normalized.surfaceM2)}</td>
          <td>${escapeHtml(raw.locationText || normalized.area || '')}</td>
          <td><a href="${escapeHtml(raw.url || normalized.url || '')}">${escapeHtml(raw.title || normalized.title || '')}</a></td>
          <td>${escapeHtml(card.rejectReason || '')}</td>
          <td>${escapeHtml(lines)}</td>
        </tr>`;
    }).join('');
    return `
      <section>
        <h2>${formatDebugNumber(search.index)}. ${escapeHtml(search.query || search.requestedUrl || 'Search')}</h2>
        <div class="meta">
          <div><strong>Status</strong> ${escapeHtml(search.status || '')}</div>
          ${search.regionLabel ? `<div><strong>Region</strong> ${escapeHtml(search.regionLabel)}</div>` : ''}
          ${search.expectedLocationLabel ? `<div><strong>Expected location</strong> ${escapeHtml(search.expectedLocationLabel)}</div>` : ''}
          ${memberLabels ? `<div><strong>Members</strong> ${escapeHtml(memberLabels)}</div>` : ''}
          ${search.radiusKm != null ? `<div><strong>Radius</strong> ${formatDebugNumber(search.radiusKm)} km</div>` : ''}
          ${search.needsResolution != null ? `<div><strong>Needs resolution</strong> ${escapeHtml(search.needsResolution ? 'yes' : 'no')}</div>` : ''}
          <div><strong>Requested</strong> <a href="${escapeHtml(search.requestedUrl || '')}">${escapeHtml(search.requestedUrl || '')}</a></div>
          <div><strong>Resolved</strong> <a href="${escapeHtml(search.pageUrl || '')}">${escapeHtml(search.pageUrl || '')}</a></div>
          ${search.error ? `<div class="error"><strong>Error</strong> ${escapeHtml(search.error)}</div>` : ''}
        </div>
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Action</th>
              <th>Raw price</th>
              <th>Total CHF</th>
              <th>Rooms</th>
              <th>m2</th>
              <th>Location</th>
              <th>Title</th>
              <th>Reject reason</th>
              <th>Raw text lines</th>
            </tr>
          </thead>
          <tbody>${cardRows || '<tr><td colspan="10">No cards captured.</td></tr>'}</tbody>
        </table>
      </section>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Facebook Marketplace Debug</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #1f2933; background: #f7f6f2; }
    h1, h2 { margin: 0 0 12px; }
    section { margin-top: 28px; padding: 18px; background: #fff; border: 1px solid #dedbd2; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; background: #fff; }
    th, td { border-bottom: 1px solid #ebe7dc; padding: 8px; text-align: left; vertical-align: top; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #667085; background: #faf9f5; }
    a { color: #1f5f99; text-decoration: none; }
    .summary { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
    .metric, .pill { display: inline-flex; gap: 6px; align-items: center; border-radius: 999px; padding: 4px 9px; background: #ece8dc; font-size: 12px; }
    .accepted { background: #f3fbf6; }
    .rejected { background: #fff6f4; }
    .error { color: #a33a2c; }
    .meta { display: grid; gap: 6px; margin-bottom: 12px; font-size: 13px; color: #4b5563; }
  </style>
</head>
<body>
  <h1>Facebook Marketplace Debug</h1>
  <p>Status: <strong>${escapeHtml(status)}</strong> · ${escapeHtml(trace.startedAt || '')}${trace.finishedAt ? ` -> ${escapeHtml(trace.finishedAt)}` : ''}</p>
  <div class="summary">
    <span class="metric">Searches ${formatDebugNumber(searches.length)}</span>
    <span class="metric">Raw cards ${formatDebugNumber(results.rawCards ?? 0)}</span>
    <span class="metric">Accepted ${formatDebugNumber(results.acceptedCards ?? 0)}</span>
    <span class="metric">Rejected ${formatDebugNumber(results.rejectedCards ?? 0)}</span>
    <span class="metric">Kept ${formatDebugNumber(results.keptListings ?? 0)}</span>
    <span class="metric">Duplicates ${formatDebugNumber(results.duplicateListings ?? 0)}</span>
  </div>
  <section>
    <h2>Search queries</h2>
    <table>
      <thead><tr><th>#</th><th>Query</th><th>Area</th><th>Requested URL</th><th>Resolved URL</th><th>Status</th><th>Raw</th><th>Accepted</th><th>Rejected</th></tr></thead>
      <tbody>${searchRows || '<tr><td colspan="9">No searches.</td></tr>'}</tbody>
    </table>
  </section>
  ${sections}
</body>
</html>`;
}

function createMarketplaceDebugTrace(config = {}, urls = [], searchPlan = []) {
  const now = new Date().toISOString();
  const searchEntries = searchPlan.length
    ? searchPlan
    : urls.map((url) => ({ url }));
  return {
    version: 1,
    source: 'Facebook Marketplace',
    status: 'running',
    startedAt: now,
    finishedAt: null,
    settings: {
      headless: boolEnv(process.env.FACEBOOK_MARKETPLACE_HEADLESS, marketplaceConfig(config).headless !== false),
      maxScrollsPerSearch: maxScrolls(config),
      maxListingsPerSearch: maxListings(config),
      userDataDir: resolveUserDataDir(config)
    },
    searches: searchEntries.map((entry, index) => {
      const url = entry.url || urls[index] || '';
      return {
        index: index + 1,
        requestedUrl: url,
        pageUrl: '',
        query: entry.query || marketplaceQueryFromUrl(url),
        areaLabel: entry.label || entry.expectedLocationLabel || areaLabelForUrl(config, url),
        regionLabel: entry.label || '',
        expectedLocationLabel: entry.expectedLocationLabel || '',
        memberLabels: Array.isArray(entry.memberLabels) ? entry.memberLabels : [],
        radiusKm: entry.radiusKm ?? null,
        needsResolution: !!entry.needsResolution,
        status: 'queued',
        rawCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        cards: []
      };
    }),
    results: {
      rawCards: 0,
      acceptedCards: 0,
      rejectedCards: 0,
      keptListings: 0,
      duplicateListings: 0
    }
  };
}

async function writeMarketplaceDebugReport(config = {}, trace = null) {
  if (!trace || !marketplaceDebugEnabled(config)) return null;
  const debugDir = resolveDebugDir(config);
  const jsonPath = path.join(debugDir, 'facebook-marketplace-latest.json');
  const htmlPath = path.join(debugDir, 'facebook-marketplace-latest.html');
  await fs.mkdir(debugDir, { recursive: true });
  await fs.writeFile(jsonPath, JSON.stringify(trace, null, 2));
  await fs.writeFile(htmlPath, renderMarketplaceDebugHtml(trace));
  return { jsonPath, htmlPath };
}

async function extractMarketplaceRawCards(page, context = {}) {
  return page.$$eval(
    MARKETPLACE_ITEM_SELECTOR,
    (anchors, args) => {
      function linesFrom(text) {
        return String(text || '')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
      }

      function nearestCard(anchor) {
        let node = anchor;
        for (let depth = 0; depth < 7 && node; depth += 1) {
          const lines = linesFrom(node.innerText || anchor.innerText || '');
          const imageCount = node.querySelectorAll ? node.querySelectorAll('img').length : 0;
          if (lines.length >= 2 && imageCount > 0) return node;
          node = node.parentElement;
        }
        return anchor;
      }

      function firstMatch(lines, pattern) {
        return lines.find((line) => pattern.test(line)) || '';
      }

      return anchors.map((anchor, index) => {
        const card = nearestCard(anchor);
        const lines = linesFrom(card.innerText || anchor.innerText || '');
        const priceText = firstMatch(lines, /(?:CHF\s*)?\d[\d\s'’.]*(?:\s*CHF)?/i);
        const title = lines.find((line) => (
          line !== priceText
          && !/^sponsor/i.test(line)
          && !/^partage/i.test(line)
          && !/^envoyer/i.test(line)
        )) || anchor.getAttribute('aria-label') || '';
        const titleIndex = lines.indexOf(title);
        const priceIndex = lines.indexOf(priceText);
        const locationText = lines.find((line, index) => (
          line !== title
          && line !== priceText
          && index > Math.max(titleIndex, priceIndex)
          && !/message|envoyer|partage|sponsor/i.test(line)
        )) || args.areaLabel || '';
        const imageUrls = [...card.querySelectorAll('img')]
          .map((img) => img.currentSrc || img.src || '')
          .filter(Boolean);

        return {
          order: index + 1,
          url: anchor.href || anchor.getAttribute('href') || '',
          title,
          priceText,
          locationText,
          lines,
          imageCount: imageUrls.length,
          imageUrls,
          scrapedAt: args.scrapedAt
        };
      });
    },
    context
  );
}

async function extractMarketplaceCards(page, context = {}) {
  const rawCards = await extractMarketplaceRawCards(page, context);
  return rawCards
    .map((card) => explainMarketplaceCard(card, context))
    .filter((card) => card.accepted)
    .map((card) => card.normalized);
}

async function scrollMarketplacePage(page, scrolls) {
  for (let i = 0; i < scrolls; i += 1) {
    await page.evaluate(() => window.scrollBy(0, Math.max(document.body.scrollHeight, window.innerHeight)));
    await page.waitForTimeout(1200);
  }
}

function toDebugCard(explanation) {
  return {
    order: explanation.order,
    accepted: explanation.accepted,
    finalAction: explanation.accepted ? 'accepted' : 'rejected',
    rejectReason: explanation.rejectReason,
    raw: explanation.raw,
    normalized: explanation.normalized
  };
}

function areaLabelForUrl(config = {}, url = '') {
  const areas = Array.isArray(config?.areas) ? config.areas : [];
  const normalizedUrl = String(url || '').toLowerCase();
  const area = areas.find((entry) => normalizedUrl.includes(encodeURIComponent(String(entry?.label || '')).toLowerCase()));
  return String(area?.label || '').trim();
}

async function clickFirstMarketplaceLocator(page, locators = [], timeout = 3000) {
  const failures = [];
  for (const locator of locators) {
    try {
      await locator.first().click({ timeout });
      return true;
    } catch (err) {
      failures.push(err?.message || String(err));
    }
  }
  return { ok: false, failures };
}

async function fillFirstMarketplaceLocator(page, locators = [], value = '', timeout = 3000) {
  const failures = [];
  for (const locator of locators) {
    try {
      await locator.first().fill(value, { timeout });
      return true;
    } catch (err) {
      failures.push(err?.message || String(err));
    }
  }
  return { ok: false, failures };
}

async function fillMarketplaceCombobox(locator, value = '', timeout = 3000) {
  await locator.first().click({ timeout });
  await locator.first().press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A', { timeout });
  await locator.first().pressSequentially(String(value || ''), { delay: 65, timeout });
}

async function waitForMarketplaceDialogToClose(page, dialog, label, timeout = 10000) {
  const failures = [];
  try {
    await dialog.waitFor({ state: 'hidden', timeout });
    return true;
  } catch (err) {
    failures.push(err?.message || String(err));
  }

  try {
    await page.waitForFunction(
      (expectedLabel) => {
        const text = document.body?.innerText || '';
        const hasOpenLocationDialog = Array.from(document.querySelectorAll('[role="dialog"]'))
          .some((node) => /changer le lieu|change location|modifier le lieu/i.test(node.textContent || ''));
        return !hasOpenLocationDialog && text.toLowerCase().includes(String(expectedLabel || '').toLowerCase());
      },
      label,
      { timeout }
    );
    return true;
  } catch (err) {
    failures.push(err?.message || String(err));
  }

  return { ok: false, failures };
}

async function pauseMarketplaceInteraction(page, config = {}) {
  await page.waitForTimeout(marketplaceInteractionDelayMs(config));
}

async function waitForMarketplaceActiveFilter(page, label, radiusKm, timeout = 10000) {
  const startedAt = Date.now();
  let latestText = '';
  let latestError = null;

  while (Date.now() - startedAt < timeout) {
    latestText = await page.locator('body').innerText({ timeout: Math.min(timeout, 5000) }).catch(() => '');
    try {
      assertMarketplaceActiveLocation(latestText, label);
      assertMarketplaceActiveRadius(latestText, radiusKm, label);
      return latestText;
    } catch (err) {
      latestError = err;
    }
    await page.waitForTimeout(500);
  }

  if (latestError) {
    const err = sourceError(
      latestError.code || 'FB_MARKETPLACE_LOCATION_MISMATCH',
      `${latestError.message}; visible filter text: ${JSON.stringify(extractMarketplaceVisibleFilterText(latestText).slice(0, 500))}`
    );
    err.cause = latestError;
    throw err;
  }
  throw sourceError(
    'FB_MARKETPLACE_LOCATION_MISMATCH',
    `Expected Facebook Marketplace location "${label}", but no Marketplace filter text was readable`
  );
}

async function resolveMarketplaceRegionInBrowser(page, region, config = {}) {
  const label = normalizeText(
    region?.expectedLocationLabel
      || region?.label
      || region?.centerLabel
      || region?.facebookLocationLabel
      || ''
  );
  if (!label) {
    throw sourceError(
      'FB_MARKETPLACE_LOCATION_REQUIRED',
      'Facebook Marketplace region resolution requires an expected location label'
    );
  }

  const timeout = navigationTimeoutMs(config);
  await page.goto(`${FACEBOOK_BASE_URL}/marketplace/`, { waitUntil: 'domcontentloaded', timeout });

  const beforeText = await page.locator('body').innerText({ timeout: Math.min(timeout, 10000) }).catch((err) => {
    throw sourceError('FB_MARKETPLACE_LOCATION_PICKER_NOT_FOUND', `Could not read Facebook Marketplace page text: ${err.message}`);
  });
  const accessProblem = detectFacebookAccessProblem(beforeText, page.url());
  if (accessProblem) {
    throw sourceError(accessProblem, facebookMarketplaceAccessMessage(accessProblem, page.url()));
  }

  const pickerClick = await clickFirstMarketplaceLocator(page, [
    page.getByRole('button', { name: /lieu|location|emplacement|localisation|rayon|distance|change location|modifier le lieu/i }),
    page.getByText(/Dans un rayon de|Within \d+ kilometres?|Within \d+ kilometers?/i),
    page.locator('[aria-label*="Location" i], [aria-label*="Lieu" i], [aria-label*="Emplacement" i]').first()
  ], Math.min(timeout, 5000));
  if (pickerClick !== true) {
    throw sourceError(
      'FB_MARKETPLACE_LOCATION_PICKER_NOT_FOUND',
      `Could not open Facebook Marketplace location picker for "${label}": ${pickerClick.failures.join(' | ')}`
    );
  }
  await pauseMarketplaceInteraction(page, config);

  const locationDialog = page.getByRole('dialog', { name: /changer le lieu|change location|modifier le lieu|lieu|location/i }).first();
  await locationDialog.waitFor({ state: 'visible', timeout: Math.min(timeout, 5000) }).catch((err) => {
    throw sourceError(
      'FB_MARKETPLACE_LOCATION_PICKER_NOT_FOUND',
      `Facebook Marketplace location dialog did not open for "${label}": ${err.message}`
    );
  });

  const locationInput = locationDialog.getByRole('combobox', { name: /(^lieu$|^location$|emplacement|localisation|ville|city)/i })
    .or(locationDialog.locator('input[role="combobox"][aria-label*="Lieu" i], input[role="combobox"][aria-label*="Location" i], input[aria-label*="Lieu" i], input[aria-label*="Location" i]'))
    .first();
  try {
    await fillMarketplaceCombobox(locationInput, label, Math.min(timeout, 5000));
  } catch (err) {
    throw sourceError(
      'FB_MARKETPLACE_LOCATION_PICKER_NOT_FOUND',
      `Could not fill Facebook Marketplace location picker for "${label}": ${err.message}`
    );
  }

  await pauseMarketplaceInteraction(page, config);
  const locationOptionName = new RegExp(escapeRegExp(label), 'i');
  const locationPick = await clickFirstMarketplaceLocator(page, [
    page.getByRole('option', { name: locationOptionName }),
    page.locator('[role="option"]').filter({ hasText: locationOptionName })
  ], Math.min(timeout, 5000));
  if (locationPick !== true) {
    try {
      await locationInput.press('ArrowDown', { timeout: Math.min(timeout, 2000) });
      await pauseMarketplaceInteraction(page, config);
      await locationInput.press('Enter', { timeout: Math.min(timeout, 2000) });
    } catch (err) {
      throw sourceError(
        'FB_MARKETPLACE_LOCATION_PICKER_NOT_FOUND',
        `Could not select Facebook Marketplace location "${label}": ${locationPick.failures.join(' | ')} | ${err.message}`
      );
    }
  }
  await pauseMarketplaceInteraction(page, config);

  const selectedText = await page.locator('body').innerText({ timeout: Math.min(timeout, 5000) }).catch(() => '');

  const radiusKm = finiteNumber(region?.radiusKm ?? marketplaceConfig(config).radiusKm);
  let radiusControlFailure = null;
  if (radiusKm != null && radiusKm > 0 && !marketplaceTextShowsRadius(selectedText, radiusKm)) {
    const radiusText = String(Math.max(1, Math.round(radiusKm)));
    const radiusControlClick = await clickFirstMarketplaceLocator(page, [
      locationDialog.getByRole('combobox', { name: /rayon|radius|distance/i }),
      locationDialog.getByRole('button', { name: /rayon|radius|distance|kilom/i }),
      locationDialog.locator('[role="combobox"]').filter({ hasText: /rayon|radius|distance|kilom/i })
    ], 2000);
    if (radiusControlClick !== true) {
      radiusControlFailure = `Could not open Facebook Marketplace radius control for "${label}" at ${radiusText} km: ${radiusControlClick.failures.join(' | ')}`;
    } else {
      await pauseMarketplaceInteraction(page, config);
      const radiusOptionName = new RegExp(`\\b${radiusText}\\s*(km|kilom[eè]tres?|kilometres?|kilometers?)\\b`, 'i');
      const radiusFill = await fillFirstMarketplaceLocator(page, [
        page.getByRole('spinbutton', { name: /rayon|radius|distance/i }),
        page.locator('input[aria-label*="Radius" i], input[aria-label*="Rayon" i], input[name*="radius" i]')
      ], radiusText, 2000);
      const radiusOptionClick = await clickFirstMarketplaceLocator(page, [
        page.getByRole('option', { name: radiusOptionName }),
        page.getByRole('menuitemradio', { name: radiusOptionName }),
        page.getByRole('menuitem', { name: radiusOptionName }),
        page.getByRole('button', { name: radiusOptionName }),
        page.locator('[role="option"], [role="menuitemradio"], [role="menuitem"], [role="button"]').filter({ hasText: radiusOptionName })
      ], 2000);
      if (radiusFill !== true && radiusOptionClick !== true) {
        radiusControlFailure = `Could not set Facebook Marketplace radius for "${label}" to ${radiusText} km: ${[
          ...radiusFill.failures,
          ...radiusOptionClick.failures
        ].join(' | ')}`;
      } else {
        await pauseMarketplaceInteraction(page, config);
      }
    }
  }

  const beforeApplyText = await page.locator('body').innerText({ timeout: Math.min(timeout, 5000) }).catch(() => '');
  const alreadyApplied = marketplaceTextMatchesActiveLocation(beforeApplyText, label)
    && (radiusKm == null || radiusKm <= 0 || marketplaceTextShowsRadius(beforeApplyText, radiusKm));
  if (!alreadyApplied) {
    const applyClick = await clickFirstMarketplaceLocator(page, [
      locationDialog.getByRole('button', { name: /appliquer|mettre à jour|mettre a jour|enregistrer|apply|update|save/i }),
      locationDialog.locator('[role="button"]').filter({ hasText: /appliquer|mettre à jour|mettre a jour|enregistrer|apply|update|save/i })
    ], Math.min(timeout, 5000));
    if (applyClick !== true) {
      const fallbackText = await page.locator('body').innerText({ timeout: Math.min(timeout, 5000) }).catch(() => '');
      const fallbackApplied = marketplaceTextMatchesActiveLocation(fallbackText, label)
        && (radiusKm == null || radiusKm <= 0 || marketplaceTextShowsRadius(fallbackText, radiusKm));
      if (!fallbackApplied) {
        throw sourceError(
          'FB_MARKETPLACE_LOCATION_PICKER_NOT_FOUND',
          `Could not apply Facebook Marketplace location "${label}": ${applyClick.failures.join(' | ')}`
        );
      }
    }

    const dialogClosed = await waitForMarketplaceDialogToClose(page, locationDialog, label, Math.min(timeout, 10000));
    if (dialogClosed !== true) {
      throw sourceError(
        'FB_MARKETPLACE_LOCATION_PICKER_NOT_FOUND',
        `Facebook Marketplace location dialog did not close after applying "${label}": ${dialogClosed.failures.join(' | ')}`
      );
    }
  }

  await page.waitForLoadState('domcontentloaded', { timeout }).catch(() => {});
  const afterText = await waitForMarketplaceActiveFilter(page, label, radiusKm, Math.min(timeout, 12000));
  const afterProblem = detectFacebookAccessProblem(afterText, page.url());
  if (afterProblem) {
    throw sourceError(afterProblem, facebookMarketplaceAccessMessage(afterProblem, page.url()));
  }
  if (radiusControlFailure && !marketplaceTextShowsRadius(afterText, radiusKm)) {
    throw sourceError(
      'FB_MARKETPLACE_RADIUS_CONTROL_NOT_FOUND',
      `${radiusControlFailure}; final Marketplace filter summary also did not confirm ${Math.max(1, Math.round(radiusKm))} km`
    );
  }

  let facebookLocation = '';
  try {
    const url = new URL(page.url());
    const match = url.pathname.match(/\/marketplace\/([^/?#]+)/i);
    facebookLocation = normalizeText(decodeURIComponent(match?.[1] || ''));
  } catch (err) {
    throw sourceError('FB_MARKETPLACE_LOCATION_ID_MISSING', `Could not parse Facebook Marketplace URL after selecting "${label}": ${err.message}`);
  }

  if (!facebookLocation || /^(search|category|item|notifications|inbox)$/i.test(facebookLocation)) {
    return {
      facebookLocation: '',
      useGlobalLocation: true,
      expectedLocationLabel: label
    };
  }

  return {
    facebookLocation,
    useGlobalLocation: false,
    expectedLocationLabel: label
  };
}

async function scrapeWithPlaywright(config = {}) {
  const { config: nextConfig, searchPlan } = await prepareMarketplaceSearchConfig(config);
  if (!searchPlan.length) {
    throw sourceError('FB_MARKETPLACE_NO_SEARCH_URLS', 'No Facebook Marketplace search URLs could be built from profile areas or config');
  }
  assertMarketplaceSearchPlanRadiusSupported(searchPlan);
  let debugTrace = marketplaceDebugEnabled(nextConfig) ? createMarketplaceDebugTrace(nextConfig, [], searchPlan) : null;

  const { chromium } = await import('playwright');
  const headless = boolEnv(process.env.FACEBOOK_MARKETPLACE_HEADLESS, marketplaceConfig(nextConfig).headless !== false);
  const context = await chromium.launchPersistentContext(resolveUserDataDir(nextConfig), {
    headless,
    locale: 'fr-CH',
    timezoneId: 'Europe/Zurich'
  });

  try {
    const page = await context.newPage();
    for (let entryIndex = 0; entryIndex < searchPlan.length; entryIndex += 1) {
      const entry = searchPlan[entryIndex];
      if (!entry?.needsResolution) continue;
      const debugSearch = debugTrace?.searches?.[entryIndex] || null;
      if (debugSearch) {
        debugSearch.status = 'pending-global-location';
      }
      searchPlan[entryIndex] = finalizeResolvedMarketplaceRegion(entry, {
        useGlobalLocation: true,
        expectedLocationLabel: entry.expectedLocationLabel || entry.centerLabel || entry.label || ''
      });
      if (debugSearch) {
        debugSearch.requestedUrl = searchPlan[entryIndex].url;
        debugSearch.expectedLocationLabel = searchPlan[entryIndex].expectedLocationLabel || '';
        debugSearch.needsResolution = false;
      }
    }

    const unresolvedEntries = searchPlan.filter((entry) => !entry?.url);
    if (unresolvedEntries.length) {
      const labels = unresolvedEntries
        .map((entry) => entry.label || entry.expectedLocationLabel || entry.centerLabel || entry.key || '')
        .filter(Boolean)
        .join(', ');
      throw sourceError(
        'FB_MARKETPLACE_REGIONS_UNRESOLVED',
        `Facebook Marketplace regions could not be resolved: ${labels || 'unknown regions'}`
      );
    }

    const finalSearchPlan = searchPlan.filter((entry) => entry.url);
    assertMarketplaceSearchPlanRadiusSupported(finalSearchPlan);
    const urls = finalSearchPlan.map((entry) => entry.url);
    if (!urls.length) {
      throw sourceError('FB_MARKETPLACE_NO_SEARCH_URLS', 'No Facebook Marketplace search URLs could be built from profile areas or config');
    }
    if (debugTrace) {
      debugTrace.searches = createMarketplaceDebugTrace(nextConfig, urls, finalSearchPlan).searches;
    }
    const out = new Map();
    const limit = maxListings(nextConfig);
    const timeout = navigationTimeoutMs(nextConfig);

    for (let urlIndex = 0; urlIndex < urls.length; urlIndex += 1) {
      const url = urls[urlIndex];
      const planEntry = finalSearchPlan[urlIndex] || {};
      const debugSearch = debugTrace?.searches?.[urlIndex] || null;
      if (debugSearch) {
        debugSearch.status = 'navigating';
        debugSearch.startedAt = new Date().toISOString();
      }

	      if (urlIndex > 0) {
	        const throttleMs = marketplaceThrottleDelayMs(nextConfig, urlIndex);
	        if (debugSearch) debugSearch.throttleMs = throttleMs;
	        if (throttleMs > 0) await page.waitForTimeout(throttleMs);
	      }
      if (planEntry.useGlobalLocation === true) {
        if (debugSearch) debugSearch.status = 'setting-global-location';
        try {
          const resolved = await resolveMarketplaceRegionInBrowser(page, planEntry, nextConfig);
          finalSearchPlan[urlIndex] = finalizeResolvedMarketplaceRegion(planEntry, resolved);
        } catch (err) {
          if (debugSearch) {
            debugSearch.status = 'error';
            debugSearch.error = `${err?.code || 'FB_MARKETPLACE_REGION_RESOLUTION_FAILED'}: ${err?.message || String(err)}`;
          }
          throw err;
        }
      }
	      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      if (debugSearch) {
        debugSearch.pageUrl = page.url();
        debugSearch.status = 'loaded';
      }
      const initialText = await page.locator('body').innerText({ timeout: Math.min(timeout, 10000) }).catch(() => '');
      const initialProblem = detectFacebookAccessProblem(initialText, page.url());
      if (initialProblem) {
        const message = facebookMarketplaceAccessMessage(initialProblem, page.url());
        if (debugSearch) {
          debugSearch.status = 'error';
          debugSearch.error = `${initialProblem}: ${message}`;
        }
        throw sourceError(initialProblem, message);
      }
      assertMarketplaceActiveLocation(initialText, planEntry.expectedLocationLabel || '');

      try {
        await page.waitForSelector(MARKETPLACE_ITEM_SELECTOR, { timeout });
      } catch {
        const html = await page.content().catch(() => '');
        const problem = detectFacebookAccessProblem(html, page.url());
        if (problem) {
          const message = facebookMarketplaceAccessMessage(problem, page.url());
          if (debugSearch) {
            debugSearch.status = 'error';
            debugSearch.error = `${problem}: ${message}`;
            debugSearch.pageUrl = page.url();
          }
          throw sourceError(problem, message);
        }
        const message = `No Marketplace listing cards found at ${page.url()}`;
        if (debugSearch) {
          debugSearch.status = 'error';
          debugSearch.error = `FB_MARKETPLACE_NO_CARDS: ${message}`;
          debugSearch.pageUrl = page.url();
        }
        throw sourceError('FB_MARKETPLACE_NO_CARDS', message);
      }

      await scrollMarketplacePage(page, maxScrolls(nextConfig));
      const cardContext = {
        areaLabel: planEntry.label || planEntry.expectedLocationLabel || areaLabelForUrl(nextConfig, url),
        scrapedAt: new Date().toISOString()
      };
      const rawCards = await extractMarketplaceRawCards(page, cardContext);
      const explainedCards = rawCards.map((card) => explainMarketplaceCard(card, cardContext));
      const debugCards = explainedCards.map(toDebugCard);

      if (debugSearch) {
        debugSearch.pageUrl = page.url();
        debugSearch.status = 'done';
        debugSearch.finishedAt = new Date().toISOString();
        debugSearch.rawCount = rawCards.length;
        debugSearch.acceptedCount = explainedCards.filter((card) => card.accepted).length;
        debugSearch.rejectedCount = explainedCards.filter((card) => !card.accepted).length;
        debugSearch.cards = debugCards;
        debugTrace.results.rawCards += debugSearch.rawCount;
        debugTrace.results.acceptedCards += debugSearch.acceptedCount;
        debugTrace.results.rejectedCards += debugSearch.rejectedCount;
      }

      for (let cardIndex = 0; cardIndex < explainedCards.length; cardIndex += 1) {
        const explanation = explainedCards[cardIndex];
        if (!explanation.accepted) continue;
        const item = explanation.normalized;
        const duplicate = out.has(item.id);
        if (debugCards[cardIndex]) {
          debugCards[cardIndex].finalAction = duplicate ? 'duplicate' : 'kept';
        }
        if (debugTrace) {
          if (duplicate) debugTrace.results.duplicateListings += 1;
          else debugTrace.results.keptListings += 1;
        }
        if (!duplicate) out.set(item.id, item);
        if (out.size >= limit) break;
      }
      if (out.size >= limit) break;
    }

    if (debugTrace) debugTrace.status = 'done';
    return [...out.values()];
  } catch (err) {
    if (debugTrace) {
      debugTrace.status = 'error';
      debugTrace.error = {
        code: err?.code || null,
        message: err?.message || String(err)
      };
    }
    throw err;
  } finally {
    let report = null;
    try {
      if (debugTrace) {
        debugTrace.finishedAt = new Date().toISOString();
        report = await writeMarketplaceDebugReport(nextConfig, debugTrace);
      }
    } finally {
      await context.close();
    }
    if (report) {
      console.log(`INFO Facebook Marketplace debug report: ${report.htmlPath}`);
    }
  }
}

export async function scrapeFacebookMarketplaceListings(config = {}) {
  const provider = process.env.FACEBOOK_MARKETPLACE_PROVIDER || marketplaceConfig(config).provider || 'playwright';
  if (provider === 'playwright') return scrapeWithPlaywright(config);
  throw new Error(`Only the free Playwright provider is supported for Facebook Marketplace: ${provider}`);
}
