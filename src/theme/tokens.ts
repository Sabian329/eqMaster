/** Industrial / studio UI tokens — square, high-contrast, EQ-rack aesthetic. */

export const ui = {
  radius: {
    none: '0',
    sm: '2px',
    md: '3px',
  },
  colors: {
    bg: '#06080c',
    panel: '#0c0f14',
    panelRaised: '#101419',
    inset: '#07090d',
    chart: '#050608',
    border: '#2e3848',
    borderStrong: '#46566c',
    borderFocus: '#52d1b6',
    accent: '#52d1b6',
    accentMuted: '#3a9d88',
    accentGlow: 'rgba(82,209,182,.18)',
    text: '#e8edf4',
    textMuted: '#8b98a8',
    textDim: '#5c6778',
    danger: '#f07178',
    warn: '#e6b450',
  },
  fonts: {
    mono: '"IBM Plex Mono", "SF Mono", ui-monospace, Menlo, Monaco, Consolas, monospace',
    sans: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
  },
} as const;
