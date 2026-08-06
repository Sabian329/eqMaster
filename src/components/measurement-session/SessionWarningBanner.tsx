import { Box, Button, Flex, Text } from '@chakra-ui/react';
import { modalStyles } from '../../theme';

interface SessionWarningBannerProps {
  message: string;
  onDismiss: () => void;
}

export function SessionWarningBanner({ message, onDismiss }: SessionWarningBannerProps) {
  return (
    <Box {...modalStyles.warning} role="alert">
      <Flex align="flex-start" justify="space-between" gap={3}>
        <Box flex="1" minW={0}>
          <Text {...modalStyles.warningLabel}>Measurement warning</Text>
          <Text {...modalStyles.warningMessage}>{message}</Text>
        </Box>
        <Button
          {...modalStyles.warningDismiss}
          onClick={onDismiss}
          aria-label="Dismiss warning"
        >
          Dismiss
        </Button>
      </Flex>
    </Box>
  );
}
