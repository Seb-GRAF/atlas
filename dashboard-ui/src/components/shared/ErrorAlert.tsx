import { Alert } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

export function ErrorAlert({ error, title = 'Erreur' }: { error: unknown; title?: string }) {
  const message = error instanceof Error ? error.message : String(error || 'Erreur inconnue');
  return (
    <Alert color="swiss" variant="light" icon={<IconAlertTriangle size={18} />} title={title}>
      {message}
    </Alert>
  );
}
