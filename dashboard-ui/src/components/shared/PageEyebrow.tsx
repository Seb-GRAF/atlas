import { Text, TextProps } from '@mantine/core';
import { ReactNode } from 'react';

export function PageEyebrow({ children, ...rest }: { children: ReactNode } & TextProps) {
  return (
    <Text
      tt="uppercase"
      fz="xs"
      fw={800}
      c="lake.7"
      lts="0.08em"
      mb={4}
      {...rest}
    >
      {children}
    </Text>
  );
}
