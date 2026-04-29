import { Badge, Card, Group, Progress, Text } from '@mantine/core';
import { ProfileSummary, ScanAllJob } from '../../api/schemas';

export function ScanAllProgress({ job, profiles }: { job: ScanAllJob; profiles: ProfileSummary[] }) {
  const total = job.total || 0;
  const done = job.done || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const results = job.results || [];
  const doneSlugs = new Set(results.map((result) => result.slug));
  let runningShown = false;

  return (
    <Card>
      <Group justify="space-between" mb="xs">
        <Text fw={700}>{job.status === 'done' ? 'Scan terminé' : `Scan en cours... ${done}/${total}`}</Text>
        <Text size="sm" c="dimmed">{pct}%</Text>
      </Group>
      <Progress value={pct} color={job.status === 'done' ? 'alpine' : 'lake'} mb="sm" />
      <Group gap={6}>
        {profiles.map((profile) => {
          const result = results.find((item) => item.slug === profile.slug);
          if (result) {
            return (
              <Badge key={profile.slug} color={result.ok ? 'alpine' : 'swiss'} variant="light">
                {profile.shortTitle || profile.slug} {result.ok ? '✓' : '✗'}
              </Badge>
            );
          }
          const isRunning = job.status !== 'done' && !doneSlugs.has(profile.slug) && !runningShown;
          if (isRunning) runningShown = true;
          return (
            <Badge key={profile.slug} color={isRunning ? 'amber' : 'slate'} variant={isRunning ? 'light' : 'outline'}>
              {profile.shortTitle || profile.slug}
              {isRunning ? ' ...' : ''}
            </Badge>
          );
        })}
      </Group>
    </Card>
  );
}
