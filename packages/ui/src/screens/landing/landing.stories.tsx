import type { Meta, StoryObj } from '@storybook/react-vite';

import { LandingScreen } from '#screens/landing/landing-screen';

/**
 * The page courrier.ysl.fr shows before the app is installed. One
 * component, two layouts: the phone below `xl` (1280 px), the desktop page above.
 */
const meta = {
  title: 'Écrans/10 Landing/Landing',
  component: LandingScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LandingScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Mobile: Story = {
  parameters: { reference: '10-landing/landing--mobile' },
  globals: { viewport: { value: 'landingPhone', isRotated: false } },
};

export const Ordinateur: Story = {
  parameters: { reference: '10-landing/landing--ordinateur' },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
};
