import { z } from 'zod';

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

function describeZodError(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join('.') || 'response'}: ${issue.message}`).join('; ');
}

export async function apiRequest<T>(
  pathname: string,
  schema: z.ZodSchema<T>,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(pathname, {
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers
    }
  });

  const raw = await res.text();
  let payload: unknown;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch (err) {
    const detail = raw.trim() ? `: ${raw.slice(0, 160)}` : '';
    throw new ApiError(`Réponse API illisible (${res.status})${detail}`, res.status);
  }

  if (payload === null) {
    throw new ApiError(`Réponse API vide (${res.status}). Vérifiez que le serveur API tourne sur le port 8787.`, res.status);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(`Réponse API invalide: ${describeZodError(parsed.error)}`, res.status, payload);
  }

  if (!res.ok) {
    const maybeError =
      payload && typeof payload === 'object' && 'error' in payload ? String(payload.error || 'Erreur API') : 'Erreur API';
    throw new ApiError(maybeError, res.status, payload);
  }

  return parsed.data;
}

export function withProfile(pathname: string, profile?: string) {
  if (!profile) return pathname;
  const sep = pathname.includes('?') ? '&' : '?';
  return `${pathname}${sep}profile=${encodeURIComponent(profile)}`;
}
