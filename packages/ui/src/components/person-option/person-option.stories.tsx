import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { PersonOption, PersonOptionGroup } from '#components/person-option';
import { DIRECTORY, whereabouts } from '#fixtures/reception';

const meta = {
  title: 'Composants/PersonOption',
  component: PersonOption,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-[353px]">
        <Story />
      </div>
    ),
  ],
  args: {
    initials: DIRECTORY.lea.initials,
    name: DIRECTORY.lea.name,
    detail: whereabouts(DIRECTORY.lea),
  },
} satisfies Meta<typeof PersonOption>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Choisie: Story = { args: { selected: true } };

export const NonChoisie: Story = { name: 'Non choisie' };

export const Groupe: Story = {
  render: () => {
    const people = [DIRECTORY.lea, DIRECTORY.lise, DIRECTORY.louis];
    const [selected, setSelected] = useState(people[0]!.id);
    return (
      <PersonOptionGroup label="Destinataire">
        {people.map((p) => (
          <PersonOption
            key={p.id}
            initials={p.initials}
            name={p.name}
            detail={whereabouts(p)}
            selected={p.id === selected}
            onClick={() => setSelected(p.id)}
          />
        ))}
      </PersonOptionGroup>
    );
  },
};
