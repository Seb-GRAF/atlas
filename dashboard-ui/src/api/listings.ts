import { apiRequest, withProfile } from './client';
import {
  DashboardState,
  OkResponseSchema,
  RunScanResponseSchema,
  StateSchema,
  TogglePinResponseSchema
} from './schemas';

function requireOk<T extends { ok: boolean; error?: string }>(payload: T, fallback: string): T {
  if (!payload.ok) throw new Error(payload.error || fallback);
  return payload;
}

export async function getDashboardState(profile?: string): Promise<DashboardState> {
  return apiRequest(withProfile('/api/state', profile), StateSchema);
}

export async function updateListingStatus(profile: string, id: string | number, status: string, notes: string) {
  const data = await apiRequest(withProfile('/api/update-status', profile), OkResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ id, status, notes })
  });
  return requireOk(data, 'Impossible de mettre à jour le statut');
}

export async function toggleListingPin(profile: string, id: string | number) {
  const data = await apiRequest(withProfile('/api/toggle-pin', profile), TogglePinResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ id })
  });
  requireOk(data, 'Impossible de modifier l’épingle');
  if (typeof data.pinned !== 'boolean') throw new Error('Réponse API invalide: pinned manquant');
  return data.pinned;
}

export async function deleteListing(profile: string, id: string | number) {
  const data = await apiRequest(withProfile('/api/delete-listing', profile), OkResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ id })
  });
  return requireOk(data, 'Impossible de supprimer l’annonce');
}

export async function runProfileScan(profile?: string) {
  const data = await apiRequest(withProfile('/api/run-scan', profile), RunScanResponseSchema, { method: 'POST' });
  requireOk(data, 'Impossible de lancer le scan');
  return data.summary || '';
}
