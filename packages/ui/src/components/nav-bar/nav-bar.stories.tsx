import type { Meta, StoryObj } from '@storybook/react-vite';

import { IconButton } from '#components/icon-button';
import { NavBar, NavBarAction } from '#components/nav-bar';

const meta = {
  title: 'Composants/NavBar',
  component: NavBar,
  decorators: [(Story) => <div className="w-[353px]"><Story /></div>],
} satisfies Meta<typeof NavBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Retour: Story = {
  args: { trailing: <IconButton icon="edit" label="Modifier" size="lg" /> },
};

export const TitreEtAction: Story = {
  name: 'Titre et action',
  args: { title: '2 sur 2', trailing: <NavBarAction>Passer</NavBarAction> },
};

/** A modal form: two blue text actions around the title. */
export const Formulaire: Story = {
  args: {
    leading: (
      <NavBarAction tone="blue" className="font-normal">
        Annuler
      </NavBarAction>
    ),
    title: 'Modifier le colis',
    trailing: <NavBarAction tone="blue">Enregistrer</NavBarAction>,
  },
};

/** The settings screens: the title centred in the bar, the client's request. */
export const TitreCentre: Story = {
  name: 'Titre centré (réglages)',
  args: { title: 'Lieu et horaires', trailing: <NavBarAction>OK</NavBarAction> },
};
