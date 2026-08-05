import { ui } from './tokens';

/** Shared Chakra style props — square, high-contrast studio UI. */

export const buttonStyles = {
  secondary: {
    variant: 'outline' as const,
    borderWidth: '1px',
    borderColor: ui.colors.borderStrong,
    color: ui.colors.text,
    bg: ui.colors.inset,
    fontWeight: '600',
    fontSize: 'xs',
    letterSpacing: '0.02em',
    _hover: {
      bg: ui.colors.panelRaised,
      borderColor: ui.colors.borderFocus,
      color: 'white',
    },
    _disabled: {
      opacity: 0.4,
      cursor: 'not-allowed',
    },
  },
  primary: {
    variant: 'solid' as const,
    bg: ui.colors.accent,
    color: '#041210',
    fontWeight: '700',
    fontSize: 'xs',
    letterSpacing: '0.03em',
    borderWidth: '1px',
    borderColor: ui.colors.accentMuted,
    _hover: {
      bg: '#6ee7c5',
      color: '#041210',
    },
    _disabled: {
      opacity: 0.4,
      cursor: 'not-allowed',
      bg: ui.colors.accent,
      color: '#041210',
    },
  },
  danger: {
    variant: 'outline' as const,
    borderColor: ui.colors.danger,
    color: '#ffc8cb',
    bg: 'rgba(240,113,120,.08)',
    fontWeight: '600',
    _hover: {
      bg: 'rgba(240,113,120,.16)',
      borderColor: '#ff8a90',
      color: 'white',
    },
  },
} as const;

export const badgeStyles = {
  info: {
    bg: ui.colors.inset,
    color: ui.colors.accent,
    borderWidth: '1px',
    borderColor: ui.colors.borderStrong,
    borderRadius: ui.radius.sm,
    px: 2,
    py: 0.5,
    fontSize: '2xs',
    fontWeight: '700',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  },
  statusGood: {
    bg: 'rgba(82,209,182,.1)',
    color: ui.colors.accent,
    borderWidth: '1px',
    borderColor: ui.colors.accentMuted,
    px: 2.5,
    py: 1,
    borderRadius: ui.radius.sm,
    fontSize: '2xs',
    fontWeight: '600',
    letterSpacing: '0.04em',
  },
  statusBad: {
    bg: 'rgba(240,113,120,.1)',
    color: '#ffc8cb',
    borderWidth: '1px',
    borderColor: ui.colors.danger,
    px: 2.5,
    py: 1,
    borderRadius: ui.radius.sm,
    fontSize: '2xs',
    fontWeight: '600',
  },
} as const;

export const tabStyles = {
  list: {
    bg: ui.colors.inset,
    borderRadius: ui.radius.sm,
    p: '3px',
    borderWidth: '1px',
    borderColor: ui.colors.border,
    gap: 0,
  },
  trigger: {
    borderRadius: ui.radius.sm,
    py: 2,
    px: 4,
    fontWeight: '600',
    fontSize: 'xs',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    color: ui.colors.textMuted,
    transition: 'background .12s, color .12s',
    _selected: {
      bg: ui.colors.accent,
      color: '#041210',
      fontWeight: '700',
      shadow: 'none',
    },
    _hover: {
      color: ui.colors.text,
    },
  },
} as const;

export const sliderStyles = {
  track: {
    bg: ui.colors.inset,
    h: '6px',
    borderRadius: ui.radius.sm,
    borderWidth: '1px',
    borderColor: ui.colors.border,
  },
  range: {
    bg: ui.colors.accent,
    borderRadius: ui.radius.sm,
  },
  thumb: {
    boxSize: '14px',
    bg: ui.colors.text,
    borderWidth: '2px',
    borderColor: ui.colors.accent,
    borderRadius: ui.radius.sm,
    shadow: 'none',
    _focusVisible: {
      outline: '2px solid',
      outlineColor: ui.colors.accent,
      outlineOffset: '1px',
    },
  },
  tickLabel: {
    fontSize: '2xs',
    color: ui.colors.textDim,
    fontVariantNumeric: 'tabular-nums',
    fontFamily: ui.fonts.mono,
  },
} as const;

export const setupSectionStyles = {
  root: {
    borderRadius: ui.radius.sm,
    borderWidth: '1px',
    borderColor: ui.colors.border,
    bg: ui.colors.panel,
    overflow: 'hidden',
    boxShadow: 'none',
  },
  header: {
    px: { base: 3, md: 4 },
    py: 2.5,
    borderBottomWidth: '1px',
    borderColor: ui.colors.border,
    bg: ui.colors.panelRaised,
  },
  title: {
    fontSize: 'xs',
    fontWeight: '700',
    color: ui.colors.text,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  subtitle: {
    fontSize: '2xs',
    color: ui.colors.textDim,
    lineHeight: 1.5,
  },
  body: {
    p: { base: 3, md: 4 },
  },
  summaryStrip: {
    p: 3,
    borderRadius: ui.radius.sm,
    borderWidth: '1px',
    borderColor: ui.colors.border,
    bg: ui.colors.inset,
  },
  summaryLabel: {
    fontSize: '2xs',
    fontWeight: '700',
    color: ui.colors.textDim,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    mb: 1.5,
    fontFamily: ui.fonts.mono,
  },
  fieldGrid: {
    columns: { base: 1, md: 2 },
    gap: 3,
  },
  fieldGridWide: {
    columns: { base: 1, sm: 2, lg: 4 },
    gap: 3,
  },
  insetPanel: {
    p: 3,
    borderRadius: ui.radius.sm,
    borderWidth: '1px',
    borderColor: ui.colors.border,
    bg: ui.colors.inset,
    boxShadow: 'none',
  },
  actionBar: {
    p: 2.5,
    borderRadius: ui.radius.sm,
    borderWidth: '1px',
    borderColor: ui.colors.border,
    bg: ui.colors.inset,
  },
} as const;

export const launchPanelStyles = {
  root: {
    p: { base: 3, md: 4 },
    borderRadius: ui.radius.sm,
    borderWidth: '1px',
    borderColor: ui.colors.borderStrong,
    bg: ui.colors.inset,
    boxShadow: 'none',
  },
  title: {
    fontSize: 'xs',
    fontWeight: '700',
    color: ui.colors.text,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  },
  subtitle: {
    fontSize: '2xs',
    color: ui.colors.textMuted,
    lineHeight: 1.6,
    maxW: '560px',
  },
} as const;
