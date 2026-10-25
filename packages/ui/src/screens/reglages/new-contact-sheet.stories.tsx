import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { DIRECTORY } from '#fixtures/directory';
import { AnnuaireScreen } from '#screens/reglages/annuaire-screen';
import {
  type ContactDraft,
  NewContactSheet,
} from '#screens/reglages/new-contact-sheet';

const EMPTY: ContactDraft = {
  firstName: '',
  lastName: '',
  email: '',
  department: '',
};

const behind = (
  <AnnuaireScreen
    people={DIRECTORY.map(({ department, ...person }) => ({
      ...person,
      detail: department,
    }))}
    bannerTitle="312 personnes, ajoutées à l’usage"
    bannerDetail="Ici ou à la remise d’un colis, sur tous les iPhone."
  />
);

const meta = {
  title: 'Écrans/08 Réglages/Nouvelle personne',
  component: NewContactSheet,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  args: { value: EMPTY, behind, onChange: () => {}, onSubmit: () => {} },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <NewContactSheet {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof NewContactSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NouvellePersonne: Story = { name: 'Nouvelle personne' };

export const Remplie: Story = {
  args: {
    value: {
      firstName: 'Inès',
      lastName: 'Garnier',
      email: 'ines.garnier@example.com',
      department: 'Studio',
    },
  },
};

export const ChampsManquants: Story = {
  name: 'Champs manquants',
  args: {
    value: { ...EMPTY, firstName: 'Inès', email: 'ines.garnier@' },
    errors: {
      lastName: 'Indiquez le nom.',
      email: 'Adresse e-mail incomplète.',
    },
  },
};

/** The address is already someone's: no second card, the existing one instead. */
export const Doublon: Story = {
  args: {
    value: {
      firstName: 'Camille',
      lastName: 'Morel',
      email: 'Camille.Morel@example.com',
      department: '',
    },
    duplicate: { name: 'Camille Morel', initials: 'CM', detail: 'Studio' },
    onUseDuplicate: () => {},
  },
};

export const Modifier: Story = {
  args: {
    title: 'Modifier la fiche',
    description: 'Le changement vaut sur tous les iPhone du service.',
    submitLabel: 'Enregistrer',
    value: {
      firstName: 'Claire',
      lastName: 'Robin',
      email: 'claire.robin@example.com',
      department: 'Ressources humaines',
    },
  },
};
