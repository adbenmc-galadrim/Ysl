import type { Meta, StoryObj } from '@storybook/react-vite';

import { TEAM } from '#fixtures/team';
import { EquipeScreen } from '#screens/pilotage/equipe-screen';

const meta = {
  title: 'Écrans/09 Zones d’ombre/Plusieurs agents et ordinateur/Équipe et postes',
  component: EquipeScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof EquipeScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EquipeEtPostes: Story = {
  name: 'Équipe et postes',
  parameters: {
    reference: '09-zones-d-ombre/plusieurs-agents-et-ordinateur--equipe-et-postes',
  },
  args: {
    agents: [TEAM.karim, TEAM.sophie, TEAM.thomas],
    shared: {
      header: 'Ce qui est partagé',
      footer:
        'Chaque action garde le nom de l’agent qui l’a faite. Deux agents ne peuvent pas remettre le même colis : le second est prévenu.',
      items: [
        {
          icon: 'package',
          color: 'ink',
          label: 'Colis et historique',
          value: 'En direct',
          chevron: false,
        },
        {
          icon: 'users',
          color: 'orange',
          label: 'Annuaire',
          value: 'En direct',
          chevron: false,
        },
        {
          icon: 'scan',
          color: 'indigo',
          label: 'Expéditeurs appris',
          value: 'En direct',
          chevron: false,
        },
      ],
    },
  },
};
