import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { FilterChip, FilterChips } from '#components/filter-chip';

const meta = {
  title: 'Composants/FilterChip',
  component: FilterChip,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof FilterChip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Choisi: Story = { args: { label: 'Aujourd’hui', selected: true } };

export const AvecCompte: Story = { args: { label: 'Échecs', count: 1 } };

export const Groupe: Story = {
  args: { label: '' },
  render: () => {
    const [value, setValue] = useState('Aujourd’hui');
    return (
      <FilterChips aria-label="Filtrer" className="w-[353px]">
        {[
          { label: 'Aujourd’hui' },
          { label: 'Échecs', count: 1 },
          { label: 'En file', count: 2 },
        ].map((chip) => (
          <FilterChip
            key={chip.label}
            {...chip}
            selected={chip.label === value}
            onClick={() => setValue(chip.label)}
          />
        ))}
      </FilterChips>
    );
  },
};
