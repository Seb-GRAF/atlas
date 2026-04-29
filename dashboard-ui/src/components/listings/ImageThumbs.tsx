import { Box, Group, Image, Text, UnstyledButton } from '@mantine/core';
import { Listing } from '../../api/schemas';
import { getImageUrls, listingTitle } from '../../utils/listings';

export function ImageThumbs({
  item,
  onOpen
}: {
  item: Listing;
  onOpen: (urls: string[], index: number) => void;
}) {
  const urls = getImageUrls(item);
  if (!urls.length)
    return (
      <Box
        w={82}
        h={62}
        bg="slate.1"
        bd="1px solid slate.2"
        style={{ borderRadius: 'var(--mantine-radius-sm)' }}
        aria-label="Aucune image"
      />
    );

  return (
    <div>
      <UnstyledButton onClick={() => onOpen(urls, 0)}>
        <Image
          src={urls[0]}
          alt={`Aperçu ${listingTitle(item)}`}
          w={82}
          h={62}
          fit="cover"
          bd="1px solid slate.2"
          bg="slate.0"
          radius="sm"
          loading="lazy"
        />
      </UnstyledButton>
      {urls.length > 1 ? (
        <Group gap={4} mt={4} wrap="nowrap">
          {urls.slice(1, 4).map((src, index) => (
            <UnstyledButton key={`${src}-${index}`} onClick={() => onOpen(urls, index + 1)}>
              <Image
                src={src}
                alt="miniature"
                w={24}
                h={20}
                fit="cover"
                bd="1px solid slate.2"
                radius="xs"
                loading="lazy"
              />
            </UnstyledButton>
          ))}
          {urls.length > 4 ? (
            <UnstyledButton onClick={() => onOpen(urls, 4)}>
              <Text size="xs" c="dimmed">
                +{urls.length - 4}
              </Text>
            </UnstyledButton>
          ) : null}
        </Group>
      ) : null}
    </div>
  );
}
