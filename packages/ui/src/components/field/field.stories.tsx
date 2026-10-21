import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Field,
  FieldAction,
  FieldInput,
  FieldSelect,
} from '#components/field';

const meta = {
  title: 'Composants/Field',
  component: Field,
  decorators: [(Story) => <div className="w-[353px]"><Story /></div>],
} satisfies Meta<typeof Field>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Selection: Story = {
  name: 'Choix sur un autre écran',
  args: {
    label: 'Destinataire',
    children: (id) => <FieldSelect id={id} value="Camille Morel, Studio" />,
  },
};

export const NumeroDeSuivi: Story = {
  name: 'Numéro de suivi, vérifié',
  args: {
    label: 'Numéro de suivi',
    help: 'Clé de contrôle UPS valide',
    helpTone: 'green',
    children: (id) => (
      <FieldInput
        id={id}
        mono
        defaultValue="1Z E63 44W 04 9923 0622"
        trailing={<FieldAction icon="scan" label="Scanner à nouveau" />}
      />
    ),
  },
};

export const AvecAide: Story = {
  name: 'Avec aide',
  args: {
    label: 'Expéditeur',
    help: 'Retenu pour les prochains colis de ce compte UPS',
    children: (id) => <FieldInput id={id} defaultValue="Metalworks SpA" />,
  },
};

export const Vide: Story = {
  args: {
    label: 'Note',
    children: (id) => <FieldInput id={id} placeholder="Ajouter une note" />,
  },
};

export const EnSaisie: Story = {
  name: 'En saisie',
  args: {
    label: 'Adresse e-mail',
    children: (id) => (
      <FieldInput
        id={id}
        type="email"
        variant="outline"
        defaultValue="marc.petit@prestataire.fr"
      />
    ),
  },
};
