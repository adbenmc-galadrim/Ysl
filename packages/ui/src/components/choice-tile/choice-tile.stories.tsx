import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { ChoiceTile, ChoiceTileGrid } from '#components/choice-tile';
import { STORAGE_LOCATIONS } from '#fixtures/locations';

const meta = {
  title: 'Composants/ChoiceTile',
  component: ChoiceTile,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-[353px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChoiceTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Choisi: Story = { args: { label: 'Étagère A', selected: true } };

export const NonChoisi: Story = { args: { label: 'Étagère B' } };

/** The storage locations of the mailroom, as asked at the start of a batch. */
export const Grille: Story = {
  args: { label: '' },
  render: () => {
    const [value, setValue] = useState<string>(STORAGE_LOCATIONS[0]);
    return (
      <ChoiceTileGrid label="Emplacement">
        {STORAGE_LOCATIONS.map((location) => (
          <ChoiceTile
            key={location}
            label={location}
            selected={location === value}
            onClick={() => setValue(location)}
          />
        ))}
      </ChoiceTileGrid>
    );
  },
};
