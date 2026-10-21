import type { Meta, StoryObj } from '@storybook/react-vite';

import { LabelThumb } from '#components/label-thumb';
import { DAMAGE_REASONS } from '#fixtures/damage';
import { PARCELS } from '#fixtures/parcels';
import { ColisAbimeScreen } from '#screens/reception-zones/colis-abime-screen';

const meta = {
  title: 'Écrans/09 Zones d’ombre/Réception/Colis abîmé',
  component: ColisAbimeScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  args: {
    parcel: PARCELS.ines,
    reasons: DAMAGE_REASONS,
    notifyRecipient: true,
    carrierReserve: false,
  },
} satisfies Meta<typeof ColisAbimeScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ColisAbime: Story = {
  name: 'Colis abîmé',
  parameters: { reference: '09-zones-d-ombre/reception--colis-abime' },
  args: {
    reason: 'Carton abîmé',
    photos: <LabelThumb width={104} height={104} radius={14} tone="deep" />,
    remark: 'Coin enfoncé, emballage intérieur intact',
  },
};

/** Just opened: nothing chosen, nothing to save yet. */
export const Vide: Story = { args: {} };
