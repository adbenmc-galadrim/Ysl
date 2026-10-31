import type { Meta, StoryObj } from '@storybook/react-vite';

import { DeskPanel, DeskSidePanel, DeskStats } from '#components/desk-panel';

const meta = {
  title: 'Composants/DeskPanel',
  component: DeskPanel,
  args: {
    title: 'Administrateurs',
    className: 'h-40 w-[376px]',
    children: <p className="p-4 text-13">Contenu du panneau</p>,
  },
} satisfies Meta<typeof DeskPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Defaut: Story = { name: 'Par défaut' };

export const AvecSousTitre: Story = {
  name: 'Sous-titre et action',
  args: { subtitle: 'Deux personnes', action: 'Inviter' },
};

export const TraitSuperpose: Story = {
  name: 'Trait superposé',
  args: { overlayStroke: true },
};

export const PanneauLateral: Story = {
  name: 'Panneau latéral',
  render: () => (
    <DeskSidePanel className="h-40 w-[360px]">
      <p className="p-4 text-13">Contenu du panneau</p>
    </DeskSidePanel>
  ),
};

export const Chiffres: Story = {
  name: 'Chiffres clés',
  render: () => (
    <DeskStats
      className="w-[700px]"
      stats={[
        { label: 'En route', value: '12' },
        { label: 'En souffrance', value: '5', tone: 'orange' },
        { label: 'À régulariser', value: '2', tone: 'red' },
      ]}
    />
  ),
};
