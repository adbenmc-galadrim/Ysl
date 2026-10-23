import type { Meta, StoryObj } from '@storybook/react-vite';

import { ScanScene } from '#components/scan-scene';

/** The parcel in the viewfinder, its barcode just read. */
const meta = {
  title: 'Composants/ScanScene',
  component: ScanScene,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ScanScene>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Telephone: Story = {
  name: 'Téléphone',
  args: { size: 'phone' },
  globals: { viewport: { value: 'landingPhone', isRotated: false } },
};

export const Ordinateur: Story = {
  args: { size: 'desk' },
};
