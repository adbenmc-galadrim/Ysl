import type { Meta, StoryObj } from '@storybook/react-vite';

import { Avatar } from '#components/avatar';
import {
  GroupedRow,
  GroupedSection,
  SettingsIcon,
} from '#components/grouped-list';
import { Switch } from '#components/switch';

const meta = {
  title: 'Composants/GroupedList',
  component: GroupedSection,
  parameters: { backgrounds: { default: 'fill' } },
  decorators: [
    (Story) => (
      <div className="w-[353px] bg-fill p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GroupedSection>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Icon, label, value, chevron: the Réglages rows. */
export const Reglages: Story = {
  name: 'Réglages',
  args: {
    header: 'Données',
    children: [
      <GroupedRow
        key="sync"
        leading={<SettingsIcon icon="cloud" color="green" />}
        title="Synchronisation"
        value="À jour"
        accessory="chevron"
      />,
      <GroupedRow
        key="mails"
        leading={<SettingsIcon icon="send" color="blue" />}
        title="E-mails envoyés"
        value="1 échec"
        accessory="chevron"
      />,
      <GroupedRow
        key="sound"
        leading={<SettingsIcon icon="volume" color="grey" />}
        title="Son au scan"
        accessory={<Switch checked label="Son au scan" />}
      />,
    ],
  },
};

/** No icon: the text starts at 16 px, the hairline too. */
export const SansIcone: Story = {
  name: 'Sans icône, avec note',
  args: {
    header: 'Horaires',
    footer: 'Jours ouvrés uniquement. Ces informations apparaissent dans chaque e-mail.',
    children: [
      <GroupedRow key="l" title="Lundi" value="9:00–12:30, 14:00–18:00" />,
      <GroupedRow key="m" title="Mardi" value="9:00–12:30, 14:00–18:00" />,
    ],
  },
};

/** Two lines with an avatar: the team and the account rows. */
export const Personnes: Story = {
  args: {
    header: 'Agents',
    children: [
      <GroupedRow
        key="kd"
        leading={<Avatar initials="KD" status="online" className="text-14" />}
        title="Karim Daoud"
        subtitle="Administrateur, iPhone du service"
      />,
      <GroupedRow
        key="tm"
        leading={<Avatar initials="TM" status="offline" className="text-14" />}
        title="Thomas Moreau"
        subtitle="Agent, ordinateur de l’accueil"
      />,
    ],
  },
};
