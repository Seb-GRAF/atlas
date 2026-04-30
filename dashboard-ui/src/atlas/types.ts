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
  transitText: string | null;
  driveText: string | null;
  distanceText: string | null;

  lat: number | null;
  lon: number | null;

  images: string[];
};

export type AtlasProfile = {
  slug: string;
  shortTitle: string;
  zones: string[];
  workplace: string | null;
  workplaceCoords: { lat: number; lon: number } | null;
  newCount: number;
  generatedAt: string;
  budgetMaxChf: number | null;
  budgetCeilingChf: number | null;
  enabledSources: Partial<Record<AtlasListingSource, boolean>>;
};

export type AtlasStageValue = 'triage' | 'active' | 'visits' | 'files' | 'done';

export type AtlasStage = {
  value: AtlasStageValue;
  label: string;
  count: number;
};
