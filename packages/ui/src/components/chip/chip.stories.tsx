import type { Meta, StoryObj } from '@storybook/react-vite';

import { Chip, ChipGroup, ChipSelect } from '#components/chip';

const meta = {
  title: 'Composants/Chip',
  component: Chip,
  args: { children: 'En attente' },
} satisfies Meta<typeof Chip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Inactif: Story = {};

export const Actif: Story = { args: { selected: true, children: 'Tout' } };

/** One line that runs off the edge: the search filters. */
export const GroupeDefilant: Story = {
  name: 'Groupe défilant',
  render: () => (
    <div className="w-[353px]">
      <ChipGroup label="Filtres" layout="scroll">
        <Chip selected>Tout</Chip>
        <Chip>En attente</Chip>
        <Chip>Remis</Chip>
        <Chip>30 derniers jours</Chip>
      </ChipGroup>
    </div>
  ),
};

/** Wraps onto as many lines as needed: a reason to pick. */
export const GroupeMultiligne: Story = {
  name: 'Groupe multiligne',
  render: () => (
    <div className="w-[353px]">
      <ChipGroup label="Motif">
        <Chip selected>Non réclamé</Chip>
        <Chip>Refusé</Chip>
        <Chip>Destinataire parti</Chip>
        <Chip>Erreur d’adresse</Chip>
      </ChipGroup>
    </div>
  ),
};

/** A setting of the list, opening the system menu: how results are grouped. */
export const Menu: Story = {
  render: () => (
    <ChipSelect
      label="Grouper"
      value="status"
      options={[
        { value: 'status', label: 'Par statut' },
        { value: 'recipient', label: 'Par destinataire' },
        { value: 'date', label: 'Par date' },
      ]}
    />
  ),
};
