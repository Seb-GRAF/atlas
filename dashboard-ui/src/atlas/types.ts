import type { Area } from '../api/schemas';

export type AtlasListingStatus =
  | 'À trier'
  | 'À contacter'
  | 'Visite prévue'
  | 'Dossier à envoyer'
  | 'Dossier envoyé'
  | 'Refus régie'
  | 'Écartée';

export type AtlasListingSource =
  | 'immobilier.ch'
  | 'flatfox.ch'
  | 'naef.ch'
  | 'bernard-nicod'
  | 'Retraites Populaires'
  | 'anibis.ch';

export type CommuteRouteStatus =
  | 'ok'
  | 'missing-address'
  | 'geocode-failed'
  | 'route-failed'
  | 'cached-stale'
  | string;

export type CommuteLeg = {
  type: 'walk' | 'transit';
  mode: string;
  line: string;
  label: string;
  direction: string;
  from: string;
  to: string;
  departureAt: string | null;
  arrivalAt: string | null;
  minutes: number | null;
  // [lng, lat] tuples. Transit legs carry the journey's passList; walk legs
  // carry just the endpoints. Optional for backward compatibility with
  // tracker.json files written before this field existed.
  coords?: [number, number][];
};

export type TransitRoute = {
  date: string;
  arrivalTime: string;
  departureAt: string | null;
  arrivalAt: string | null;
  products: string[];
  legs: CommuteLeg[];
};

export type RouteOverlayLeg = {
  kind: 'walk' | 'transit';
  mode: string;
  label: string;
  color: string;
  coords: [number, number][];
  failed: boolean;
  fromName: string;
  toName: string;
  minutes: number | null;
};

export type RouteOverlay = {
  listingId: string;
  legs: RouteOverlayLeg[];
  bounds: [[number, number], [number, number]];
  failedCount: number;
};

export type AtlasListing = {
  id: string;
  title: string;
  area: string;
  address: string;

  rooms: number | null;
  surfaceM2: number | null;
  totalChf: number | null;

  source: AtlasListingSource | string; // string fallback for unknown sources
  url: string | null;
  pinned: boolean;
  isNew: boolean;
  isRemoved: boolean;
  status: AtlasListingStatus;
  notes: string;

  publishedLabel: string;
  publishedShort: string;
  publishedTs: number | null;
  transitText: string | null;
  driveText: string | null;
  distanceText: string | null;
  driveMinutes: number | null;
  transitMinutes: number | null;
  driveRouteStatus: CommuteRouteStatus | null;
  transitRouteStatus: CommuteRouteStatus | null;
  transitRouteLabel: string | null;
  transitRouteComputedAt: string | null;
  transitRoute: TransitRoute | null;
  transitRouteOverlay: RouteOverlay | null;
  commuteWarnings: string[];

  lat: number | null;
  lon: number | null;
  locationPrecision: 'address' | 'area' | null;

  images: string[];
};

export type AtlasProfile = {
  slug: string;
  shortTitle: string;
  areas: Area[];
  zones: string[];
  workplace: string | null;
  workplaceCoords: { lat: number; lon: number } | null;
  newCount: number;
  generatedAt: string;
  budgetMinChf: number | null;
  budgetMaxChf: number | null;
  budgetCeilingChf: number | null;
  roomsMin: number | null;
  roomsMax: number | null;
  enabledSources: Partial<Record<AtlasListingSource, boolean>>;
};

export type AtlasStageValue = 'triage' | 'active' | 'visits' | 'files' | 'done';

export type AtlasStage = {
  value: AtlasStageValue;
  label: string;
  count: number;
};
