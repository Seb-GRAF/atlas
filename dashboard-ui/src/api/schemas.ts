import { z } from 'zod';

export const AreaSchema = z.object({
  slug: z.string(),
  label: z.string(),
  canton: z.string().optional(),
  cantonAbbr: z.string().optional(),
  npa: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lon: z.number().nullable().optional()
});

export const SourcesSchema = z.object({
  immobilier: z.boolean().optional(),
  flatfox: z.boolean().optional(),
  naef: z.boolean().optional(),
  bernardNicod: z.boolean().optional(),
  retraitesListings: z.boolean().optional(),
  retraitesProjets: z.boolean().optional(),
  anibis: z.boolean().optional()
});

export const PearlSchema = z.object({
  enabled: z.boolean().optional(),
  minRooms: z.number().optional(),
  minSurfaceM2: z.number().optional(),
  keywords: z.array(z.string()).optional(),
  minHits: z.number().optional()
});

export const FiltersSchema = z
  .object({
    minTotalChf: z.number().optional(),
    maxTotalChf: z.number().optional(),
    maxTotalHardChf: z.number().optional(),
    maxPearlTotalChf: z.number().optional(),
    minRoomsPreferred: z.number().optional(),
    minSurfaceM2Preferred: z.number().optional(),
    allowMissingSurface: z.boolean().optional(),
    maxPublishedAgeDays: z.number().nullable().optional(),
    pearl: PearlSchema.optional()
  })
  .passthrough();

export const PreferencesSchema = z
  .object({
    workplaceAddress: z.string().nullable().optional()
  })
  .passthrough();

export const ProfileSummarySchema = z.object({
  slug: z.string(),
  name: z.string().optional(),
  shortTitle: z.string().optional(),
  label: z.string().optional(),
  areas: z.string().optional(),
  listingsCount: z.number().nullable().optional(),
  maxRent: z.number().nullable().optional(),
  lastScanAt: z.string().nullable().optional()
});

export const ProfileDetailSchema = z.object({
  slug: z.string(),
  shortTitle: z.string(),
  areas: z.array(AreaSchema),
  sources: SourcesSchema.passthrough(),
  filters: FiltersSchema,
  preferences: PreferencesSchema
});

export const ProfilePayloadSchema = z.object({
  slug: z.string(),
  shortTitle: z.string(),
  areas: z.array(AreaSchema),
  sources: SourcesSchema,
  filters: FiltersSchema,
  preferences: PreferencesSchema
});

export const ListingSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    source: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    objectType: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    area: z.string().nullable().optional(),
    totalChf: z.number().nullable().optional(),
    priceRaw: z.string().nullable().optional(),
    rooms: z.number().nullable().optional(),
    surfaceM2: z.number().nullable().optional(),
    score: z.number().nullable().optional(),
    scoreBreakdown: z.array(z.string()).optional(),
    scoreTooltip: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    pinned: z.boolean().optional(),
    display: z.boolean().optional(),
    isRemoved: z.boolean().optional(),
    listingStage: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    imageUrls: z.array(z.string()).optional(),
    imageUrlsLocal: z.array(z.string()).optional(),
    imageUrlsRemote: z.array(z.string()).optional(),
    publishedAt: z.string().nullable().optional(),
    firstSeenAt: z.string().nullable().optional(),
    lastSeenAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
    removedAt: z.string().nullable().optional()
  })
  .passthrough();

export const TrackerSchema = z
  .object({
    listings: z.array(ListingSchema),
    statuses: z.array(z.string()).optional(),
    updatedAt: z.string().nullable().optional()
  })
  .passthrough();

export const LatestSchema = z
  .object({
    generatedAt: z.string().nullable().optional(),
    newCount: z.number().optional(),
    all: z.array(ListingSchema).optional(),
    matching: z.array(ListingSchema).optional(),
    newListings: z.array(ListingSchema).optional(),
    totalCount: z.number().optional(),
    removedCount: z.number().optional(),
    matchingCount: z.number().optional()
  })
  .passthrough();

export const StateSchema = z.object({
  profile: z.string(),
  tracker: TrackerSchema,
  latest: LatestSchema,
  areas: z.string().optional()
});

export const ProfilesResponseSchema = z.object({
  profiles: z.array(ProfileSummarySchema)
});

export const OkResponseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional()
});

export const ProfileDetailResponseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  profile: ProfileDetailSchema.optional()
});

export const RunScanResponseSchema = z.object({
  ok: z.boolean(),
  summary: z.string().optional(),
  error: z.string().optional()
});

export const TogglePinResponseSchema = z.object({
  ok: z.boolean(),
  pinned: z.boolean().optional(),
  error: z.string().optional()
});

export const RunScanAllResponseSchema = z.object({
  ok: z.boolean(),
  jobId: z.string().optional(),
  total: z.number().optional(),
  error: z.string().optional()
});

export const ScanAllJobSchema = z.object({
  ok: z.boolean(),
  status: z.enum(['running', 'done']).optional(),
  total: z.number().optional(),
  done: z.number().optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  results: z
    .array(
      z.object({
        slug: z.string(),
        ok: z.boolean(),
        summary: z.string().optional(),
        error: z.string().optional()
      })
    )
    .optional(),
  error: z.string().optional()
});

export type Area = z.infer<typeof AreaSchema>;
export type ProfileSummary = z.infer<typeof ProfileSummarySchema>;
export type ProfileDetail = z.infer<typeof ProfileDetailSchema>;
export type ProfilePayload = z.infer<typeof ProfilePayloadSchema>;
export type Listing = z.infer<typeof ListingSchema>;
export type Tracker = z.infer<typeof TrackerSchema>;
export type Latest = z.infer<typeof LatestSchema>;
export type DashboardState = z.infer<typeof StateSchema>;
export type ScanAllJob = z.infer<typeof ScanAllJobSchema>;
