import { Alert, Box } from '@chakra-ui/react';
import { alertStyles, deviceStatusToAlert, type AlertStatus } from '../../theme/alerts';
import type { DeviceStatusType } from '../../types';

interface StatusAlertProps {
  status: AlertStatus;
  title?: string;
  description?: string;
  size?: 'sm' | 'md';
}

export function StatusAlert({
  status,
  title,
  description,
  size = 'md',
}: StatusAlertProps) {
  const styles = alertStyles[status];

  return (
    <Alert.Root
      status={status}
      borderRadius="xl"
      size={size}
      alignItems="flex-start"
      gap={3}
      p={size === 'sm' ? 3 : 4}
      {...styles.root}
    >
      <Alert.Indicator {...styles.indicator} mt={0.5} />
      <Box flex="1">
        {title && (
          <Alert.Title
            fontSize="sm"
            fontWeight="semibold"
            mb={description ? 1 : 0}
            lineHeight="1.5"
            {...styles.title}
          >
            {title}
          </Alert.Title>
        )}
        {description && (
          <Alert.Description fontSize="sm" lineHeight="1.6" {...styles.description}>
            {description}
          </Alert.Description>
        )}
      </Box>
    </Alert.Root>
  );
}

interface DeviceStatusAlertProps {
  message: string;
  type: DeviceStatusType;
}

export function DeviceStatusAlert({ message, type }: DeviceStatusAlertProps) {
  const styles = alertStyles[deviceStatusToAlert(type)];

  return (
    <Alert.Root
      status={deviceStatusToAlert(type)}
      borderRadius="xl"
      size="sm"
      alignItems="flex-start"
      gap={3}
      p={3}
      {...styles.root}
    >
      <Alert.Indicator {...styles.indicator} mt={0.5} />
      <Alert.Title fontSize="sm" lineHeight="1.55" fontWeight="medium" {...styles.title}>
        {message}
      </Alert.Title>
    </Alert.Root>
  );
}
