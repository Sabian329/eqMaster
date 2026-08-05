import type { ReactNode } from 'react';
import { Box, Stack, Text } from '@chakra-ui/react';
import { setupSectionStyles } from '../../theme';

export interface SetupSectionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function SetupSection({ title, subtitle, children }: SetupSectionProps) {
  return (
    <Box {...setupSectionStyles.root}>
      <Box {...setupSectionStyles.header}>
        <Stack gap={0.5}>
          <Text {...setupSectionStyles.title}>{title}</Text>
          {subtitle ? <Text {...setupSectionStyles.subtitle}>{subtitle}</Text> : null}
        </Stack>
      </Box>
      <Box {...setupSectionStyles.body}>{children}</Box>
    </Box>
  );
}
