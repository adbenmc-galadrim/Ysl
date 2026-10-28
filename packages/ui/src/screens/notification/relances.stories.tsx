import type { Meta, StoryObj } from '@storybook/react-vite';

import { RelancesScreen } from '#screens/notification/relances-screen';

/**
 * The reminders the app proposes (F37, D12: J+2 and J+5 working days): it
 * prepares them, the agent sends each one from the iPhone's mail app.
 */
const meta = {
  title: 'Écrans/06 Notification/Relances',
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const INTRO =
  'Relances proposées à J+2 et J+5 jours ouvrés. Rien ne part tout seul : chaque e-mail s’ouvre dans votre messagerie.';

export const ColisEnSouffrance: Story = {
  name: 'Colis en souffrance',
  render: () => (
    <RelancesScreen
      intro={INTRO}
      sections={[
        {
          title: 'À relancer',
          people: [
            {
              id: 'hugo',
              name: 'Hugo Lefèvre',
              parcels: '1 colis · DHL ···7112',
              status: 'Notifié il y a 3 jours, jamais relancé',
              due: true,
            },
            {
              id: 'nora',
              name: 'Nora Haddad',
              parcels:
                '3 colis · Amazon ···4471, UPS ···0622, Colissimo ···7505',
              status: 'En attente depuis 6 jours · relancée 1 fois, le 22 oct.',
              due: true,
            },
          ],
        },
        {
          title: 'En souffrance',
          people: [
            {
              id: 'ines',
              name: 'Inès Garnier',
              parcels: '1 colis · FedEx ···3338',
              status: 'En attente depuis 8 jours · relancée 2 fois, le 23 oct.',
              due: false,
            },
          ],
        },
      ]}
      remindAllLabel="Relancer les 2"
      onRemindAll={() => {}}
      onRemind={() => {}}
      onBack={() => {}}
    />
  ),
};

export const RienARelancer: Story = {
  name: 'Rien à relancer',
  render: () => (
    <RelancesScreen
      intro={INTRO}
      sections={[]}
      empty={{
        title: 'Aucun colis en souffrance',
        description:
          'Les colis notifiés apparaissent ici quand une relance est due.',
      }}
      onBack={() => {}}
    />
  ),
};
