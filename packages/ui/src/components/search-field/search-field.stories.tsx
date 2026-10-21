import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { SearchField, SearchTrigger } from '#components/search-field';

const meta = {
  title: 'Composants/SearchField',
  component: SearchTrigger,
  decorators: [(Story) => <div className="flex w-[353px]"><Story /></div>],
} satisfies Meta<typeof SearchTrigger>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The home door to the search screen. */
export const Declencheur: Story = { name: 'Déclencheur' };

/** The search screen's own field, with its clear cross. */
export const Champ: Story = {
  render: () => {
    const [query, setQuery] = useState('garn');
    return (
      <SearchField
        size="bar"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => setQuery('')}
      />
    );
  },
};

export const ChampMoyen: Story = {
  name: 'Champ moyen',
  render: () => <SearchField className="flex-1" />,
};
