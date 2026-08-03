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
    py: 2,
    fontWeight: 'medium',
    color: 'gray.300',
    _selected: {
      bg: 'brand.400',
      color: 'gray.900',
      fontWeight: 'bold',
      shadow: 'sm',
    },
  },
} as const;
