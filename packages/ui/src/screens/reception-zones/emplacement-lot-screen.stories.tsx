import type { Meta, StoryObj } from '@storybook/react-vite';

import { STORAGE_LOCATIONS } from '#fixtures/locations';
import { SCANNED_LABEL } from '#fixtures/reception';
import { EmplacementLotScreen } from '#screens/reception-zones/emplacement-lot-screen';

const meta = {
  title: 'Écrans/09 Zones d’ombre/Réception/Emplacement du lot',
  component: EmplacementLotScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'dark' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  args: { count: 12, label: SCANNED_LABEL, locations: STORAGE_LOCATIONS },
} satisfies Meta<typeof EmplacementLotScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EmplacementDuLot: Story = {
  name: 'Emplacement du lot',
  parameters: { reference: '09-zones-d-ombre/reception--emplacement-du-lot' },
  args: { value: 'Étagère A' },
};

/** Nothing picked yet: the batch cannot start. */
export const SansChoix: Story = {
  name: 'Sans choix',
  args: { value: undefined },
};
