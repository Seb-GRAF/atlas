import { Badge } from '@mantine/core';

const STATUS_COLORS: Record<string, string> = {
  'À contacter': 'lake',
  Visite: 'lake',
  Dossier: 'alpine',
  Relance: 'amber',
  Accepté: 'alpine',
  Refusé: 'swiss',
  'Sans réponse': 'slate',
  Retirées: 'slate',
  Retirée: 'slate'
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge color={STATUS_COLORS[status] || 'slate'} variant="light">
      {status}
    </Badge>
  );
}

export function StateBadges({ isNew, stage, removed }: { isNew: boolean; stage?: string | null; removed?: boolean }) {
  return (
    <>
      {isNew ? <Badge color="alpine">Nouveau</Badge> : null}
      {stage === 'off_market' ? <Badge color="amber">Off-market</Badge> : null}
      {stage === 'early_market' ? <Badge color="lake">Direct régie</Badge> : null}
      {removed ? <Badge color="slate">Retirée</Badge> : null}
    </>
  );
}
