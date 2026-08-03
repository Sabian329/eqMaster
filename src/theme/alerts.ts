export type AlertStatus = 'warning' | 'success' | 'error' | 'info';

export const alertStyles: Record<
  AlertStatus,
  {
    root: Record<string, string | number>;
    title: Record<string, string>;
    description: Record<string, string>;
    indicator: Record<string, string>;
  }
> = {
  warning: {
    root: {
      bg: 'rgba(255, 191, 90, 0.12)',
      borderColor: 'rgba(255, 191, 90, 0.38)',
      borderWidth: '1px',
    },
    title: { color: '#fff0c9' },
    description: { color: '#ffe0a4' },
    indicator: { color: '#ffbf5a' },
  },
  success: {
    root: {
      bg: 'rgba(85, 214, 139, 0.1)',
      borderColor: 'rgba(85, 214, 139, 0.35)',
      borderWidth: '1px',
    },
    title: { color: '#baf3d2' },
    description: { color: '#9debbd' },
    indicator: { color: '#55d68b' },
  },
  error: {
    root: {
      bg: 'rgba(255, 114, 114, 0.12)',
      borderColor: 'rgba(255, 114, 114, 0.38)',
      borderWidth: '1px',
    },
    title: { color: '#ffc1c1' },
    description: { color: '#ffb0b0' },
    indicator: { color: '#ff7272' },
  },
  info: {
    root: {
      bg: 'rgba(101, 169, 255, 0.1)',
      borderColor: 'rgba(101, 169, 255, 0.32)',
      borderWidth: '1px',
    },
    title: { color: '#d4e8ff' },
    description: { color: '#b8d9ff' },
    indicator: { color: '#65a9ff' },
  },
};

export function deviceStatusToAlert(
  type: '' | 'good' | 'warning' | 'bad',
): AlertStatus {
  if (type === 'good') return 'success';
  if (type === 'bad') return 'error';
  if (type === 'warning') return 'warning';
  return 'info';
}
