import type { Meta, StoryObj } from '@storybook/react-vite';

import { ParcelRow } from '#components/parcel-row';
import { PARCELS } from '#fixtures/parcels';

const meta = {
  title: 'Composants/ParcelRow',
  component: ParcelRow,
  decorators: [(Story) => <div className="w-[353px]"><Story /></div>],
  args: { parcel: PARCELS.camille },
} satisfies Meta<typeof ParcelRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ANotifier: Story = { name: 'À notifier' };

export const EnRetard: Story = { name: 'En retard', args: { parcel: PARCELS.ines } };

export const Remis: Story = { args: { parcel: PARCELS.malik } };

export const ReponseCeNestPasAMoi: Story = {
  name: 'Réponse « pas à moi »',
  args: { parcel: PARCELS.hugoNotMine },
};

export const ReponseCollegue: Story = {
  name: 'Réponse « un collègue passera »',
  args: { parcel: PARCELS.noraDelegated },
};

export const Selectionne: Story = {
  name: 'Sélectionné',
  args: { parcel: PARCELS.hugo, selected: true, trailing: null },
};

export const AvecReserve: Story = {
  name: 'Avec une réserve',
  args: { parcel: { ...PARCELS.camille, damage: 'Réserve · Carton abîmé' } },
};
