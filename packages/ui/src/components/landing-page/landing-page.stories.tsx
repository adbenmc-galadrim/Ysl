import type { Meta, StoryObj } from '@storybook/react-vite';

import { LandingPage } from '#components/landing-page';
import { LANDING_FR } from '#components/landing-page/landing-fr';

/**
 * The landing page with its copy passed in: the app hands it its
 * translations, its name and its URL. The screen « 10 Landing » holds the
 * reference images.
 */
const meta = {
  title: 'Composants/LandingPage',
  component: LandingPage,
  parameters: { layout: 'fullscreen' },
  args: {
    copy: LANDING_FR,
    appName: 'Courrier',
    url: 'https://courrier.ysl.fr',
    host: 'courrier.ysl.fr',
    version: '1.0',
  },
} satisfies Meta<typeof LandingPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Telephone: Story = {
  globals: { viewport: { value: 'landingPhone', isRotated: false } },
};

/** Another tenant: nothing in the page may still say « Courrier ». */
export const AutreNom: Story = {
  args: {
    appName: 'Colis',
    url: 'https://colis.example.fr',
    host: 'colis.example.fr',
    version: '2026.10.24',
    copy: {
      ...LANDING_FR,
      nav: { ...LANDING_FR.nav, home: 'Colis, accueil' },
      hero: {
        ...LANDING_FR.hero,
        scanLinkLabel: 'Comment ça marche : installer depuis colis.example.fr',
      },
      closing: {
        ...LANDING_FR.closing,
        text: 'Installez Colis. Le prochain colis vous attend.',
      },
    },
  },
  globals: { viewport: { value: 'landingPhone', isRotated: false } },
};
