import type { Meta, StoryObj } from '@storybook/react-vite';

import { LandingPage } from '#components/landing-page';
import { LANDING_FR } from '#screens/landing/landing-screen';

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
  },
} satisfies Meta<typeof LandingPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Telephone: Story = {
  globals: { viewport: { value: 'landingPhone', isRotated: false } },
};

export const AutreNom: Story = {
  args: {
    appName: 'Colis',
    host: 'colis.example.fr',
    url: 'https://colis.example.fr',
  },
  globals: { viewport: { value: 'landingPhone', isRotated: false } },
};
