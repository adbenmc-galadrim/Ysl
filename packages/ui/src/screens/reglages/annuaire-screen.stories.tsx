import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { DIRECTORY, DIRECTORY_LETTERS } from '#fixtures/directory';
import {
  AnnuaireScreen,
  type DirectoryEntry,
} from '#screens/reglages/annuaire-screen';

const ENTRIES: DirectoryEntry[] = DIRECTORY.map(
  ({ department, ...person }) => ({ ...person, detail: department }),
);

const meta = {
  title: 'Écrans/08 Réglages/Annuaire',
  component: AnnuaireScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  args: {
    people: ENTRIES,
    bannerTitle: '312 personnes, ajoutées à l’usage',
    bannerDetail: 'Ici ou à la remise d’un colis, sur tous les iPhone.',
  },
} satisfies Meta<typeof AnnuaireScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Annuaire: Story = {
  parameters: { reference: '08-reglages/reglages--annuaire' },
  args: { letters: DIRECTORY_LETTERS },
};

/** The first day: nobody yet, the way in is "Ajouter". */
export const Vide: Story = {
  args: { people: [] },
};

/** Typing narrows the list in place; banner and rail step aside. */
export const Recherche: Story = {
  args: { people: ENTRIES, query: 'stu' },
  render: function Render(args) {
    const [query, setQuery] = useState(args.query ?? '');
    const needle = query.trim().toLowerCase();
    const people = args.people.filter((person) =>
      `${person.name} ${person.detail ?? ''}`.toLowerCase().includes(needle),
    );
    return (
      <AnnuaireScreen
        {...args}
        query={query}
        onQueryChange={setQuery}
        people={people}
      />
    );
  },
};

export const SansResultat: Story = {
  name: 'Sans résultat',
  args: { people: [], query: 'Garnier' },
};
