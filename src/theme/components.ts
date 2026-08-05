/** Shared Chakra style props for consistent, high-contrast dark UI. */

export const buttonStyles = {
  secondary: {
    variant: 'outline' as const,
    borderColor: 'whiteAlpha.300',
    color: 'gray.100',
    bg: 'surface.inset',
    fontWeight: 'semibold',
    _hover: {
      bg: 'whiteAlpha.100',
      borderColor: 'whiteAlpha.400',
      color: 'white',
    },
    _disabled: {
      opacity: 0.45,
      cursor: 'not-allowed',
    },
  },
  primary: {
    variant: 'solid' as const,
    bg: 'brand.400',
    color: 'gray.900',
    fontWeight: 'bold',
    borderColor: 'brand.300',
    _hover: {
      bg: 'brand.300',
      color: 'gray.900',
    },
    _disabled: {
      opacity: 0.45,
      cursor: 'not-allowed',
      bg: 'brand.400',
      color: 'gray.900',
    },
  },
  danger: {
    variant: 'outline' as const,
    borderColor: 'red.400',
    color: 'red.100',
    bg: 'rgba(80,20,20,.45)',
    fontWeight: 'semibold',
    _hover: {
      bg: 'rgba(120,30,30,.55)',
      borderColor: 'red.300',
      color: 'white',
    },
  },
} as const;

export const badgeStyles = {
  info: {
    bg: 'brand.900',
    color: 'brand.100',
    borderWidth: '1px',
    borderColor: 'brand.700',
    borderRadius: 'md',
    px: 2,
    py: 0.5,
    fontSize: 'xs',
    fontWeight: 'semibold',
  },
  statusGood: {
    bg: 'rgba(20,60,40,.85)',
    color: 'green.100',
    borderWidth: '1px',
    borderColor: 'green.600',
    px: 3,
    py: 1.5,
    borderRadius: 'full',
    fontSize: 'xs',
    fontWeight: 'medium',
  },
  statusBad: {
    bg: 'rgba(80,20,20,.85)',
    color: 'red.100',
    borderWidth: '1px',
    borderColor: 'red.600',
    px: 3,
    py: 1.5,
    borderRadius: 'full',
    fontSize: 'xs',
    fontWeight: 'medium',
  },
} as const;

export const tabStyles = {
  list: {
    bg: 'surface.inset',
    borderRadius: 'xl',
    p: 1,
    borderWidth: '1px',
    borderColor: 'whiteAlpha.100',
  },
  trigger: {
    borderRadius: 'lg',
    py: 2.5,
    px: 4,
    fontWeight: 'medium',
    fontSize: 'sm',
    color: 'gray.400',
    transition: 'background .15s, color .15s',
    _selected: {
      bg: 'brand.400',
      color: 'gray.900',
      fontWeight: 'bold',
      shadow: '0 4px 14px rgba(101,169,255,.25)',
    },
    _hover: {
      color: 'gray.200',
    },
  },
} as const;

export const sliderStyles = {
  track: {
    bg: 'whiteAlpha.200',
    h: '8px',
    borderRadius: 'full',
    shadow: 'inset 0 1px 2px rgba(0,0,0,.25)',
  },
  range: {
    bg: 'brand.400',
    borderRadius: 'full',
  },
  thumb: {
    boxSize: '20px',
    bg: 'white',
    borderWidth: '2px',
    borderColor: 'brand.300',
    borderRadius: 'full',
    shadow: '0 2px 10px rgba(101,169,255,.35)',
    _focusVisible: {
      outline: '2px solid',
      outlineColor: 'brand.400',
      outlineOffset: '2px',
    },
  },
  tickLabel: {
    fontSize: 'xs',
    color: 'gray.500',
    fontVariantNumeric: 'tabular-nums',
  },
} as const;

export const setupSectionStyles = {
  root: {
    borderRadius: '2xl',
    borderWidth: '1px',
    borderColor: 'whiteAlpha.100',
    bg: 'linear-gradient(160deg, rgba(22,28,40,.96), rgba(13,17,25,.98))',
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.04)',
  },
  header: {
    px: { base: 4, md: 5 },
    py: 3.5,
    borderBottomWidth: '1px',
    borderColor: 'whiteAlpha.80',
    bg: 'linear-gradient(180deg, rgba(255,255,255,.04), transparent)',
  },
  title: {
    fontSize: 'sm',
    fontWeight: 'semibold',
    color: 'gray.100',
    letterSpacing: '-0.01em',
  },
  subtitle: {
    fontSize: 'xs',
    color: 'gray.500',
    lineHeight: 1.55,
  },
  body: {
    p: { base: 4, md: 5 },
  },
  summaryStrip: {
    p: 3.5,
    borderRadius: 'xl',
    borderWidth: '1px',
    borderColor: 'whiteAlpha.80',
    bg: 'rgba(0,0,0,.18)',
  },
  summaryLabel: {
    fontSize: '2xs',
    fontWeight: 'semibold',
    color: 'gray.500',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    mb: 2,
  },
  fieldGrid: {
    columns: { base: 1, md: 2 },
    gap: 4,
  },
  fieldGridWide: {
    columns: { base: 1, sm: 2, lg: 4 },
    gap: 4,
  },
  insetPanel: {
    p: 4,
    borderRadius: 'xl',
    borderWidth: '1px',
    borderColor: 'whiteAlpha.100',
    bg: 'rgba(0,0,0,.22)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.03)',
  },
  actionBar: {
    p: 3,
    borderRadius: 'xl',
    borderWidth: '1px',
    borderColor: 'whiteAlpha.100',
    bg: 'rgba(0,0,0,.18)',
  },
} as const;

export const launchPanelStyles = {
  root: {
    p: { base: 4, md: 5 },
    borderRadius: '2xl',
    borderWidth: '1px',
    borderColor: 'whiteAlpha.120',
    bg: 'linear-gradient(145deg, rgba(18,24,36,.98), rgba(10,14,22,.98))',
    boxShadow: '0 12px 40px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.05)',
  },
  title: {
    fontSize: 'sm',
    fontWeight: 'semibold',
    color: 'gray.100',
  },
  subtitle: {
    fontSize: 'xs',
    color: 'gray.500',
    lineHeight: 1.6,
    maxW: '520px',
  },
} as const;
