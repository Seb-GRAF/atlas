import { ActionIcon, Group, Image, Modal, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

export type LightboxState = { urls: string[]; index: number } | null;

export function Lightbox({ state, onClose }: { state: LightboxState; onClose: () => void }) {
  const [index, setIndex] = useState(state?.index || 0);

  useEffect(() => {
    setIndex(state?.index || 0);
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setIndex((current) => (current - 1 + state.urls.length) % state.urls.length);
      if (event.key === 'ArrowRight') setIndex((current) => (current + 1) % state.urls.length);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [state]);

  if (!state || !state.urls.length) return null;

  const current = ((index % state.urls.length) + state.urls.length) % state.urls.length;

  return (
    <Modal
      opened={!!state}
      onClose={onClose}
      size="100%"
      padding="md"
      withCloseButton={false}
      fullScreen
      overlayProps={{ backgroundOpacity: 0.92, color: '#000' }}
    >
      <Stack gap="sm" align="center" h="100%" justify="space-between">
        <ActionIcon
          variant="filled"
          color="dark"
          size="lg"
          radius="xl"
          aria-label="Fermer"
          onClick={onClose}
          style={{ position: 'absolute', top: 18, right: 18, zIndex: 10 }}
        >
          <IconX size={20} />
        </ActionIcon>
        {state.urls.length > 1 ? (
          <>
            <ActionIcon
              variant="filled"
              color="dark"
              size="xl"
              radius="xl"
              aria-label="Précédent"
              onClick={(event) => {
                event.stopPropagation();
                setIndex(current - 1);
              }}
              style={{ position: 'absolute', left: 18, top: '48%', zIndex: 10 }}
            >
              <IconChevronLeft size={24} />
            </ActionIcon>
            <ActionIcon
              variant="filled"
              color="dark"
              size="xl"
              radius="xl"
              aria-label="Suivant"
              onClick={(event) => {
                event.stopPropagation();
                setIndex(current + 1);
              }}
              style={{ position: 'absolute', right: 18, top: '48%', zIndex: 10 }}
            >
              <IconChevronRight size={24} />
            </ActionIcon>
          </>
        ) : null}
        <Image
          src={state.urls[current]}
          fit="contain"
          mah="78vh"
          maw="92vw"
          alt="Photo annonce"
        />
        <Text c="white" size="sm">
          {current + 1} / {state.urls.length}
        </Text>
        {state.urls.length > 1 ? (
          <Group gap={6} wrap="nowrap" style={{ overflowX: 'auto', maxWidth: '92vw' }}>
            {state.urls.map((url, itemIndex) => (
              <UnstyledButton key={`${url}-${itemIndex}`} onClick={() => setIndex(itemIndex)}>
                <Image
                  src={url}
                  alt={`Photo ${itemIndex + 1}`}
                  w={58}
                  h={42}
                  fit="cover"
                  radius="xs"
                  style={{
                    outline: itemIndex === current ? '2px solid var(--mantine-color-white)' : '2px solid transparent',
                    outlineOffset: -2,
                    transition: 'outline-color 140ms ease'
                  }}
                />
              </UnstyledButton>
            ))}
          </Group>
        ) : null}
      </Stack>
    </Modal>
  );
}
