import { Popover, Progress, Stack, Text, UnstyledButton } from '@mantine/core';
import { Listing } from '../../api/schemas';
import { scoreLines, scorePercent } from '../../utils/listings';

export function ScoreBadge({ item }: { item: Listing }) {
  const lines = scoreLines(item);
  const score = item.score ?? '-';

  return (
    <Popover width={280} shadow="md" position="top" withArrow>
      <Popover.Target>
        <UnstyledButton miw={72} ta="left" aria-label={`Détails du score ${score}`}>
          <Text size="sm" fw={750} lh={1}>
            {score}
          </Text>
          <Progress value={scorePercent(item)} color="lake" size={5} radius="xl" mt={5} />
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown>
        <Text size="sm" fw={700} mb={6}>
          Score {score}
        </Text>
        {lines.length ? (
          <Stack gap={4}>
            {lines.map((line) => (
              <Text key={line} size="xs" c="dimmed">
                {line}
              </Text>
            ))}
          </Stack>
        ) : (
          <Text size="xs" c="dimmed">
            Pas de détail disponible
          </Text>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
