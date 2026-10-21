import type { Meta, StoryObj } from '@storybook/react-vite';

import { PageIntro } from '#components/page-intro';

const meta = {
  title: 'Composants/PageIntro',
  component: PageIntro,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-[353px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PageIntro>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ecran: Story = {
  args: {
    title: 'Service courrier',
    description: 'Connectez-vous avec votre compte du service.',
  },
};

export const Centre: Story = {
  args: {
    size: 'lg',
    align: 'center',
    title: 'Autoriser la caméra',
    description:
      'Elle sert à lire les étiquettes et les QR codes de retrait. iOS peut redemander l’accès à chaque ouverture de l’app : c’est normal, il suffit d’accepter.',
  },
};

export const Feuille: Story = {
  args: {
    size: 'sm',
    as: 'h2',
    title: 'Corriger l’adresse',
    description:
      'Le serveur a refusé p.mercier@saint-laurent : il manque la fin de l’adresse.',
  },
};
