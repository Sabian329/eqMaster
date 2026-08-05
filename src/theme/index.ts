import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';
import { ui } from './tokens';

const config = defineConfig({
  globalCss: {
    html: {
      colorScheme: 'dark',
    },
    body: {
      bg: 'transparent',
      color: ui.colors.text,
    },
    '#root': {
      color: ui.colors.text,
    },
    'input, select, textarea': {
      color: ui.colors.text,
    },
    option: {
      color: '#041210',
      bg: '#e8edf4',
    },
  },
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: '#e8fff8' },
          100: { value: '#c5f5e8' },
          200: { value: '#8ee7cf' },
          300: { value: '#6ee7c5' },
          400: { value: '#52d1b6' },
          500: { value: '#3dba9d' },
          600: { value: '#2f9680' },
          700: { value: '#267866' },
          800: { value: '#1f5f52' },
          900: { value: '#184a40' },
        },
        surface: {
          DEFAULT: { value: ui.colors.panel },
          raised: { value: ui.colors.panelRaised },
          inset: { value: ui.colors.inset },
        },
        chart: {
          bg: { value: ui.colors.chart },
        },
      },
      fonts: {
        body: { value: ui.fonts.sans },
        mono: { value: ui.fonts.mono },
      },
      radii: {
        panel: { value: ui.radius.sm },
      },
    },
    semanticTokens: {
      colors: {
        fg: {
          DEFAULT: { value: ui.colors.text },
          muted: { value: ui.colors.textMuted },
          subtle: { value: ui.colors.textDim },
          inverted: { value: '#041210' },
        },
        bg: {
          DEFAULT: { value: ui.colors.panel },
          muted: { value: ui.colors.inset },
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
          color: ui.colors.text,
          bg: ui.colors.inset,
          borderColor: ui.colors.border,
          borderRadius: ui.radius.sm,
          _hover: { borderColor: ui.colors.borderStrong },
          _focusVisible: {
            borderColor: ui.colors.accent,
            boxShadow: `0 0 0 1px ${ui.colors.accentGlow}`,
          },
        },
      },
      textarea: {
        base: {
          color: ui.colors.text,
          bg: ui.colors.inset,
          borderColor: ui.colors.border,
          borderRadius: ui.radius.sm,
        },
      },
      button: {
        variants: {
          variant: {
            outline: {
              borderRadius: ui.radius.sm,
              borderColor: ui.colors.borderStrong,
              color: ui.colors.text,
              bg: ui.colors.inset,
              _hover: {
                bg: ui.colors.panelRaised,
                borderColor: ui.colors.borderFocus,
                color: 'white',
              },
            },
            surface: {
              bg: ui.colors.panelRaised,
              color: ui.colors.text,
              borderWidth: '1px',
              borderColor: ui.colors.border,
              borderRadius: ui.radius.sm,
              _hover: {
                bg: ui.colors.panel,
                color: 'white',
              },
            },
            subtle: {
              bg: ui.colors.inset,
              color: ui.colors.text,
              borderRadius: ui.radius.sm,
              _hover: {
                bg: ui.colors.panelRaised,
                color: 'white',
              },
            },
            ghost: {
              color: ui.colors.textMuted,
              borderRadius: ui.radius.sm,
              _hover: {
                bg: ui.colors.inset,
                color: 'white',
              },
            },
            plain: {
              color: ui.colors.textMuted,
              borderRadius: ui.radius.sm,
              _hover: {
                color: 'white',
                bg: ui.colors.inset,
              },
            },
            solid: {
              borderRadius: ui.radius.sm,
              _disabled: {
                opacity: 0.4,
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
    bg: ui.colors.panel,
    borderWidth: '1px',
    borderColor: ui.colors.border,
    borderRadius: ui.radius.sm,
    overflow: 'hidden',
    shadow: 'none',
    color: ui.colors.text,
  },
  header: {
    px: { base: 3, md: 4 },
    py: 3,
    borderBottomWidth: '1px',
    borderColor: ui.colors.border,
    bg: ui.colors.panelRaised,
    color: ui.colors.text,
  },
  body: {
    p: { base: 3, md: 4 },
    color: ui.colors.text,
  },
} as const;

export const fieldStyles = {
  label: {
    color: ui.colors.textMuted,
    fontSize: '2xs',
    fontWeight: '700',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    mb: 1,
    fontFamily: ui.fonts.mono,
  },
  control: {
    bg: ui.colors.inset,
    borderColor: ui.colors.border,
    borderRadius: ui.radius.sm,
    color: ui.colors.text,
    fontFamily: ui.fonts.mono,
    fontSize: 'xs',
    _hover: { borderColor: ui.colors.borderStrong },
    _focusVisible: {
      borderColor: ui.colors.accent,
      boxShadow: `0 0 0 1px ${ui.colors.accentGlow}`,
    },
  },
  helper: { color: ui.colors.textDim, fontSize: '2xs', mt: 1 },
} as const;

export const statValueStyle = {
  color: ui.colors.text,
  fontWeight: '700',
  fontFamily: ui.fonts.mono,
} as const;

export const statLabelStyle = {
  color: ui.colors.textDim,
  fontSize: '2xs',
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
} as const;

export { ui } from './tokens';
export {
  buttonStyles,
  badgeStyles,
  tabStyles,
  setupSectionStyles,
  launchPanelStyles,
  sliderStyles,
} from './components';
