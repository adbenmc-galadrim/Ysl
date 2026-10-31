import type { Decorator, Preview } from '@storybook/react-vite';

import { Device, type DeviceTone } from '../src/device';
import {
  applyCorners,
  CORNER_RADII,
  CORNER_TILES,
  DEFAULT_CORNERS,
  isCornerRadius,
  isCornerTiles,
} from '../src/foundations/corners';
import {
  applyTheme,
  DEFAULT_THEME,
  isTheme,
  THEMES,
} from '../src/foundations/theme';

import './preview.css';

/**
 * Screen stories declare `parameters.device`; they are then rendered full
 * bleed inside the iPhone chrome the mockups are drawn with. Component stories
 * leave it out and render centred on a plain canvas.
 */
const withDevice: Decorator = (Story, { parameters }) => {
  const device = parameters.device as { tone?: DeviceTone } | undefined;
  if (!device) return <Story />;
  return (
    <Device tone={device.tone}>
      <Story />
    </Device>
  );
};

/**
 * The corner presets of `styles.css`, switched from the toolbar. They are set
 * on <html>, where the app sets them too, so every story — components,
 * screens, docs — follows the same choice.
 */
const withCorners: Decorator = (Story, { globals }) => {
  applyCorners(document.documentElement, {
    radius: isCornerRadius(globals.radius)
      ? globals.radius
      : DEFAULT_CORNERS.radius,
    tiles: isCornerTiles(globals.tiles) ? globals.tiles : DEFAULT_CORNERS.tiles,
  });
  return <Story />;
};

/**
 * The appearance, switched from the toolbar like the corners. "Automatique"
 * follows the OS of the machine running Storybook; a story checked in the
 * dark pins `globals: { theme: 'sombre' }`.
 */
const withTheme: Decorator = (Story, { globals }) => {
  applyTheme(
    document.documentElement,
    isTheme(globals.theme) ? globals.theme : DEFAULT_THEME,
  );
  return <Story />;
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Apparence : celle du système, claire ou sombre',
      toolbar: {
        title: 'Thème',
        icon: 'mirror',
        items: THEMES.map((theme) => ({
          value: theme.value,
          title: theme.title,
        })),
        dynamicTitle: true,
      },
    },
    radius: {
      description: 'Arrondi des boutons, champs, cartes et pastilles',
      toolbar: {
        title: 'Arrondis',
        icon: 'component',
        items: CORNER_RADII.map((preset) => ({
          value: preset.value,
          title: `${preset.title} (${preset.detail})`,
        })),
        dynamicTitle: true,
      },
    },
    tiles: {
      description: 'Forme des pastilles : icônes, avatars, boutons icône',
      toolbar: {
        title: 'Pastilles',
        icon: 'circle',
        items: CORNER_TILES.map((preset) => ({
          value: preset.value,
          title: preset.title,
        })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { ...DEFAULT_CORNERS, theme: DEFAULT_THEME },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: { test: 'todo' },
    viewport: {
      options: {
        iphoneSe: {
          name: 'iPhone SE',
          styles: { width: '375px', height: '667px' },
          type: 'mobile',
        },
        iphone15: {
          name: 'iPhone 15 (maquettes)',
          styles: { width: '393px', height: '852px' },
          type: 'mobile',
        },
        iphoneProMax: {
          name: 'iPhone 15 Pro Max',
          styles: { width: '430px', height: '932px' },
          type: 'mobile',
        },
        ipad: {
          name: 'iPad mini',
          styles: { width: '744px', height: '1133px' },
          type: 'tablet',
        },
        landingPhone: {
          name: 'Landing, téléphone (maquette 390 px)',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
        landingDesktop: {
          name: 'Ordinateur (maquette 1440 px)',
          styles: { width: '1440px', height: '900px' },
          type: 'desktop',
        },
      },
    },
    options: {
      storySort: {
        order: ['Introduction', 'Fondations', 'Composants', 'Écrans'],
      },
    },
  },
  decorators: [withDevice, withCorners, withTheme],
};

export default preview;
