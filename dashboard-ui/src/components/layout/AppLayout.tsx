import { Anchor, Box, Container, Group, Stack, Text, Title } from '@mantine/core';
import { ReactNode } from 'react';
import { dashboardPath, navigate } from '../../app/routes';
import { PageEyebrow } from '../shared/PageEyebrow';

export function AppLayout({
  children,
  profileLabel
}: {
  children: ReactNode;
  profileLabel?: string;
}) {
  return (
    <Box mih="100vh">
      <Container py="lg">
        <Stack>
          <Group justify="space-between" align="flex-end" wrap="wrap" mb="lg">
            <Anchor
              onClick={() => navigate(dashboardPath())}
              component="button"
              style={{ textDecoration: 'none', textAlign: 'left' }}
            >
              <PageEyebrow>Apartment Ops</PageEyebrow>
              <Title order={2}>Recherche appartement</Title>
            </Anchor>
            {profileLabel ? (
              <Group gap="xs">
                <Text size="sm" c="dimmed">
                  Profil actif
                </Text>
                <Text size="sm" fw={700}>
                  {profileLabel}
                </Text>
              </Group>
            ) : null}
          </Group>
          {children}
        </Stack>
      </Container>
    </Box>
  );
}
