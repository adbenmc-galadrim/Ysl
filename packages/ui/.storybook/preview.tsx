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
      description: 'Arrondi des boutons, champs, cartes et pastilles',
      toolbar: {
        title: 'Arrondis',
        icon: 'component',
        // From the squarest to the roundest; the mockups sit just before
        // the last one.
        items: [
          { value: 'carre', title: 'Carrés (0 px)' },
          { value: 'leger', title: 'Légers (4 à 12 px, sans pilules)' },
          { value: 'doux', title: 'Doux (6 à 16 px, sans pilules)' },
          { value: 'maquettes', title: 'Maquettes (pilules, 14 à 24 px)' },
          { value: 'arrondi', title: 'Arrondis (tout en pilules, 24 à 32 px)' },
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
          { value: 'rondes', title: 'Pastilles : toujours rondes' },
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
        landingPhone: {
          name: 'Landing, téléphone (maquette 390 px)',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
        landingDesktop: {
          name: 'Landing, ordinateur (maquette 1440 px)',
          styles: { width: '1440px', height: '900px' },
          type: 'desktop',
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
