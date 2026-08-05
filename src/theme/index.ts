import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const config = defineConfig({
  globalCss: {
    html: {
      colorScheme: 'dark',
    },
    body: {
      bg: 'transparent',
      color: 'gray.100',
    },
    '#root': {
      color: 'gray.100',
    },
    'input, select, textarea': {
      color: 'gray.100',
    },
    option: {
      color: 'gray.900',
      bg: 'white',
    },
  },
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: '#eef6ff' },
          100: { value: '#d9ebff' },
          200: { value: '#bcdcff' },
          300: { value: '#8ec5ff' },
          400: { value: '#65a9ff' },
          500: { value: '#4a8ee6' },
          600: { value: '#3570c4' },
          700: { value: '#2c5a9f' },
          800: { value: '#284d83' },
          900: { value: '#26426d' },
        },
        surface: {
          DEFAULT: { value: '#131722' },
          raised: { value: '#181e2c' },
          inset: { value: '#0f131c' },
        },
        chart: {
          bg: { value: '#0d1119' },
        },
      },
      fonts: {
        body: {
          value:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      },
      radii: {
        panel: { value: '1rem' },
      },
    },
    semanticTokens: {
      colors: {
        fg: {
          DEFAULT: { value: '{colors.gray.100}' },
          muted: { value: '{colors.gray.400}' },
          subtle: { value: '{colors.gray.500}' },
          inverted: { value: '{colors.gray.900}' },
        },
        bg: {
          DEFAULT: { value: '{colors.surface}' },
          muted: { value: '{colors.surface.inset}' },
        },
      },
    },
    recipes: {
      heading: {
        base: {
          color: 'fg',
        },
      },
      text: {
        base: {
          color: 'fg',
        },
      },
      input: {
        base: {
          color: 'gray.100',
          bg: 'surface.inset',
          borderColor: 'whiteAlpha.200',
          _hover: { borderColor: 'whiteAlpha.300' },
          _focusVisible: {
            borderColor: 'brand.400',
            boxShadow: '0 0 0 3px rgba(101,169,255,.15)',
          },
        },
      },
      textarea: {
        base: {
          color: 'gray.100',
          bg: 'surface.inset',
          borderColor: 'whiteAlpha.200',
        },
      },
      button: {
        variants: {
          variant: {
            outline: {
              borderColor: 'whiteAlpha.300',
              color: 'gray.100',
              bg: 'surface.inset',
              _hover: {
                bg: 'whiteAlpha.100',
                borderColor: 'whiteAlpha.400',
                color: 'white',
              },
            },
            surface: {
              bg: '#242d3d',
              color: 'gray.100',
              borderWidth: '1px',
              borderColor: '#344158',
              _hover: {
                bg: '#2d3748',
                color: 'white',
              },
            },
            subtle: {
              bg: 'whiteAlpha.100',
              color: 'gray.100',
              _hover: {
                bg: 'whiteAlpha.200',
                color: 'white',
              },
            },
            ghost: {
              color: 'gray.200',
              _hover: {
                bg: 'whiteAlpha.100',
                color: 'white',
              },
            },
            plain: {
              color: 'gray.200',
              _hover: {
                color: 'white',
                bg: 'whiteAlpha.80',
              },
            },
            solid: {
              _disabled: {
                opacity: 0.45,
              },
            },
          },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);

export const panelStyles = {
  root: {
    bg: 'surface',
    borderWidth: '1px',
    borderColor: 'whiteAlpha.100',
    borderRadius: '2xl',
    overflow: 'hidden',
    shadow: '2xl',
    color: 'gray.100',
  },
  header: {
    px: { base: 4, md: 5 },
    py: 4,
    borderBottomWidth: '1px',
    borderColor: 'whiteAlpha.100',
    bg: 'linear-gradient(180deg, rgba(24,30,44,.98), rgba(19,23,34,.98))',
    color: 'gray.100',
  },
  body: {
    p: { base: 4, md: 5 },
    color: 'gray.100',
  },
} as const;

export const fieldStyles = {
  label: { color: 'gray.300', fontSize: 'sm', fontWeight: 'medium', mb: 1.5 },
  control: {
    bg: 'surface.inset',
    borderColor: 'whiteAlpha.200',
    borderRadius: 'lg',
    color: 'gray.100',
    _hover: { borderColor: 'whiteAlpha.300' },
    _focusVisible: {
      borderColor: 'brand.400',
      boxShadow: '0 0 0 3px rgba(101,169,255,.15)',
    },
  },
  helper: { color: 'gray.500', fontSize: 'xs', mt: 1.5 },
} as const;

export const statValueStyle = {
  color: 'gray.100',
  fontWeight: 'semibold',
} as const;

export const statLabelStyle = {
  color: 'gray.500',
  fontSize: 'xs',
} as const;

export { buttonStyles, badgeStyles, tabStyles, setupSectionStyles, launchPanelStyles, sliderStyles } from './components';
