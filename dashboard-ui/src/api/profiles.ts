import { z } from 'zod';
import { apiRequest } from './client';
import {
  OkResponseSchema,
  ProfileDetailResponseSchema,
  ProfilePayload,
  ProfilesResponseSchema,
  RunScanAllResponseSchema,
  ScanAllJobSchema
} from './schemas';

function requireOk<T extends { ok: boolean; error?: string }>(payload: T, fallback: string): T {
  if (!payload.ok) throw new Error(payload.error || fallback);
  return payload;
}

export async function listProfiles() {
  return apiRequest('/api/profiles', ProfilesResponseSchema).then((data) => data.profiles);
}

export async function getProfileDetail(profile?: string) {
  const data = await apiRequest(
    profile ? `/api/profile/detail?profile=${encodeURIComponent(profile)}` : '/api/profile/detail',
    ProfileDetailResponseSchema
  );
  requireOk(data, 'Profil introuvable');
  if (!data.profile) throw new Error('Réponse API invalide: profil manquant');
  return data.profile;
}

export async function createProfile(payload: ProfilePayload) {
  const data = await apiRequest('/api/profile/create', OkResponseSchema.extend({ slug: z.string().optional() }), {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return requireOk(data, 'Impossible de créer le profil');
}

export async function updateProfile(payload: ProfilePayload) {
  const data = await apiRequest('/api/profile/update', OkResponseSchema.extend({ slug: z.string().optional() }), {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return requireOk(data, 'Impossible de modifier le profil');
}

export async function deleteProfile(slug: string) {
  const data = await apiRequest('/api/profile/delete', OkResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ slug })
  });
  return requireOk(data, 'Impossible de supprimer le profil');
}

export async function runScanAll() {
  const data = await apiRequest('/api/run-scan-all', RunScanAllResponseSchema, { method: 'POST' });
  requireOk(data, 'Impossible de lancer le scan global');
  if (!data.jobId) throw new Error('Réponse API invalide: jobId manquant');
  return data;
}

export async function getScanAllStatus(jobId: string) {
  const data = await apiRequest(`/api/scan-all-status?jobId=${encodeURIComponent(jobId)}`, ScanAllJobSchema);
  return requireOk(data, 'Impossible de lire le statut du scan');
}
