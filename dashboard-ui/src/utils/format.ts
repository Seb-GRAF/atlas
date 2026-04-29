export function money(value: number | null | undefined) {
  if (value == null) return 'n/a';
  return `CHF ${new Intl.NumberFormat('fr-CH').format(value)}`;
}

export function shortWhen(iso: string | null | undefined) {
  if (!iso) return 'n/a';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'n/a';
  return date.toLocaleString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function fullWhen(iso: string | null | undefined) {
  if (!iso) return 'Jamais';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'Jamais';
  return date.toLocaleString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function buildSlug(label: string) {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-+$/g, '');
}
