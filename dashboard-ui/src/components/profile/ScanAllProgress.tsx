import { Card, Group, Progress, Text } from '@mantine/core';
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
              <Text key={profile.slug} size="xs" px={8} py={3} bg={result.ok ? 'alpine.0' : 'swiss.0'} c={result.ok ? 'alpine.8' : 'swiss.8'} bd="1px solid slate.2" style={{ borderRadius: 999 }}>
                {profile.shortTitle || profile.slug} {result.ok ? '✓' : '✗'}
              </Text>
            );
          }
          const isRunning = job.status !== 'done' && !doneSlugs.has(profile.slug) && !runningShown;
          if (isRunning) runningShown = true;
          return (
            <Text key={profile.slug} size="xs" px={8} py={3} c={isRunning ? 'amber.8' : 'dimmed'} bg={isRunning ? 'amber.0' : 'transparent'} bd="1px solid slate.2" style={{ borderRadius: 999 }}>
              {profile.shortTitle || profile.slug}
              {isRunning ? ' ...' : ''}
            </Text>
          );
        })}
      </Group>
    </Card>
  );
}
