import type { Decorator, Preview } from '@storybook/react-vite';

import { Device, type DeviceTone } from '../src/device';

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
 * on <html>, where the app would set them too, so every story — components,
 * screens, docs — follows the same choice.
 */
const withCorners: Decorator = (Story, { globals }) => {
  const root = document.documentElement;
  const radius = globals.radius as string | undefined;
  const tiles = globals.tiles as string | undefined;
  if (radius && radius !== 'maquettes') root.dataset.radius = radius;
  else delete root.dataset.radius;
  if (tiles === 'rondes') root.dataset.tiles = tiles;
  else delete root.dataset.tiles;
  return <Story />;
};

const preview: Preview = {
  globalTypes: {
    radius: {
      description: 'Arrondi des boutons, champs et cartes',
      toolbar: {
        title: 'Arrondis',
        icon: 'component',
        items: [
          { value: 'carre', title: 'Carrés (0 px)' },
          { value: 'leger', title: 'Légers (2 à 6 px)' },
          { value: 'maquettes', title: 'Maquettes (4 à 12 px)' },
          { value: 'doux', title: 'Doux (6 à 16 px)' },
          { value: 'arrondi', title: 'Arrondis (pilules)' },
        ],
        dynamicTitle: true,
      },
    },
    tiles: {
      description: 'Forme des pastilles : icônes, avatars, boutons icône',
      toolbar: {
        title: 'Pastilles',
        icon: 'circle',
        items: [
          { value: 'auto', title: 'Pastilles : suivent les arrondis' },
          { value: 'rondes', title: 'Pastilles : rondes' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { radius: 'maquettes', tiles: 'auto' },
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
        desktop: {
          name: 'Poste ordinateur',
          styles: { width: '1280px', height: '800px' },
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
  decorators: [withDevice, withCorners],
};

export default preview;
