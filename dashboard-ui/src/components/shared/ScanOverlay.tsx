import { Box, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { useEffect } from 'react';

export function ScanOverlay({
  open,
  title,
  subtitle,
  detail,
  progress,
  onCancel,
  cancelling = false
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  detail?: string;
  progress?: number | null;
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const hasProgress = typeof progress === 'number' && Number.isFinite(progress);
  const pct = hasProgress ? Math.max(0, Math.min(100, Math.round(progress))) : null;

  return (
    <Box className="scan-overlay-backdrop" role="status" aria-live="polite" aria-label={title}>
      <Paper className="scan-overlay-panel" p="lg" radius="md" shadow="xl" withBorder>
        <Stack gap="md">
          <Group gap="md" wrap="nowrap" align="center">
            <Stack gap={3} miw={0}>
              <Text fw={850} size="lg">
                {title}
              </Text>
              {subtitle ? (
                <Text size="sm" c="dimmed">
                  {subtitle}
                </Text>
              ) : null}
            </Stack>
          </Group>

          <Box
            className={`scan-overlay-track${hasProgress ? '' : ' is-indeterminate'}`}
            aria-hidden="true"
          >
            <Box
              className="scan-overlay-bar"
              style={hasProgress ? { transform: `scaleX(${pct! / 100})` } : undefined}
            />
          </Box>

          <Group justify="space-between" gap="sm">
            <Text size="xs" fw={800} c="dimmed" tt="uppercase">
              {detail || 'Analyse des annonces'}
            </Text>
            <Text size="xs" fw={850} ff="var(--mantine-font-family-monospace)">
              {hasProgress ? `${pct}%` : '...'}
            </Text>
          </Group>

          {onCancel ? (
            <Group justify="flex-end">
              <Button size="xs" variant="subtle" color="swiss" onClick={onCancel} loading={cancelling} disabled={cancelling}>
                {cancelling ? 'Annulation…' : 'Annuler le scan'}
              </Button>
            </Group>
          ) : null}
        </Stack>
      </Paper>
    </Box>
  );
}
